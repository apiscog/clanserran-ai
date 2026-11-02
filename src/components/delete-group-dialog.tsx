"use client";

import { useActionState, useRef } from "react";
import { LoaderCircle, Trash2, TriangleAlert } from "lucide-react";
import { useFormStatus } from "react-dom";
import { deleteGroupAction } from "@/app/actions";
import { initialActionState } from "@/lib/validation";

function ConfirmDeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button danger" type="submit" disabled={pending}>
      {pending ? <LoaderCircle aria-hidden="true" size={20} /> : <Trash2 aria-hidden="true" size={20} />}
      {pending ? "Eliminando…" : "Eliminar grupo"}
    </button>
  );
}

export function DeleteGroupDialog({ groupId, groupName }: { groupId: string; groupName: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action] = useActionState(deleteGroupAction, initialActionState);

  return (
    <>
      <button className="button danger" type="button" onClick={() => dialogRef.current?.showModal()}>
        <Trash2 aria-hidden="true" size={20} /> Borrar grupo
      </button>
      <dialog className="confirmation-dialog" ref={dialogRef} aria-labelledby="delete-group-title" aria-describedby="delete-group-description">
        <form action={action} className="stack">
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="confirm" value="yes" />
          <div className="cluster danger-heading">
            <TriangleAlert aria-hidden="true" size={28} />
            <h2 id="delete-group-title">¿Eliminar «{groupName}»?</h2>
          </div>
          <p id="delete-group-description">Se eliminarán participantes, preferencias, exclusiones y resultados del sorteo. Esta acción no se puede deshacer.</p>
          {state.status === "error" && <p className="error" role="alert">{state.message}</p>}
          <div className="dialog-actions">
            <button className="button secondary" type="button" autoFocus onClick={() => dialogRef.current?.close()}>Cancelar</button>
            <ConfirmDeleteButton />
          </div>
        </form>
      </dialog>
    </>
  );
}
