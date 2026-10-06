"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type Provider = "google" | "microsoft";

const providerCopy = {
  google: {
    label: "Google",
    loading: "Abriendo Google…",
    error: "No se pudo iniciar sesión con Google. Inténtalo de nuevo.",
  },
  microsoft: {
    label: "Microsoft",
    loading: "Abriendo Microsoft…",
    error: "No hemos podido iniciar sesión con Microsoft. Inténtalo de nuevo.",
  },
} satisfies Record<Provider, { label: string; loading: string; error: string }>;

function MicrosoftMark() {
  return (
    <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 20 20">
      <path fill="currentColor" d="M1 1h8v8H1zm10 0h8v8h-8zM1 11h8v8H1zm10 0h8v8h-8z" />
    </svg>
  );
}

function SocialSignInButton({
  provider,
  callbackURL,
  disabled,
  initialError = false,
}: {
  provider: Provider;
  callbackURL: string;
  disabled: boolean;
  initialError?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError ? providerCopy[provider].error : "");
  const copy = providerCopy[provider];

  async function signIn() {
    setLoading(true);
    setError("");
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL,
        ...(provider === "microsoft" ? { errorCallbackURL: "/?auth_error=microsoft" } : {}),
      });
      if (result.error) {
        setError(copy.error);
        setLoading(false);
      }
    } catch {
      setError(copy.error);
      setLoading(false);
    }
  }

  return (
    <div className="auth-option">
      <button
        className={`button full${provider === "microsoft" ? " secondary" : ""}`}
        type="button"
        onClick={signIn}
        disabled={disabled || loading}
        aria-describedby={provider === "microsoft" ? "microsoft-account-hint" : undefined}
      >
        {provider === "microsoft" ? <MicrosoftMark /> : <LogIn aria-hidden="true" size={20} />}
        {loading ? copy.loading : `Continuar con ${copy.label}`}
      </button>
      {provider === "microsoft" && <p id="microsoft-account-hint" className="hint">Para cuentas Hotmail, Outlook o Live</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

export function SocialSignIn({
  callbackURL,
  disabled = false,
  microsoftError = false,
}: {
  callbackURL: string;
  disabled?: boolean;
  microsoftError?: boolean;
}) {
  return (
    <div className="auth-options" aria-label="Opciones de acceso">
      <SocialSignInButton provider="google" callbackURL={callbackURL} disabled={disabled} />
      <SocialSignInButton provider="microsoft" callbackURL={callbackURL} disabled={disabled} initialError={microsoftError} />
    </div>
  );
}
