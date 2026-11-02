import type { EmailEnv } from "@/lib/env";
import type { TransactionalEmail } from "@/lib/notification-email";

export type EmailRecipient = { email: string; name: string };

export interface EmailTransport {
  send(input: { recipient: EmailRecipient; message: TransactionalEmail; idempotencyKey: string }): Promise<{ messageId: string }>;
}

export class EmailTransportError extends Error {
  constructor(readonly code: string) {
    super("El proveedor de correo no ha aceptado el mensaje.");
    this.name = "EmailTransportError";
  }
}

export function createBrevoTransport(env: EmailEnv): EmailTransport {
  return {
    async send({ recipient, message, idempotencyKey }) {
      let response: Response;
      try {
        response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            accept: "application/json",
            "api-key": env.BREVO_API_KEY,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender: { name: "AmigoInvisibleClan", email: env.BREVO_SENDER_EMAIL },
            replyTo: { name: "AmigoInvisibleClan", email: env.BREVO_REPLY_TO_EMAIL },
            to: [{ ...recipient, contactPixelTrackingConsent: false }],
            subject: message.subject,
            htmlContent: message.html,
            textContent: message.text,
            headers: { IdempotencyKey: idempotencyKey },
            tags: ["resultado-amigo-invisible"],
          }),
          signal: AbortSignal.timeout(12_000),
          cache: "no-store",
        });
      } catch (error) {
        throw new EmailTransportError(error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "network_error");
      }

      if (!response.ok) throw new EmailTransportError(`http_${response.status}`);
      const payload: unknown = await response.json().catch(() => null);
      const messageId = payload && typeof payload === "object" && "messageId" in payload
        ? (payload as { messageId?: unknown }).messageId
        : null;
      if (typeof messageId !== "string" || !messageId) throw new EmailTransportError("invalid_response");
      return { messageId };
    },
  };
}
