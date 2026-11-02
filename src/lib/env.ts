import { z } from "zod";

const canonicalUrlSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  return value === url.origin && (url.protocol === "https:" || (isLoopback && url.protocol === "http:"));
}, "Debe ser un origen HTTPS sin ruta, parámetros ni barra final (se permite HTTP solo en local).");

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: canonicalUrlSchema,
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  MICROSOFT_CLIENT_ID: z.string().min(1),
  MICROSOFT_CLIENT_SECRET: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const emailEnvSchema = z.object({
  BREVO_API_KEY: z.string().min(1),
  BREVO_SENDER_EMAIL: z.string().email(),
  BREVO_REPLY_TO_EMAIL: z.string().email(),
});

export type EmailEnv = z.infer<typeof emailEnvSchema>;

export function getServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Configuración incompleta. Revisa estas variables privadas: ${missing}`);
  }
  return result.data;
}

export function isServerConfigured(source: NodeJS.ProcessEnv = process.env) {
  return serverEnvSchema.safeParse(source).success;
}

export function getEmailEnv(source: NodeJS.ProcessEnv = process.env): EmailEnv | null {
  const values = {
    BREVO_API_KEY: source.BREVO_API_KEY,
    BREVO_SENDER_EMAIL: source.BREVO_SENDER_EMAIL,
    BREVO_REPLY_TO_EMAIL: source.BREVO_REPLY_TO_EMAIL,
  };
  if (Object.values(values).every((value) => !value)) return null;
  const result = emailEnvSchema.safeParse(values);
  if (!result.success) {
    const invalid = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Configuración incompleta. Revisa estas variables privadas: ${invalid}`);
  }
  return result.data;
}
