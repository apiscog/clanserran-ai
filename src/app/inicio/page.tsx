import Link from "next/link";
import { CalendarDays, CirclePlus, DoorOpen, Euro, Gift, ShieldCheck, Users } from "lucide-react";
import { ProfileForm } from "@/components/action-forms";
import { SignOut } from "@/components/sign-out";
import { getMyGroups, getOwnProfile } from "@/lib/queries";
import { requireUser } from "@/lib/session";

const statusLabel = { open: "Inscripciones abiertas", closed: "Lista cerrada, pendiente del sorteo", drawn: "Sorteo realizado" } as const;

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const currentUser = await requireUser();
  const [myGroups, profile] = await Promise.all([getMyGroups(currentUser.id), getOwnProfile(currentUser.id)]);

  return (
    <main className="shell page stack">
      <div className="spread">
        <div><p className="eyebrow">Tu espacio</p><h1>Hola, {profile.name}</h1></div>
        <SignOut />
      </div>

      {!profile.displayNameConfirmed && (
        <section className="card stack">
          <div><p className="eyebrow">Primer acceso</p><h2>Confirma cómo te verá la familia</h2></div>
          <ProfileForm defaultName={profile.name} />
        </section>
      )}

      <div className="grid two">
        <Link className="card stack" href="/grupos/crear"><CirclePlus aria-hidden="true" size={28} /><h2>Crear grupo</h2><p className="muted">Prepara una nueva celebración.</p></Link>
        <Link className="card stack" href="/unirse"><DoorOpen aria-hidden="true" size={28} /><h2>Unirme a un grupo</h2><p className="muted">Usa el código que te han compartido.</p></Link>
      </div>

      <section className="stack" aria-labelledby="groups-title">
        <div><p className="eyebrow">Resumen</p><h2 id="groups-title">Mis grupos</h2></div>
        {myGroups.length === 0 ? (
          <div className="card soft stack"><Users aria-hidden="true" size={28} /><h3>Todavía no tienes grupos</h3><p className="muted">Crea el primero o únete con una invitación familiar.</p></div>
        ) : (
          <div className="grid two">
            {myGroups.map((group) => (
              <Link className="card stack" href={`/grupos/${group.id}`} key={group.id}>
                <div className="spread"><h3>{group.name}</h3>{group.adminId === currentUser.id && <span className="status"><ShieldCheck aria-hidden="true" size={17} /> Administras</span>}</div>
                <span className="status"><Gift aria-hidden="true" size={18} /> {statusLabel[group.status]}</span>
                {group.budget && <span className="cluster muted small"><Euro aria-hidden="true" size={17} /> {Number(group.budget).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</span>}
                {group.exchangeDate && <span className="cluster muted small"><CalendarDays aria-hidden="true" size={17} /> {new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${group.exchangeDate}T00:00:00Z`))}</span>}
              </Link>
            ))}
          </div>
        )}
      </section>

      {profile.displayNameConfirmed && (
        <details className="card"><summary>Revisar mi nombre visible</summary><div className="stack"><p className="muted">Este nombre se muestra al resto de participantes.</p><ProfileForm defaultName={profile.name} /></div></details>
      )}
    </main>
  );
}
