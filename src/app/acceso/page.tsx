import Link from "next/link";
import { KeyRound, LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";
import { LocalRegistration, LocalSignIn } from "@/components/local-access";
import { getSession } from "@/lib/session";
import { invitationTokenFromDestination, safeDestination } from "@/lib/safe-destination";

export const dynamic = "force-dynamic";

export default async function LocalAccessPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const destination = safeDestination((await searchParams).next);
  if (await getSession()) redirect(destination);
  const inviteToken = invitationTokenFromDestination(destination);

  return <main className="shell page"><div className="narrow stack"><Link href="/">Volver al inicio</Link><div><p className="eyebrow">Clan Serran</p><h1>Acceso sin correo</h1></div><section className="card stack"><div className="cluster"><KeyRound aria-hidden="true" size={28} /><h2>Ya tengo usuario</h2></div><LocalSignIn callbackURL={destination} /></section>{inviteToken ? <section className="card soft stack"><div className="cluster"><LockKeyhole aria-hidden="true" size={28} /><div><p className="eyebrow">Primera vez</p><h2>Crear acceso para esta invitación</h2></div></div><p>Elige un usuario y una contraseña. No necesitas una dirección de correo.</p><LocalRegistration inviteToken={inviteToken} /></section> : <div className="notice"><strong>¿Es tu primera vez?</strong><p className="small muted">Abre el enlace de invitación que te haya compartido tu familia para crear el acceso.</p></div>}</div></main>;
}
