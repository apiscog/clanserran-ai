import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, CircleDashed, ClipboardCheck, Euro, Gift, LockKeyhole, UserMinus, Users } from "lucide-react";
import { closeRegistrationsAction, leaveGroupAction, removeMemberAction, reopenRegistrationsAction } from "@/app/actions";
import { DrawForm, PreferencesForm, PreviousForm, ShareInvite } from "@/components/action-forms";
import { getServerEnv } from "@/lib/env";
import { getGroupPage } from "@/lib/queries";
import { requireUser } from "@/lib/session";

const statusLabel = { open: "Inscripciones abiertas", closed: "Lista cerrada, pendiente del sorteo", drawn: "Sorteo realizado" } as const;

export const dynamic = "force-dynamic";

function ReadyStatus({ gift, annual, status }: { gift: boolean; annual: boolean; status: "open" | "closed" | "drawn" }) {
  if (status === "drawn") return <span className="status"><CheckCircle2 aria-hidden="true" size={18} /> Sorteo realizado</span>;
  if (!gift) return <span className="status"><CircleDashed aria-hidden="true" size={18} /> Pendiente de datos del regalo</span>;
  if (status !== "open" && !annual) return <span className="status"><CircleDashed aria-hidden="true" size={18} /> Pendiente de confirmar el año anterior</span>;
  return <span className="status"><CheckCircle2 aria-hidden="true" size={18} /> {status === "open" ? "Datos del regalo completados" : "Listo para el sorteo"}</span>;
}

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const currentUser = await requireUser();
  const { groupId } = await params;
  const { group, members, current, isAdmin } = await getGroupPage(groupId, currentUser.id);
  const completedGiftData = members.filter((member) => member.giftDataCompleted).length;
  const ready = members.filter((member) => member.giftDataCompleted && member.previousAnswerConfirmed).length;
  const memberFingerprint = members.map((member) => member.userId).sort().join(",");
  const inviteUrl = `${getServerEnv().BETTER_AUTH_URL}/invitacion/${group.inviteToken}`;

  return (
    <main className="shell page stack">
      <Link className="cluster" href="/inicio"><ArrowLeft aria-hidden="true" size={20} /> Mis grupos</Link>
      <section className="stack">
        <div><p className="eyebrow">{statusLabel[group.status]}</p><h1>{group.name}</h1></div>
        <div className="cluster muted">
          {group.budget && <span className="cluster"><Euro aria-hidden="true" size={18} /> {Number(group.budget).toLocaleString("es-ES", { style: "currency", currency: "EUR" })} por regalo</span>}
          {group.exchangeDate && <span className="cluster"><CalendarDays aria-hidden="true" size={18} /> {new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${group.exchangeDate}T00:00:00Z`))}</span>}
        </div>
      </section>

      {group.status === "drawn" && <Link className="button" href={`/grupos/${groupId}/resultado`}><Gift aria-hidden="true" size={20} /> Ver a quién regalo</Link>}

      {group.status === "open" && (
        <section className="card stack">
          <div><p className="eyebrow">Invitar</p><h2>Comparte el grupo</h2></div>
          <p className="muted">Código de acceso</p>
          <p className="code" aria-label={`Código ${group.joinCode.split("").join(" ")}`}>{group.joinCode}</p>
          <ShareInvite url={inviteUrl} />
        </section>
      )}

      <section className="card stack" aria-labelledby="participants">
        <div className="spread"><div><p className="eyebrow">Participantes</p><h2 id="participants">Lista del grupo</h2></div><Users aria-hidden="true" /></div>
        {group.status === "open" && <p><strong>{completedGiftData} de {members.length}</strong> participantes han completado sus datos.</p>}
        {group.status === "closed" && <p><strong>{ready} de {members.length}</strong> participantes están listos.</p>}
        {group.status === "drawn" && <p><strong>Sorteo realizado</strong> para {members.length} participantes.</p>}
        <ul className="member-list">
          {members.map((member) => (
            <li className="member" key={member.userId}>
              <div className="stack"><strong>{member.name}{member.userId === currentUser.id ? " (tú)" : ""}</strong><ReadyStatus gift={member.giftDataCompleted} annual={member.previousAnswerConfirmed} status={group.status} /></div>
              {isAdmin && group.status === "open" && member.userId !== group.adminId && (
                <form action={removeMemberAction}><input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="memberId" value={member.userId} /><button className="button danger" type="submit"><UserMinus aria-hidden="true" size={18} /> Retirar</button></form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack">
        <div><p className="eyebrow">Tus preferencias</p><h2>Datos del regalo</h2></div>
        <p className="muted">Puedes actualizarlos incluso después del sorteo. Solo los verá la persona que te regala.</p>
        <PreferencesForm groupId={groupId} values={current} />
      </section>

      {group.status === "closed" && (
        <section className="card stack"><div><p className="eyebrow">Exclusión anual</p><h2>Confirma el año anterior</h2></div><PreviousForm groupId={groupId} members={members} current={current} /></section>
      )}

      {isAdmin && group.status === "open" && (
        <section className="card stack">
          <div><p className="eyebrow">Administración</p><h2>Cerrar inscripciones</h2></div>
          <p className="muted">Comprueba los nombres. Después ya no se podrá entrar ni salir.</p>
          <details><summary>Revisar los {members.length} nombres</summary><ul>{members.map((member) => <li key={member.userId}>{member.name}</li>)}</ul></details>
          <form action={closeRegistrationsAction} className="stack">
            <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="memberFingerprint" value={memberFingerprint} />
            <label className="cluster"><input type="checkbox" name="confirm" value="yes" required /> Confirmo que la lista es correcta.</label>
            <button className="button" type="submit"><LockKeyhole aria-hidden="true" size={20} /> Cerrar inscripciones</button>
          </form>
        </section>
      )}

      {isAdmin && group.status === "closed" && (
        <section className="card stack">
          <div><p className="eyebrow">Administración</p><h2>Preparar el sorteo</h2></div>
          {ready === members.length && members.length >= 3 ? (
            <><div className="notice"><strong>Lista definitiva</strong><ul>{members.map((member) => <li key={member.userId}>{member.name}</li>)}</ul></div><DrawForm groupId={groupId} memberFingerprint={memberFingerprint} /></>
          ) : (
            <p className="notice"><ClipboardCheck aria-hidden="true" size={20} /> El sorteo se activará cuando haya al menos 3 participantes y todos estén listos.</p>
          )}
          <form action={reopenRegistrationsAction}><input type="hidden" name="groupId" value={groupId} /><button className="button secondary" type="submit">Reabrir inscripciones</button></form>
          <p className="hint">Reabrir borra las confirmaciones del año anterior, pero conserva las preferencias.</p>
        </section>
      )}

      {group.status === "open" && !isAdmin && <form action={leaveGroupAction}><input type="hidden" name="groupId" value={groupId} /><button className="button danger" type="submit">Salir del grupo</button></form>}
    </main>
  );
}
