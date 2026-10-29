"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/useSession";

const WORKSHOP_URL = "https://my-homepage-beryl-three.vercel.app";

const SECTIONS = [
  { href: "", label: "Status" },
  { href: "/hunt", label: "Hunt" },
  { href: "/evolve", label: "Evolve" },
  { href: "/skills", label: "Skills" },
];

export default function NavBar() {
  const { session } = useSession();
  const pathname = usePathname();
  const match = pathname.match(/^\/character\/([^/]+)/);
  const base = match ? `/character/${match[1]}` : null;

  const linkClass = (active: boolean) =>
    `hard-hover border px-3 py-2 ${
      active ? "border-accent bg-accent text-bg" : "border-border bg-panel-2 text-muted hover:text-accent"
    }`;

  return (
    <header className="scanline border-b border-border bg-panel/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-display text-3xl tracking-widest text-accent">
          [ SLIME ]
        </Link>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-wider">
          <Link href="/" className={linkClass(pathname === "/")}>
            Save slots
          </Link>
          {base &&
            SECTIONS.map((s) => {
              const href = base + s.href;
              return (
                <Link key={s.label} href={href} className={linkClass(pathname === href)}>
                  {s.label}
                </Link>
              );
            })}
        </div>

        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
          <a
            href={WORKSHOP_URL}
            className="hard-hover border border-border bg-panel-2 px-3 py-2 text-muted hover:text-accent"
          >
            ← The Workshop
          </a>
          {session && (
            <button
              onClick={() => supabase.auth.signOut()}
              className="hard-hover border border-border bg-panel-2 px-3 py-2 text-muted hover:text-danger"
            >
              Sign out
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
