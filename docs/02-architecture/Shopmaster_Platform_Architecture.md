# Shopmaster — Platform Architecture

| | |
|---|---|
| **Product** | Shopmaster |
| **Document type** | Sub-system design — Infrastructure & Operations |
| **Version** | 0.1 — Draft for review |
| **Date** | 2 July 2026 |
| **Prepared by** | Bidur |
| **Builds on** | PRD Section 12 (hosting/scale), Section 8.16 (`LOC`) |

## 1. Scope, and a Definitional Note

"Platform architecture" is doing a lot of work as a term, so worth being explicit: this document covers the infrastructure and operational substrate that Backend, Frontend, and Database all run on — hosting, environments, deployment, data residency, observability, and disaster recovery. It's not about API design (that's Backend) or schema (that's Database); it's about where things physically run and how they stay running. IDs here: `PLAT-##`.

## 2. Environments

- **PLAT-01** Three environments — development, staging, production — matching the "one Auth0 tenant per environment" decision from the Auth System document, deliberately kept consistent so a device or account never has to guess which environment it's talking to based on inconsistent conventions across systems.
- **PLAT-02** Staging is a genuine mirror of production topology (same service boundaries, same database engine, representative data volume) — not a smaller, different-shaped environment that lets a scaling or multi-tenancy bug slip through untested.

## 3. Hosting — Managed Platform First, Not Kubernetes on Day One

- **PLAT-03** A managed container/application platform (the category — Cloud Run, App Runner, Railway, Fly.io, and similar all qualify; the specific vendor is an open question in Section 9) rather than self-managed Kubernetes. The reasoning is about team size, not capability: a small engineering team gets far more value from shipping product than from operating a Kubernetes control plane, and every one of these managed options has a credible path to "graduate" to more control later if a specific bottleneck actually demands it. Choosing Kubernetes now would be solving an operations problem this company doesn't have yet, at the cost of the product problems it does have.
- **PLAT-04** The backend modular monolith (Backend Architecture Section 3) deploys as a small number of stateless, horizontally scalable instances behind a load balancer — statelessness is the property that actually matters here, more than the specific hosting vendor, since it's what makes scaling for a lunch-hour traffic spike a matter of adding instances rather than a re-architecture.
- **PLAT-05** Managed Postgres (the same category of choice as Veridity's existing NeonDB setup) rather than self-hosted — backups, point-in-time recovery, and connection pooling handled by the provider instead of reinvented internally.

## 4. Data Residency — Resolving the Nepal Requirement Concretely

This is the platform decision that actually matters most for this specific product, and it deserves more than a bullet point.

- **PLAT-06** Primary infrastructure sits in a region chosen for reasonable latency to both Nepal and Australia — a Singapore or Mumbai region on most major cloud providers is a defensible middle ground, close enough to both without being ideal for either, which is the honest tradeoff of serving both markets from one platform.
- **PLAT-07** The Nepal in-country audit server flagged in LOC-03 (and drawn as `NPAUDIT` in the system architecture diagram) is a small, dedicated, physically-Nepal-hosted component — realistically a modest VPS or dedicated server with a Nepali or Nepal-presence hosting provider — not a requirement to move the whole multi-tenant platform into the country. It receives a one-way, narrow replication feed: just the CBMS-relevant fields (PAN/VAT, invoice number, tax breakdown, timestamp) for Nepali Growth/Enterprise merchants who've crossed the reported turnover threshold, not the full database.
- **PLAT-08** This component only needs to exist for merchants who actually trigger LOC-03/LOC-04 — it's provisioned when the first qualifying Nepali merchant approaches that threshold, not built speculatively before there's a real account that needs it.
- **PLAT-09** Worth flagging plainly: everything in this section is built against publicly reported compliance guidance, same as LOC-03 itself. The actual server-location and audit-log requirements need direct confirmation with Nepal-licensed counsel and, likely, an actual conversation with the IRD before this gets built for a real customer — this document plans for the requirement, it doesn't substitute for verifying it.

## 5. CI/CD

- **PLAT-10** Standard pipeline: lint and test on every push, automatic deploy to staging on merge to main, production deploy behind a manual approval gate. The manual gate for production isn't excess caution for its own sake — this is software that touches other people's money, and a deliberate human check before it ships is a reasonable cost for that.
- **PLAT-11** Database migrations run through the same pipeline with a required rollback plan attached to each one, given how much of this system's integrity depends on the multi-tenancy and sync data models staying exactly correct (Database Architecture Sections 2 and 4).

## 6. Observability

- **PLAT-12** Structured logging, a metrics/monitoring stack, and error tracking, with a short list of metrics that matter more here than in a typical SaaS product:
  - Sync queue depth per device and per location — the operational signal for "is offline mode actually working," not just an average across the fleet.
  - Payment success/failure rate broken out per rail (PAY-04) — a silent failure in one local payment rail should show up immediately, not get averaged away by every other rail's healthy numbers.
  - API latency by endpoint, with the public QR/NFC and online-ordering endpoints (Backend Architecture BE-13) watched separately from authenticated staff traffic, since that's the surface most exposed to abuse traffic skewing the numbers.
- **PLAT-13** Alerting thresholds get set against these specific metrics before launch, not added reactively after the first incident that reveals nobody was watching.

## 7. Secrets Management

- **PLAT-14** A dedicated secrets manager (not environment files committed anywhere, not values pasted into a deploy dashboard by hand) for Auth0 client secrets, payment processor keys, and database credentials. PAY-07's promise that no raw card data touches Shopmaster's own storage only holds if the infrastructure around the payment flow is genuinely secure — the promise is only as strong as the weakest secret-handling practice surrounding it.

## 8. Disaster Recovery

- **PLAT-15** Automated database backups with a genuinely tested restore procedure — tested meaning someone has actually run a restore and confirmed the data comes back correct, not just confirmed that a backup file exists.
- **PLAT-16** Illustrative RPO/RTO targets worth starting the conversation at — recovery point objective under an hour, recovery time objective under a few hours — flagged explicitly as a starting proposal for business sign-off, not a number this document can responsibly finalize on its own given it depends on risk tolerance the engineering side alone shouldn't decide.

## 9. Tenant Isolation at the Infrastructure Level

- **PLAT-17** Shared infrastructure with strong logical isolation (Backend Architecture BE-10/11, Database Architecture DB-02) for Starter and Growth tiers — this is the right default, not a corner cut, since dedicated infrastructure per tenant at that scale would be pure cost with no real security benefit over well-implemented logical isolation.
- **PLAT-18** Dedicated infrastructure as an optional Enterprise-tier offering is worth keeping open as a future premium option for a chain large enough to want it contractually, but it's not a v1 requirement and shouldn't shape the core architecture.

## 10. Open Questions

- Specific hosting vendor: this document deliberately named a category (Section 3) rather than a vendor — worth a short, real evaluation against actual pricing and the Nepal/Australia latency question before committing.
- Does the Nepal audit-server component (PLAT-07) get built in-house, or is there a local hosting/compliance partner worth engaging given the existing Kailali software-entity research — that connection was flagged as an open question in the original PRD and resurfaces directly here.
- RPO/RTO targets (PLAT-16) need an actual answer from whoever owns risk tolerance for the business, not just an engineering default.
