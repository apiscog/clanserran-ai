import { z } from "zod";

export const USERNAME_MIN_LENGTH = 4;
export const USERNAME_MAX_LENGTH = 24;
export const PASSWORD_MIN_LENGTH = 4;
export const PASSWORD_MAX_LENGTH = 128;

const reservedUsernames = new Set(["admin", "administrador", "clanserran", "soporte", "support", "root"]);

export function normalizeUsername(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .pipe(
    z
      .string()
      .min(USERNAME_MIN_LENGTH, `El usuario necesita al menos ${USERNAME_MIN_LENGTH} caracteres.`)
      .max(USERNAME_MAX_LENGTH, `El usuario admite como máximo ${USERNAME_MAX_LENGTH} caracteres.`)
      .regex(/^[a-z][a-z0-9]*$/, "El usuario debe empezar por una letra y usar solo letras y números.")
      .refine((value) => !reservedUsernames.has(value), "Este nombre de usuario está reservado."),
  );

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `La contraseña necesita al menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(PASSWORD_MAX_LENGTH, `La contraseña admite como máximo ${PASSWORD_MAX_LENGTH} caracteres.`)
  .regex(/[a-z]/, "Añade al menos una letra minúscula.")
  .regex(/[A-Z]/, "Añade al menos una letra mayúscula.")
  .regex(/[0-9]/, "Añade al menos un número.");

export const localRegistrationSchema = z
  .object({
    name: z.string().trim().min(2, "Escribe al menos 2 caracteres.").max(80, "El nombre es demasiado largo."),
    username: usernameSchema,
    password: passwordSchema,
    passwordConfirmation: z.string(),
    inviteToken: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/, "La invitación no es válida."),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Las contraseñas no coinciden.",
  });

export const localSignInSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "Escribe tu contraseña."),
});

export function normalizeRecoveryCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z2-9]/g, "");
}

export const recoverySchema = z
  .object({
    username: usernameSchema,
    recoveryCode: z.string().transform(normalizeRecoveryCode).pipe(z.string().length(16, "El código de recuperación no es válido.")),
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Las contraseñas no coinciden.",
  });

export function passwordChecks(password: string) {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  };
}
