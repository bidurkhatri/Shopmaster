/** Tiny i18n (LOC-01 / MENU-02). EN + NE (Nepali/Devanagari) UI strings. */
"use client";
import { createContext, useContext } from "react";
import type { Locale } from "@shopmaster/shared";

type Dict = Record<string, { en: string; ne: string }>;

const DICT: Dict = {
  "nav.pos": { en: "POS", ne: "बिक्री" },
  "nav.kitchen": { en: "Kitchen", ne: "भान्सा" },
  "nav.admin": { en: "Admin", ne: "व्यवस्थापन" },
  "pos.cart": { en: "Order", ne: "अर्डर" },
  "pos.empty": { en: "Tap items to add them", ne: "थप्न वस्तुहरू छान्नुहोस्" },
  "pos.subtotal": { en: "Subtotal", ne: "उप-जम्मा" },
  "pos.tax": { en: "Tax", ne: "कर" },
  "pos.total": { en: "Total", ne: "जम्मा" },
  "pos.charge": { en: "Take Payment", ne: "भुक्तानी लिनुहोस्" },
  "pos.send": { en: "Send to Kitchen", ne: "भान्सामा पठाउनुहोस्" },
  "pay.cash": { en: "Cash", ne: "नगद" },
  "pay.tendered": { en: "Cash received", ne: "प्राप्त नगद" },
  "pay.change": { en: "Change", ne: "फिर्ता" },
  "pay.paid": { en: "Paid", ne: "भुक्तानी भयो" },
  "common.back": { en: "Back", ne: "पछाडि" },
  "common.total": { en: "Total", ne: "जम्मा" },
  "qr.place": { en: "Place order", ne: "अर्डर गर्नुहोस्" },
  "qr.callWaiter": { en: "Call waiter", ne: "वेटर बोलाउनुहोस्" },
  "qr.requestBill": { en: "Request bill", ne: "बिल माग्नुहोस्" },
};

const LocaleContext = createContext<Locale>("en");

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useT() {
  const locale = useContext(LocaleContext);
  return (key: string) => DICT[key]?.[locale] ?? DICT[key]?.en ?? key;
}
