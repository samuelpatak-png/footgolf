import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Footgolf",
  description:
    "Zahraj si footgolf priamo v prehliadači — realistická fyzika, kopce, prekážky a vodné jazerá na troch jamkách.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk">
      <body className="bg-black antialiased">{children}</body>
    </html>
  );
}
