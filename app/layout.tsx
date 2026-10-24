import type { Metadata } from "next";
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
        <NavBar />
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-8">{children}</main>
      </body>
    </html>
  );
}
