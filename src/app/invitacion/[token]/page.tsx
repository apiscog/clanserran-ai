import Link from "next/link";
import { Gift, LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";
import { JoinInviteForm } from "@/components/action-forms";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) redirect("/unirse");
  const current = await getSession();
  if (!current) redirect(`/?next=${encodeURIComponent(`/invitacion/${token}`)}`);
  return <main className="shell page"><div className="narrow stack"><div><p className="eyebrow">Invitación privada</p><h1>Te han invitado</h1></div><div className="card stack"><Gift aria-hidden="true" size={32} /><h2>¿Quieres participar?</h2><p className="muted">Confirma para entrar. Abrir este enlace no te añade automáticamente.</p><JoinInviteForm token={token} /></div><p className="cluster small muted"><LockKeyhole aria-hidden="true" size={18} /> La información del grupo se mostrará después de unirte.</p><Link href="/inicio">Ahora no, volver al inicio</Link></div></main>;
}
