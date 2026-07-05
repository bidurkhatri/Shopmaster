import { createApp } from "./app.js";
import { assertProdConfig } from "./security.js";

const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);

assertProdConfig(); // fail fast if running in production with a default/unset JWT_SECRET (PLAT-14)

const app = createApp();
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`ShopMaster API listening on http://localhost:${PORT}`);
});
