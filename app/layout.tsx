// Root layout — wraps EVERY page (fonts, theme, top navbar).
// เลย์เอาต์หลักของทุกหน้า: ฟอนต์ ธีม และแถบนำทางด้านบน
import type { Metadata } from "next";
import { Suspense } from "react";
import { Bebas_Neue, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "./components/NavBar";

const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const plex = IBM_Plex_Mono({ weight: ["400", "500", "700"], subsets: ["latin"], variable: "--font-plex" });

export const metadata: Metadata = {
  title: "Slime // Start",
  description: "Personal Tensura-inspired incremental game",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bebas.variable} ${inter.variable} ${plex.variable}`}>
      <body>
        {/* usePathname() needs a Suspense boundary on Next.js 16 */}
        <Suspense fallback={<header className="scanline h-16 border-b border-border bg-panel/90" />}>
          <NavBar />
        </Suspense>
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-8">{children}</main>
      </body>
    </html>
  );
}
