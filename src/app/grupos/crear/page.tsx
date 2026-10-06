import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreateGroupForm } from "@/components/action-forms";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CreateGroupPage() {
  await requireUser();
  return <main className="shell page"><div className="narrow stack"><Link className="cluster" href="/inicio"><ArrowLeft aria-hidden="true" size={20} /> Volver al inicio</Link><div><p className="eyebrow">Nuevo grupo</p><h1>Crear grupo</h1></div><p className="muted">Serás la persona administradora y también participarás en el sorteo.</p><div className="card"><CreateGroupForm /></div></div></main>;
}
