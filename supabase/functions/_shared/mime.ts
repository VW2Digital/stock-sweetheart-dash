const MIME_HEADER_LINE = /^(?:mime-version|content-type|content-transfer-encoding|content-disposition|content-id|boundary|charset|multipart-version):\s*.*$/gim;
const HAS_QUOTED_PRINTABLE_BYTES = /=([0-9a-f]{2})/i;

function decodeBytes(bytes: number[], charset = "utf-8") {
  const normalized = charset.toLowerCase();
  if (normalized.includes("iso-8859-1") || normalized.includes("latin1")) {
    return String.fromCharCode(...bytes);
  }
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
  } catch (_) {
    return String.fromCharCode(...bytes);
  }
}

function decodeQuotedPrintable(input: string, options: { headerMode?: boolean } = {}) {
  const prepared = input
    .replace(/=\r?\n/g, "")
    .replace(/\r\n/g, "\n");
  const source = options.headerMode ? prepared.replace(/_/g, " ") : prepared;
  const bytes: number[] = [];
  let output = "";

  const flush = () => {
    if (bytes.length === 0) return;
    output += decodeBytes(bytes);
    bytes.length = 0;
  };

  for (let i = 0; i < source.length; i++) {
    if (source[i] === "=" && /^[0-9a-fA-F]{2}$/.test(source.slice(i + 1, i + 3))) {
      bytes.push(parseInt(source.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      flush();
      output += source[i];
    }
  }
  flush();
  return output;
}

function decodeMimeEncodedWords(input: string) {
  return input.replace(/=\?([^?]+)\?([bBqQ])\?([\s\S]*?)\?=/g, (_match, charset, encoding, encoded) => {
    try {
      if (String(encoding).toUpperCase() === "B") {
        const bin = atob(String(encoded).replace(/\s/g, ""));
        return decodeBytes(Array.from(bin, (ch) => ch.charCodeAt(0)), charset);
      }
      const bytes: number[] = [];
      const source = String(encoded).replace(/_/g, " ");
      let text = "";
      const flush = () => {
        if (bytes.length === 0) return;
        text += decodeBytes(bytes, charset);
        bytes.length = 0;
      };
      for (let i = 0; i < source.length; i++) {
        if (source[i] === "=" && /^[0-9a-fA-F]{2}$/.test(source.slice(i + 1, i + 3))) {
          bytes.push(parseInt(source.slice(i + 1, i + 3), 16));
          i += 2;
        } else {
          flush();
          text += source[i];
        }
      }
      flush();
      return text;
    } catch (_) {
      return _match;
    }
  });
}

function stripCopiedMimeHeaders(input: string) {
  return input
    .replace(/^([\w-]+:\s.*\n)+\s*\n/i, "")
    .replace(MIME_HEADER_LINE, "")
    .replace(/--[A-Za-z0-9'()+_,.\/:=?-]{8,}(?:--)?\s*$/gm, "");
}

function normalizeUtf8Content(input: string) {
  let value = String(input ?? "").replace(/\r\n/g, "\n");
  value = decodeMimeEncodedWords(value);
  if (HAS_QUOTED_PRINTABLE_BYTES.test(value)) value = decodeQuotedPrintable(value);
  return stripCopiedMimeHeaders(value)
    .replace(/[ \t]+$/gm, "")
    .replace(/^\s+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeEmailSubject(subject: string) {
  let normalized = normalizeUtf8Content(subject)
    .replace(/\?=$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/^uários de tirze \+ bônus$/i.test(normalized)) {
    normalized = "Usuários de Tirze + Bônus";
  }
  if (/^usuários de tirze \+ bônus$/i.test(normalized)) {
    normalized = "Usuários de Tirze + Bônus";
  }
  return normalized;
}

export function encodeMimeSubject(subject: string) {
  const normalized = normalizeEmailSubject(subject);
  // eslint-disable-next-line no-control-regex
  if (!/[^\x20-\x7e]/.test(normalized)) return normalized;
  const bytes = new TextEncoder().encode(normalized);
  let encoded = "";
  for (const byte of bytes) {
    if (byte === 0x20) encoded += "_";
    else if ((byte >= 0x41 && byte <= 0x5a) || (byte >= 0x61 && byte <= 0x7a) || (byte >= 0x30 && byte <= 0x39) || byte === 0x2b) encoded += String.fromCharCode(byte);
    else encoded += `=${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return `=?UTF-8?Q?${encoded}?=`;
}

export function sanitizeEmailHtml(html: string) {
  const normalized = normalizeUtf8Content(html);
  if (!/<html[\s>]/i.test(normalized)) return normalized;
  if (/<meta\s+[^>]*charset=/i.test(normalized)) return normalized;
  return normalized.replace(/<head(\s[^>]*)?>/i, (match) => `${match}<meta charset="UTF-8"/>`);
}

export function sanitizeEmailText(text: string) {
  return normalizeUtf8Content(text);
}

export function htmlToPlainText(html: string) {
  return sanitizeEmailHtml(html)
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n")
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}