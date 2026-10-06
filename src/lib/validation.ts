import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);

export const profileSchema = z.object({ name: z.string().trim().min(2, "Escribe al menos 2 caracteres.").max(80) });

export const createGroupSchema = z.object({
  name: z.string().trim().min(3, "Escribe al menos 3 caracteres.").max(100),
  budget: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{1,6}([.,]\d{1,2})?$/.test(value), "Indica un importe válido, por ejemplo 30."),
  exchangeDate: z.string().refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Indica una fecha válida."),
});

export const preferencesSchema = z.object({
  groupId: z.string().uuid(),
  favoriteColor: z.string().trim().min(1, "Elige una respuesta.").max(80),
  topSize: z.string().trim().min(1, "Elige una respuesta.").max(80),
  bottomSize: z.string().trim().min(1, "Elige una respuesta.").max(80),
  shoeSize: z.string().trim().min(1, "Elige una respuesta.").max(80),
  giftNotes: optionalText(1000),
});

export type ActionState = { status: "idle" | "error" | "success"; message?: string; fields?: Record<string, string> };

export const initialActionState: ActionState = { status: "idle" };

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}
