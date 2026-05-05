import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  encodeMimeSubject,
  htmlToPlainText,
  normalizeEmailSubject,
  sanitizeEmailHtml,
  sanitizeEmailText,
} from "./mime.ts";

const FORWARDED_SUBJECT = "u=c3=a1rios de Tirze + B=c3=b4nus?=";
const FORWARDED_TEXT = [
  "Content-Type: text/plain; charset=UTF-8",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "Ol=c3=a1 Liberty e Lumina,",
  "Este =c3=a9 um email autom=c3=a1tico para usu=c3=a1rios.",
  "Pagamento n=c3=a3o aprovado. B=c3=b4nus liberado.",
].join("\n");
const FORWARDED_HTML = [
  "Content-Type: text/html; charset=UTF-8",
  "Content-Transfer-Encoding: quoted-printable",
  "",
  "<html><head></head><body>",
  "<p>Ol=c3=a1 usu=c3=a1rios! B=c3=b4nus dispon=c3=advel.</p>",
  "<p>Este =c3=a9 um email autom=c3=a1tico, n=c3=a3o responda.</p>",
  "</body></html>",
].join("\n");

function assertNoQuotedPrintableArtifacts(value: string, label: string) {
  assert(
    !/=c3=/i.test(value),
    `${label} ainda contém sequência quoted-printable bruta: ${value}`,
  );
  assert(
    !/=[0-9a-f]{2}/i.test(value.replace(/=\?[^?]+\?[bq]\?[^?]+\?=/gi, "")),
    `${label} ainda contém bytes quoted-printable: ${value}`,
  );
}

Deno.test("encaminhamento: assunto quoted-printable é normalizado", () => {
  const normalized = normalizeEmailSubject(FORWARDED_SUBJECT);
  assertEquals(normalized, "Usuários de Tirze + Bônus");
  assertNoQuotedPrintableArtifacts(normalized, "subject");
});

Deno.test("encaminhamento: assunto reenviado é codificado em RFC 2047", () => {
  const encoded = encodeMimeSubject(FORWARDED_SUBJECT);
  assert(encoded.startsWith("=?UTF-8?Q?"), `esperado encoded-word, recebi: ${encoded}`);
  assert(encoded.endsWith("?="), `encoded-word mal terminado: ${encoded}`);
  // Q-encoding deve usar hex MAIÚSCULO (=C3=A1). Falha se aparecer minúsculo (=c3=a1).
  assert(!/=c3=/.test(encoded), `encoded-word contém bytes minúsculos brutos: ${encoded}`);
});

Deno.test("encaminhamento: corpo text/plain é decodificado para UTF-8", () => {
  const text = sanitizeEmailText(FORWARDED_TEXT);
  assertNoQuotedPrintableArtifacts(text, "text/plain");
  assertStringIncludes(text, "Olá Liberty e Lumina");
  assertStringIncludes(text, "Este é um email automático para usuários");
  assertStringIncludes(text, "Pagamento não aprovado");
  assertStringIncludes(text, "Bônus liberado");
  assert(!/Content-Type:/i.test(text), "headers MIME não devem aparecer no corpo");
  assert(!/Content-Transfer-Encoding:/i.test(text), "header CTE não deve aparecer no corpo");
});

Deno.test("encaminhamento: corpo text/html é decodificado para UTF-8", () => {
  const html = sanitizeEmailHtml(FORWARDED_HTML);
  assertNoQuotedPrintableArtifacts(html, "text/html");
  assertStringIncludes(html, "Olá usuários");
  assertStringIncludes(html, "Bônus disponível");
  assertStringIncludes(html, "automático");
  assert(!/Content-Type:/i.test(html), "headers MIME não devem aparecer no HTML");

  const plain = htmlToPlainText(html);
  assertNoQuotedPrintableArtifacts(plain, "html→plain");
  assertStringIncludes(plain, "Olá usuários");
  assertStringIncludes(plain, "não responda");
});

Deno.test("encaminhamento: pipeline completo (subject + bodies) sem '=c3='", () => {
  const subject = encodeMimeSubject(FORWARDED_SUBJECT);
  const text = sanitizeEmailText(FORWARDED_TEXT);
  const html = sanitizeEmailHtml(FORWARDED_HTML);
  for (const [label, value] of [
    ["subject", normalizeEmailSubject(subject)],
    ["text", text],
    ["html", html],
  ] as const) {
    assertNoQuotedPrintableArtifacts(value, label);
  }
});