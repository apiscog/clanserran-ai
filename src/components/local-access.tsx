"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Copy, Eye, EyeOff, Fingerprint, Info, KeyRound, Printer, XCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { normalizeUsername, passwordChecks } from "@/lib/local-access";

type ApiResult = { message?: string; fields?: Record<string, string>; recoveryCode?: string; next?: string };

function subscribeToBrowserCapability() {
  return () => undefined;
}

function usePasskeySupport() {
  return useSyncExternalStore(subscribeToBrowserCapability, () => "PublicKeyCredential" in window, () => false);
}

function PasswordInput({
  id,
  value,
  onChange,
  error,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: "current-password" | "new-password";
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-control">
      <input
        id={id}
        name={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={error ? "input-error" : undefined}
        required
      />
      <button className="password-toggle" type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}>
        {visible ? <EyeOff aria-hidden="true" size={20} /> : <Eye aria-hidden="true" size={20} />}
        <span>{visible ? "Ocultar" : "Mostrar"}</span>
      </button>
    </div>
  );
}

function PasswordRequirements({ password }: { password: string }) {
  const checks = passwordChecks(password);
  const requirements = [
    [checks.length, "Mínimo 4 caracteres"],
    [checks.lowercase, "Una letra minúscula"],
    [checks.uppercase, "Una letra mayúscula"],
    [checks.number, "Un número"],
  ] as const;
  return (
    <div className="password-help" aria-live="polite">
      <p className="cluster small"><Info aria-hidden="true" size={18} /><strong>La contraseña necesita:</strong></p>
      <ul className="requirements">
        {requirements.map(([valid, label]) => (
          <li className={valid ? "requirement valid" : "requirement"} key={label}>
            {valid ? <CheckCircle2 aria-hidden="true" size={17} /> : <Circle aria-hidden="true" size={17} />}{label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FieldError({ id, children }: { id: string; children?: string }) {
  return children ? <span id={id} className="field-error" role="alert"><XCircle aria-hidden="true" size={16} /> {children}</span> : null;
}

export function LocalSignIn({ callbackURL }: { callbackURL: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const passkeySupported = usePasskeySupport();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await authClient.signIn.username({ username, password, rememberMe: true, callbackURL });
      if (result.error) {
        setError(result.error.status === 429 ? "Demasiados intentos. Espera unos minutos antes de probar de nuevo." : "El usuario o la contraseña no son correctos.");
        setLoading(false);
        return;
      }
      window.location.assign(callbackURL);
    } catch {
      setError("No hemos podido conectar. Comprueba la conexión e inténtalo de nuevo.");
      setLoading(false);
    }
  }

  async function signInWithPasskey() {
    setLoading(true);
    setError("");
    try {
      const result = await authClient.signIn.passkey();
      if (result.error) {
        setError("No se pudo utilizar la huella, Face ID o PIN en este dispositivo.");
        setLoading(false);
        return;
      }
      window.location.assign(callbackURL);
    } catch {
      setError("No se pudo utilizar la huella, Face ID o PIN en este dispositivo.");
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <form className="stack" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="sign-in-username">Usuario</label>
          <input id="sign-in-username" name="username" value={username} onChange={(event) => setUsername(normalizeUsername(event.target.value))} autoComplete="username webauthn" required />
        </div>
        <div className="field">
          <label htmlFor="sign-in-password">Contraseña</label>
          <PasswordInput id="sign-in-password" value={password} onChange={setPassword} autoComplete="current-password" />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button full" type="submit" disabled={loading}><KeyRound aria-hidden="true" size={20} />{loading ? "Entrando…" : "Entrar"}</button>
      </form>
      {passkeySupported && <button className="button secondary full" type="button" onClick={signInWithPasskey} disabled={loading}><Fingerprint aria-hidden="true" size={21} /> Entrar con huella, Face ID o PIN</button>}
      <Link className="small" href="/acceso/recuperar">He olvidado mi contraseña</Link>
    </div>
  );
}

export function LocalRegistration({ inviteToken }: { inviteToken: string }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ recoveryCode: string; next: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFields({});
    setMessage("");
    try {
      const response = await fetch("/api/access/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, username, password, passwordConfirmation: confirmation, inviteToken }),
      });
      const payload = await response.json() as ApiResult;
      if (!response.ok || !payload.recoveryCode || !payload.next) {
        setFields(payload.fields ?? {});
        setMessage(payload.message ?? "Revisa los datos e inténtalo de nuevo.");
        return;
      }
      setResult({ recoveryCode: payload.recoveryCode, next: payload.next });
    } catch {
      setMessage("No hemos podido conectar. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="stack" role="status">
        <div><p className="eyebrow">Acceso creado</p><h2>Guarda tu código de recuperación</h2></div>
        <p>Es el último recurso si no puedes usar tu dispositivo y olvidas la contraseña. Solo se mostrará ahora.</p>
        <code className="recovery-code">{result.recoveryCode}</code>
        <div className="cluster">
          <button className="button secondary" type="button" onClick={() => navigator.clipboard.writeText(result.recoveryCode)}><Copy aria-hidden="true" size={19} /> Copiar código</button>
          <button className="button secondary" type="button" onClick={() => window.print()}><Printer aria-hidden="true" size={19} /> Imprimir</button>
        </div>
        <Link className="button" href={result.next}>Continuar con la invitación</Link>
      </div>
    );
  }

  const checks = passwordChecks(password);
  const passwordInvalid = password.length > 0 && !Object.values(checks).every(Boolean);
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="register-name">Nombre para la familia</label>
        <input id="register-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Por ejemplo, María Serrán" aria-invalid={Boolean(fields.name)} required />
        <FieldError id="register-name-error">{fields.name}</FieldError>
      </div>
      <div className="field">
        <label htmlFor="register-username">Usuario para entrar</label>
        <input id="register-username" value={username} onChange={(event) => setUsername(normalizeUsername(event.target.value))} autoComplete="username" placeholder="mariaserran" aria-describedby="register-username-hint register-username-error" aria-invalid={Boolean(fields.username)} className={fields.username ? "input-error" : undefined} required />
        <span id="register-username-hint" className="hint">Lo convertimos a minúsculas y quitamos espacios y tildes.</span>
        <FieldError id="register-username-error">{fields.username}</FieldError>
      </div>
      <div className="field">
        <label htmlFor="register-password">Contraseña</label>
        <PasswordInput id="register-password" value={password} onChange={setPassword} autoComplete="new-password" error={passwordInvalid ? "La contraseña todavía no cumple todos los requisitos." : fields.password} />
        <PasswordRequirements password={password} />
        <FieldError id="register-password-error">{fields.password}</FieldError>
      </div>
      <div className="field">
        <label htmlFor="register-confirmation">Repite la contraseña</label>
        <PasswordInput id="register-confirmation" value={confirmation} onChange={setConfirmation} autoComplete="new-password" error={fields.passwordConfirmation || (confirmation && confirmation !== password ? "Las contraseñas no coinciden." : undefined)} />
        <FieldError id="register-confirmation-error">{fields.passwordConfirmation}</FieldError>
      </div>
      {message && <p className="error" role="alert">{message}</p>}
      <button className="button full" type="submit" disabled={loading}>{loading ? "Creando acceso…" : "Crear acceso sin correo"}</button>
    </form>
  );
}

export function RecoveryForm() {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [replacementCode, setReplacementCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFields({});
    setMessage("");
    try {
      const response = await fetch("/api/access/recover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, recoveryCode: code, password, passwordConfirmation: confirmation }),
      });
      const payload = await response.json() as ApiResult;
      if (!response.ok || !payload.recoveryCode) {
        setFields(payload.fields ?? {});
        setMessage(payload.message ?? "No hemos podido recuperar el acceso.");
        return;
      }
      setReplacementCode(payload.recoveryCode);
    } catch {
      setMessage("No hemos podido conectar. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (replacementCode) return <div className="stack" role="status"><h2>Contraseña actualizada</h2><p>Las sesiones anteriores se han cerrado. Guarda el nuevo código de recuperación:</p><code className="recovery-code">{replacementCode}</code><button className="button secondary" type="button" onClick={() => navigator.clipboard.writeText(replacementCode)}><Copy aria-hidden="true" size={19} /> Copiar código</button><Link className="button" href="/acceso">Volver a entrar</Link></div>;

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="field"><label htmlFor="recovery-username">Usuario</label><input id="recovery-username" value={username} onChange={(event) => setUsername(normalizeUsername(event.target.value))} autoComplete="username" required /><FieldError id="recovery-username-error">{fields.username}</FieldError></div>
      <div className="field"><label htmlFor="recovery-code">Código de recuperación</label><input id="recovery-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} autoComplete="off" placeholder="ABCD-EFGH-JKLM-NPQR" required /><FieldError id="recovery-code-error">{fields.recoveryCode}</FieldError></div>
      <div className="field"><label htmlFor="recovery-password">Nueva contraseña</label><PasswordInput id="recovery-password" value={password} onChange={setPassword} autoComplete="new-password" error={fields.password} /><PasswordRequirements password={password} /><FieldError id="recovery-password-error">{fields.password}</FieldError></div>
      <div className="field"><label htmlFor="recovery-confirmation">Repite la nueva contraseña</label><PasswordInput id="recovery-confirmation" value={confirmation} onChange={setConfirmation} autoComplete="new-password" error={fields.passwordConfirmation} /><FieldError id="recovery-confirmation-error">{fields.passwordConfirmation}</FieldError></div>
      {message && <p className="error" role="alert">{message}</p>}
      <button className="button full" type="submit" disabled={loading}>{loading ? "Actualizando…" : "Establecer una contraseña nueva"}</button>
    </form>
  );
}

export function PasskeySetup() {
  const supported = usePasskeySupport();
  const [hasPasskey, setHasPasskey] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supported) return;
    void authClient.passkey.listUserPasskeys().then((result) => setHasPasskey(Boolean(result.data?.length))).catch(() => setHasPasskey(null));
  }, [supported]);

  if (!supported || hasPasskey !== false) return null;

  async function activate() {
    setLoading(true);
    setMessage("");
    try {
      const result = await authClient.passkey.addPasskey({ name: "Dispositivo principal", authenticatorAttachment: "platform" });
      if (result.error) {
        setMessage("No se pudo activar en este dispositivo. Puedes seguir entrando con usuario y contraseña.");
        setLoading(false);
        return;
      }
      setHasPasskey(true);
      setMessage("Acceso con huella, Face ID o PIN activado.");
    } catch {
      setMessage("No se pudo activar en este dispositivo. Puedes seguir entrando con usuario y contraseña.");
      setLoading(false);
    }
  }

  return <section className="card stack"><div className="cluster"><Fingerprint aria-hidden="true" size={28} /><div><p className="eyebrow">Acceso más sencillo</p><h2>Usa este dispositivo</h2></div></div><p>La próxima vez podrás entrar con la huella, Face ID o PIN con el que desbloqueas el dispositivo.</p>{message && <p className={message.startsWith("Acceso") ? "success" : "error"} role="status">{message}</p>}<button className="button" type="button" onClick={activate} disabled={loading}>{loading ? "Activando…" : "Activar huella, Face ID o PIN"}</button><p className="small muted">Es opcional. Tu usuario y contraseña seguirán funcionando.</p></section>;
}
