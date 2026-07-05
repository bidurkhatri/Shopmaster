import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShopMaster",
  description: "One order engine — POS, kiosk, QR/NFC and branded online ordering.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
