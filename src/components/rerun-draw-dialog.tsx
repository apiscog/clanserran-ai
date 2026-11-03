"use client";

import { useActionState, useRef } from "react";
import { LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { useFormStatus } from "react-dom";
import { rerunDrawAction } from "@/app/actions";
import { initialActionState } from "@/lib/validation";

function ConfirmRerunButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button warning" type="submit" disabled={pending}>
      {pending ? <LoaderCircle aria-hidden="true" size={20} /> : <RefreshCw aria-hidden="true" size={20} />}
      {pending ? "Repitiendo sorteo…" : "Sí, repetir sorteo"}
    </button>
  );
}

export function RerunDrawDialog({ groupId, groupName }: { groupId: string; groupName: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(rerunDrawAction, initialActionState);

  return (
    <>
      <button className="button warning" type="button" onClick={() => dialogRef.current?.showModal()}>
        <TriangleAlert aria-hidden="true" size={20} /> Repetir sorteo una última vez
      </button>
      <dialog className="confirmation-dialog" ref={dialogRef} aria-labelledby="rerun-draw-title" aria-describedby="rerun-draw-description">
        <form action={action} className="stack">
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="confirm" value="yes" />
          <div className="cluster warning-heading">
            <TriangleAlert aria-hidden="true" size={28} />
            <h2 id="rerun-draw-title">¿Repetir el sorteo de «{groupName}»?</h2>
          </div>
          <div id="rerun-draw-description" className="stack dialog-copy">
            <p>Se invalidarán todas las asignaciones actuales y se creará un sorteo independiente.</p>
            <p>Algunas personas podrían obtener nuevamente el mismo destinatario. Los correos anteriores no pueden retirarse y se enviará un nuevo aviso con el resultado actualizado.</p>
            <p><strong>Esta acción solo puede realizarse una vez.</strong></p>
          </div>
          {state.status === "error" && <p className="error" role="alert">{state.message}</p>}
          {state.status === "success" && <p className="success" role="status">{state.message}</p>}
          <div className="dialog-actions">
            <button className="button secondary" type="button" autoFocus onClick={() => dialogRef.current?.close()}>Cancelar</button>
            <ConfirmRerunButton />
          </div>
        </form>
      </dialog>
    </>
  );
}
