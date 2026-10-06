import Link from "next/link";

export default function NotFound() {
  return <main className="shell page"><div className="narrow card stack"><p className="eyebrow">404</p><h1>No encontramos esa página</h1><p className="muted">Puede que el enlace ya no sea válido o que no tengas acceso.</p><Link className="button" href="/inicio">Volver al inicio</Link></div></main>;
}
