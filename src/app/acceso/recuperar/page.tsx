import Link from "next/link";
import { RecoveryForm } from "@/components/local-access";

export const dynamic = "force-dynamic";

export default function RecoverAccessPage() {
  return <main className="shell page"><div className="narrow stack"><Link href="/acceso">Volver al acceso</Link><div><p className="eyebrow">Último recurso</p><h1>Recuperar acceso</h1></div><div className="notice"><strong>Necesitarás el código que guardaste al registrarte.</strong><p className="small muted">Al establecer una contraseña nueva se cerrarán las sesiones anteriores y recibirás otro código.</p></div><section className="card"><RecoveryForm /></section></div></main>;
}
