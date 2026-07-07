import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { RegisterSW } from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "ShopMaster — one order engine",
  description: "POS, self-service kiosk, QR/NFC and branded online ordering — one order engine for cafes, bars, restaurants and food trucks.",
  manifest: "/manifest.webmanifest",
  applicationName: "ShopMaster",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ShopMaster" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f766e" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

// Set the theme before paint to avoid a flash of the wrong color scheme.
const themeInit = `(function(){try{var t=localStorage.getItem('shopmaster-theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <RegisterSW />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
