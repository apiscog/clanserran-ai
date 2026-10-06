"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Gift, LoaderCircle, Share2 } from "lucide-react";
import {
  createGroupAction,
  joinByCodeAction,
  joinByInviteAction,
  runDrawAction,
  savePreferencesAction,
  confirmPreviousAction,
  updateProfileAction,
} from "@/app/actions";
import { initialActionState, type ActionState } from "@/lib/validation";

function Feedback({ state }: { state: ActionState }) {
  if (state.status === "idle" || (!state.message && !state.fields)) return null;
  return <p className={state.status === "success" ? "success" : "error"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>;
}

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useActionStateStatus();
  return <button className="button" disabled={pending}>{pending && <LoaderCircle aria-hidden="true" size={20} />}{pending ? "Guardando…" : children}</button>;
}

// React expone el estado del formulario mediante useFormStatus; el alias mantiene los componentes legibles.
import { useFormStatus as useActionStateStatus } from "react-dom";

export function ProfileForm({ defaultName }: { defaultName: string }) {
  const [state, action] = useActionState(updateProfileAction, initialActionState);
  return <form action={action} className="stack">
    <div className="field"><label htmlFor="name">Nombre visible para la familia</label><input id="name" name="name" defaultValue={defaultName} maxLength={80} required /><span className="hint">Por ejemplo: Ana Serran</span>{state.fields?.name && <span className="field-error">{state.fields.name}</span>}</div>
    <Feedback state={state} /><Submit>Guardar nombre</Submit>
  </form>;
}

export function CreateGroupForm() {
  const [state, action] = useActionState(createGroupAction, initialActionState);
  return <form action={action} className="stack" noValidate>
    <div className="field"><label htmlFor="name">Nombre del grupo</label><input id="name" name="name" placeholder="Navidad familia 2026" required />{state.fields?.name && <span className="field-error">{state.fields.name}</span>}</div>
    <div className="field"><label htmlFor="budget">Presupuesto por regalo <span className="muted">(opcional)</span></label><input id="budget" name="budget" inputMode="decimal" placeholder="30" aria-describedby="budget-hint" /><span id="budget-hint" className="hint">Importe en euros.</span>{state.fields?.budget && <span className="field-error">{state.fields.budget}</span>}</div>
    <div className="field"><label htmlFor="exchangeDate">Fecha de intercambio <span className="muted">(opcional)</span></label><input id="exchangeDate" name="exchangeDate" type="date" />{state.fields?.exchangeDate && <span className="field-error">{state.fields.exchangeDate}</span>}</div>
    <Feedback state={state} /><Submit>Crear grupo</Submit>
  </form>;
}

export function JoinCodeForm() {
  const [state, action] = useActionState(joinByCodeAction, initialActionState);
  return <form action={action} className="stack" noValidate>
    <div className="field"><label htmlFor="code">Código de 6 dígitos</label><input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="004218" required />{state.fields?.code && <span className="field-error">{state.fields.code}</span>}</div>
    <label className="cluster"><input type="checkbox" name="confirm" value="yes" required /> Confirmo que quiero unirme al grupo.</label>
    {state.fields?.confirm && <span className="field-error">{state.fields.confirm}</span>}<Feedback state={state} /><Submit>Unirme al grupo</Submit>
  </form>;
}

export function JoinInviteForm({ token }: { token: string }) {
  const [state, action] = useActionState(joinByInviteAction, initialActionState);
  return <form action={action} className="stack"><input type="hidden" name="token" value={token} /><label className="cluster"><input type="checkbox" name="confirm" value="yes" required /> Confirmo que quiero unirme a este grupo.</label>{state.fields?.confirm && <span className="field-error">{state.fields.confirm}</span>}<Feedback state={state} /><Submit>Aceptar invitación</Submit></form>;
}

type Preferences = { favoriteColor: string | null; topSize: string | null; bottomSize: string | null; shoeSize: string | null; giftNotes: string | null };
export function PreferencesForm({ groupId, values }: { groupId: string; values: Preferences }) {
  const [state, action] = useActionState(savePreferencesAction, initialActionState);
  const fields = [
    ["favoriteColor", "Color favorito", "Por ejemplo: verde oscuro"],
    ["topSize", "Talla de arriba", "Por ejemplo: M, 40 o Prefiero no indicarlo"],
    ["bottomSize", "Talla de abajo", "Por ejemplo: 42 o No lo sé"],
    ["shoeSize", "Número de calzado (talla europea)", "Por ejemplo: 39 o Prefiero no indicarlo"],
  ] as const;
  return <form action={action} className="stack" noValidate><input type="hidden" name="groupId" value={groupId} />{fields.map(([name, label, placeholder]) => <div className="field" key={name}><label htmlFor={name}>{label}</label><input id={name} name={name} defaultValue={values[name] ?? ""} placeholder={placeholder} required />{state.fields?.[name] && <span className="field-error">{state.fields[name]}</span>}</div>)}<div className="field"><label htmlFor="giftNotes">Ideas de regalo o cosas que prefieres evitar <span className="muted">(opcional)</span></label><textarea id="giftNotes" name="giftNotes" defaultValue={values.giftNotes ?? ""} maxLength={1000} /></div><Feedback state={state} /><Submit>Guardar mis datos</Submit></form>;
}

export function PreviousForm({ groupId, members, current }: { groupId: string; members: { userId: string; name: string }[]; current: { userId: string; previousAnswerKind: string | null; previousRecipientId: string | null } }) {
  const [state, action] = useActionState(confirmPreviousAction, initialActionState);
  const initial = current.previousAnswerKind === "participant" ? current.previousRecipientId ?? "" : current.previousAnswerKind ?? "";
  return <form action={action} className="stack"><input type="hidden" name="groupId" value={groupId} /><div className="field"><label htmlFor="answer">¿A quién regalaste el año pasado?</label><select id="answer" name="answer" defaultValue={initial} required><option value="" disabled>Selecciona una respuesta</option>{members.filter((m) => m.userId !== current.userId).map((m) => <option value={m.userId} key={m.userId}>{m.name}</option>)}<option value="not_participated">No participé / No lo recuerdo</option><option value="absent">Esa persona no participa este año</option></select><span className="hint">La exclusión solo se aplica en esta dirección.</span></div><Feedback state={state} /><Submit>Confirmar respuesta</Submit></form>;
}

export function DrawForm({ groupId, memberFingerprint }: { groupId: string; memberFingerprint: string }) {
  const [state, action] = useActionState(runDrawAction, initialActionState);
  return <form action={action} className="stack"><input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="memberFingerprint" value={memberFingerprint} /><label className="cluster"><input type="checkbox" name="confirm" value="yes" required /> He revisado la lista definitiva y quiero realizar el sorteo.</label><Feedback state={state} /><button className="button" type="submit"><Gift aria-hidden="true" size={20} /> Realizar sorteo</button></form>;
}

export function ShareInvite({ url }: { url: string }) {
  const [message, setMessage] = useState("");
  async function copy() { await navigator.clipboard.writeText(url); setMessage("Enlace copiado."); }
  async function share() { if (navigator.share) await navigator.share({ title: "Clan Serran", text: "Únete a nuestro amigo invisible", url }); else await copy(); }
  return <div className="stack"><div className="cluster"><button className="button secondary" type="button" onClick={copy}><Copy aria-hidden="true" size={19} /> Copiar invitación</button><button className="button secondary" type="button" onClick={share}><Share2 aria-hidden="true" size={19} /> Compartir / WhatsApp</button></div>{message && <p className="success" role="status"><Check aria-hidden="true" size={18} /> {message}</p>}</div>;
}
