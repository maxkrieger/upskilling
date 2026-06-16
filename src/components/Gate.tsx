import { useState } from "react";
import { checkPassword } from "../api.ts";
import { useStore } from "../store.ts";

export function Gate() {
  const login = useStore((s) => s.login);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    const ok = await checkPassword(password);
    setBusy(false);
    if (ok) login(true);
    else setError("Incorrect password.");
  };

  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
        <div className="mb-1 text-center text-3xl">✳</div>
        <h1 className="text-center font-serif text-2xl text-ink">Upskilling</h1>
        <p className="mt-1 text-center text-sm text-muted">
          Skills, discovered in your context of use.
        </p>
        <div className="mt-6 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Demo password"
            className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-ink outline-none focus:border-accent"
            autoFocus
          />
          {error && <div className="text-sm text-accent">{error}</div>}
          <button
            onClick={submit}
            disabled={busy || !password}
            className="w-full rounded-lg bg-accent px-3 py-2 font-medium text-canvas hover:bg-accentSoft disabled:opacity-50"
          >
            {busy ? "Checking…" : "Enter"}
          </button>
        </div>
      </div>
    </div>
  );
}
