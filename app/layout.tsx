import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Footgolf",
  description:
    "Zahraj si footgolf priamo v prehliadači — realistická fyzika, kopce, prekážky a vodné jazerá na troch jamkách.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#031014",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body className="bg-black antialiased">{children}</body>
    </html>
  );
}
