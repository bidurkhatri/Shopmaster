import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "ShopMaster — one order engine",
  description: "POS, self-service kiosk, QR/NFC and branded online ordering — one order engine for cafes, bars, restaurants and food trucks.",
};

// Set the theme before paint to avoid a flash of the wrong color scheme.
const themeInit = `(function(){try{var t=localStorage.getItem('shopmaster-theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
