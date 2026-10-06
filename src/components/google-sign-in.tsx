"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function GoogleSignIn({ callbackURL, disabled = false }: { callbackURL: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setLoading(true);
    setError("");
    const result = await authClient.signIn.social({ provider: "google", callbackURL });
    if (result.error) {
      setError("No se pudo iniciar sesión con Google. Inténtalo de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <button className="button" type="button" onClick={signIn} disabled={disabled || loading}>
        <LogIn aria-hidden="true" size={20} />
        {loading ? "Abriendo Google…" : "Continuar con Google"}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
