"use client";

import Link from "next/link";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/useSession";

const WORKSHOP_URL = "https://my-homepage-beryl-three.vercel.app";

export default function NavBar() {
  const { session } = useSession();

  return (
    <header className="scanline border-b border-border bg-panel/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-display text-3xl tracking-widest text-accent">
          [ SLIME // START ]
        </Link>
        <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-wider">
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
