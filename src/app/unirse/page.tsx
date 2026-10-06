import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { JoinCodeForm } from "@/components/action-forms";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  await requireUser();
  return <main className="shell page"><div className="narrow stack"><Link className="cluster" href="/inicio"><ArrowLeft aria-hidden="true" size={20} /> Volver al inicio</Link><div><p className="eyebrow">Invitación</p><h1>Unirme a un grupo</h1></div><div className="notice cluster"><LockKeyhole aria-hidden="true" /><span>El código solo sirve para solicitar la incorporación; no muestra información privada.</span></div><div className="card"><JoinCodeForm /></div></div></main>;
}
