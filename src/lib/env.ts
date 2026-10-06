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
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Configuración incompleta. Revisa estas variables privadas: ${missing}`);
  }
  return result.data;
}

export function isServerConfigured() {
  return serverEnvSchema.safeParse(process.env).success;
}
