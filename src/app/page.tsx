import { ArrowRight, CheckCircle2, Gift, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { SocialSignIn } from "@/components/social-sign-in";
import { isServerConfigured } from "@/lib/env";
import { getSession } from "@/lib/session";

function safeDestination(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && /^\/(invitacion|grupos)(\/|$)/.test(candidate) && !candidate.startsWith("//") ? candidate : "/inicio";
}

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; auth_error?: string; error?: string }> }) {
  const configured = isServerConfigured();
  if (configured && await getSession()) redirect("/inicio");
  const params = await searchParams;
  const destination = safeDestination(params.next);
  const microsoftError = params.auth_error === "microsoft" && typeof params.error === "string";
  return <main><section className="hero shell"><div className="hero-copy"><p className="eyebrow">Clan Serran</p><h1>Amigo invisible<br />en familia.</h1><p>Un lugar privado para preparar el grupo, compartir preferencias y descubrir a quién regalas. Sin correos, sin líos y desde el móvil.</p><SocialSignIn callbackURL={destination} disabled={!configured} microsoftError={microsoftError} />{!configured && <div className="notice" role="status"><strong>Falta conectar la aplicación.</strong><p className="small muted">Configura Neon y las credenciales OAuth siguiendo el README para habilitar el acceso.</p></div>}</div></section><section className="shell page"><div className="grid two"><article className="card stack"><Users aria-hidden="true" size={28} /><h2>1. Reunid al grupo</h2><p className="muted">Crea un grupo y comparte el enlace o el código de seis dígitos.</p></article><article className="card stack"><Gift aria-hidden="true" size={28} /><h2>2. Preparad el regalo</h2><p className="muted">Cada persona guarda sus preferencias y confirma el regalo del año anterior.</p></article><article className="card stack"><CheckCircle2 aria-hidden="true" size={28} /><h2>3. Sorteo privado</h2><p className="muted">Cuando todos estén listos, cada persona ve exclusivamente su destinatario.</p></article><article className="card soft stack"><h2>¿Todo listo?</h2><p>Accede con tu cuenta habitual de Google o Microsoft.</p><span className="cluster"><ArrowRight aria-hidden="true" /> Una sola acción para empezar</span></article></div></section></main>;
}
