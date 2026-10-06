import Link from "next/link";
import { ArrowLeft, CalendarDays, Euro, Gift, Palette, Ruler, Shirt } from "lucide-react";
import { getPrivateResult } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ResultPage({ params }: { params: Promise<{ groupId: string }> }) {
  const currentUser = await requireUser();
  const { groupId } = await params;
  const result = await getPrivateResult(groupId, currentUser.id);
  return <main className="shell page"><div className="narrow stack"><Link className="cluster" href={`/grupos/${groupId}`}><ArrowLeft aria-hidden="true" size={20} /> Volver al grupo</Link><div><p className="eyebrow">Tu resultado privado</p><h1>Regalas a…</h1></div><section className="card result stack"><Gift aria-hidden="true" size={34} /><h2>{result.recipientName}</h2><p className="muted">Estas preferencias siempre muestran su versión más reciente.</p><div className="grid two"><p className="cluster"><Palette aria-hidden="true" /> <span><strong>Color favorito</strong><br />{result.favoriteColor}</span></p><p className="cluster"><Shirt aria-hidden="true" /> <span><strong>Talla de arriba</strong><br />{result.topSize}</span></p><p className="cluster"><Ruler aria-hidden="true" /> <span><strong>Talla de abajo</strong><br />{result.bottomSize}</span></p><p className="cluster"><Ruler aria-hidden="true" /> <span><strong>Calzado (EU)</strong><br />{result.shoeSize}</span></p></div>{result.giftNotes && <div className="notice"><strong>Ideas y cosas que prefiere evitar</strong><p>{result.giftNotes}</p></div>}</section><section className="card soft stack"><h3>{result.groupName}</h3>{result.budget && <p className="cluster"><Euro aria-hidden="true" size={19} /> Presupuesto: {Number(result.budget).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</p>}{result.exchangeDate && <p className="cluster"><CalendarDays aria-hidden="true" size={19} /> Fecha: {new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${result.exchangeDate}T00:00:00Z`))}</p>}</section><p className="small muted">Solo tú puedes consultar esta asignación tras iniciar sesión. Ni siquiera la persona administradora dispone de una vista global.</p></div></main>;
}
