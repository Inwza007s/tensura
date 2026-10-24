"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function AuthGate() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function run(kind: "in" | "up") {
    setBusy(true);
    setMessage(null);
    const { data, error } =
      kind === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) {
      setIsError(true);
      setMessage(error.message);
    } else if (kind === "up" && !data.session) {
      setIsError(false);
      setMessage("Account created. Check your email to confirm, then sign in.");
    }
  }

  return (
    <section className="bracket mx-auto max-w-md border border-border bg-panel p-6">
      <h1 className="font-display text-4xl tracking-widest text-accent">ACCESS</h1>
      <p className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">
        Sign in to create a character. Same account as the other Workshop games.
      </p>
      <div className="mt-6 space-y-3">
        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-border bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-accent"
        />
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-border bg-bg px-3 py-2 font-mono text-sm outline-none focus:border-accent"
        />
        <div className="flex gap-3">
          <button
            disabled={busy || !email || !password}
            onClick={() => run("in")}
            className="hard-hover flex-1 border border-accent bg-accent px-4 py-2 font-display text-xl tracking-widest text-bg disabled:opacity-40"
          >
            SIGN IN
          </button>
          <button
            disabled={busy || !email || !password}
            onClick={() => run("up")}
            className="hard-hover flex-1 border border-border bg-panel-2 px-4 py-2 font-display text-xl tracking-widest disabled:opacity-40"
          >
            CREATE
          </button>
        </div>
        {message && (
          <p className={`font-mono text-xs ${isError ? "text-danger" : "text-ok"}`}>{message}</p>
        )}
      </div>
    </section>
  );
}
