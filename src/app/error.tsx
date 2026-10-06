"use client";

import { CircleAlert } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="shell page"><div className="narrow card stack"><CircleAlert aria-hidden="true" size={32} /><h1>Algo no ha salido bien</h1><p className="muted">No se ha realizado ningún cambio incompleto. Puedes volver a intentarlo.</p><button className="button" type="button" onClick={reset}>Reintentar</button></div></main>;
}
