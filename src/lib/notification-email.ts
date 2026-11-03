export type DrawEmailContent = {
  giverName: string;
  groupName: string;
  recipientName: string;
  favoriteColor: string | null;
  topSize: string | null;
  bottomSize: string | null;
  shoeSize: string | null;
  giftNotes: string | null;
  budget: string | null;
  exchangeDate: string | null;
  resultUrl: string;
  isReroll: boolean;
};

export type TransactionalEmail = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]!);
}

function present(value: string | null) {
  return value?.trim() || "No indicado";
}

function formatBudget(value: string | null) {
  if (!value) return null;
  return Number(value).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function buildDrawResultEmail(input: DrawEmailContent): TransactionalEmail {
  const budget = formatBudget(input.budget);
  const exchangeDate = formatDate(input.exchangeDate);
  const rows = [
    ["Color favorito", present(input.favoriteColor)],
    ["Talla de arriba", present(input.topSize)],
    ["Talla de abajo", present(input.bottomSize)],
    ["Calzado (talla europea)", present(input.shoeSize)],
    ["Ideas de regalo", present(input.giftNotes)],
  ];
  const groupDetails = [budget && `Presupuesto: ${budget}`, exchangeDate && `Fecha: ${exchangeDate}`].filter(Boolean) as string[];
  const textRows = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
  const detailsText = groupDetails.length ? `\n${groupDetails.join("\n")}\n` : "";
  const resultNotice = input.isReroll
    ? "El grupo ha repetido el sorteo. Tu resultado anterior ya no es válido."
    : `El sorteo de ${input.groupName} ya se ha realizado.`;

  const text = `AmigoInvisibleClan

Hola, ${input.giverName}:

${resultNotice}

Te toca regalar a: ${input.recipientName}

Preferencias de ${input.recipientName}:
${textRows}
${detailsText}
Consultar resultado actualizado: ${input.resultUrl}

Las preferencias pueden cambiar. Consulta la web antes de comprar el regalo.

Este es un mensaje automático relacionado con tu participación en el grupo.`;

  const preferenceRows = rows.map(([label, value]) => `
    <tr>
      <th align="left" style="padding:10px 12px;border-top:1px solid #e5e5e5;font-size:15px;line-height:1.4;color:#555;font-weight:600;">${escapeHtml(label)}</th>
      <td style="padding:10px 12px;border-top:1px solid #e5e5e5;font-size:16px;line-height:1.4;color:#111;">${escapeHtml(value)}</td>
    </tr>`).join("");
  const detailParagraph = groupDetails.length
    ? `<p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#333;">${groupDetails.map(escapeHtml).join("<br>")}</p>`
    : "";

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;color:#111;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Tu resultado ya está disponible.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f4;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #dedede;border-radius:10px;">
        <tr><td style="padding:30px 26px;">
          <p style="margin:0 0 26px;font-size:22px;line-height:1.2;font-weight:700;">AmigoInvisibleClan</p>
          <p style="margin:0 0 16px;font-size:17px;line-height:1.6;">Hola, ${escapeHtml(input.giverName)}:</p>
          <p style="margin:0 0 20px;font-size:17px;line-height:1.6;">${input.isReroll ? "El grupo ha repetido el sorteo. <strong>Tu resultado anterior ya no es válido.</strong>" : `El sorteo de <strong>${escapeHtml(input.groupName)}</strong> ya se ha realizado.`}</p>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.4;color:#555;">Te toca regalar a</p>
          <p style="margin:0 0 24px;font-size:28px;line-height:1.2;font-weight:700;">${escapeHtml(input.recipientName)}</p>
          <p style="margin:0 0 10px;font-size:17px;line-height:1.4;font-weight:700;">Preferencias para el regalo</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-bottom:1px solid #e5e5e5;">${preferenceRows}
          </table>
          ${detailParagraph}
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;"><tr><td style="border-radius:8px;background:#111;">
            <a href="${escapeHtml(input.resultUrl)}" style="display:inline-block;padding:14px 18px;color:#fff;text-decoration:none;font-size:16px;font-weight:700;">Consultar resultado actualizado</a>
          </td></tr></table>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#555;">Las preferencias pueden cambiar. Consulta la web antes de comprar el regalo.</p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#666;">Este es un mensaje automático relacionado con tu participación en el grupo.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return {
    subject: input.isReroll ? "Tu resultado de Amigo Invisible ha cambiado" : "Tu resultado de Amigo Invisible ya está disponible",
    html,
    text,
  };
}
