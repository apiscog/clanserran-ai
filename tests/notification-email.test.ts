import test from "node:test";
import assert from "node:assert/strict";
import { isDeliverableEmail } from "../src/lib/email-address";
import { buildDrawResultEmail } from "../src/lib/notification-email";

test("solo considera entregables los correos reales y verificados", () => {
  assert.equal(isDeliverableEmail("persona@example.com", true), true);
  assert.equal(isDeliverableEmail("persona@example.com", false), false);
  assert.equal(isDeliverableEmail("cuenta@users.invalid", true), false);
  assert.equal(isDeliverableEmail("sin-arroba", true), false);
});

test("genera un correo privado, legible y escapado", () => {
  const email = buildDrawResultEmail({
    giverName: "Ana <script>",
    groupName: "Familia & amigos",
    recipientName: "Bea <b>",
    favoriteColor: "Azul",
    topSize: "M",
    bottomSize: "40",
    shoeSize: "39",
    giftNotes: "Libros & plantas",
    budget: "35.00",
    exchangeDate: "2030-12-24",
    resultUrl: "https://clanserranai.vercel.app/grupos/00000000-0000-4000-8000-000000000000/resultado",
  });

  assert.equal(email.subject, "Tu resultado de Amigo Invisible ya está disponible");
  assert.doesNotMatch(email.subject, /Bea/);
  assert.match(email.html, /AmigoInvisibleClan/);
  assert.match(email.html, /Ana &lt;script&gt;/);
  assert.match(email.html, /Bea &lt;b&gt;/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.text, /Te toca regalar a: Bea <b>/);
  assert.match(email.text, /35,00 €/);
  assert.match(email.text, /24 de diciembre de 2030/);
});
