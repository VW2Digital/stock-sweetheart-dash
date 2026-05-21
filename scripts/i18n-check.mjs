#!/usr/bin/env node
/**
 * Verificador de traduções i18next.
 *
 * - Lê src/i18n/locales/{pt-PT,es,en}.json
 * - Faz varrimento em src/ por chamadas t('chave') ou t("chave")
 * - Reporta:
 *    [missing-in-locale] chaves presentes em pelo menos 1 idioma mas em falta noutro
 *    [missing-in-code]   chaves usadas no código mas inexistentes em qualquer JSON
 *    [unused]            chaves nos JSONs nunca usadas no código
 *
 * Códigos de saída:
 *   0 → tudo OK
 *   1 → encontrou problemas bloqueantes (chaves usadas sem tradução)
 *
 * Uso:
 *   node scripts/i18n-check.mjs            # imprime relatório
 *   node scripts/i18n-check.mjs --strict   # falha também em diferenças entre locales
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LOCALES_DIR = path.join(ROOT, 'src/i18n/locales');
const SRC_DIR = path.join(ROOT, 'src');
const LOCALES = ['es', 'en'];
const STRICT = process.argv.includes('--strict');

const loadLocale = (lng) => {
  const file = path.join(LOCALES_DIR, `${lng}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};

const dicts = Object.fromEntries(LOCALES.map((l) => [l, loadLocale(l)]));

// Sufixos de pluralização do i18next v21+ (CLDR).
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];
const stripPlural = (k) => {
  for (const s of PLURAL_SUFFIXES) if (k.endsWith(s)) return k.slice(0, -s.length);
  return k;
};
// Achatar objetos aninhados em chaves "a.b.c"
const flatten = (obj, prefix = '', out = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
};
const flatDicts = Object.fromEntries(
  LOCALES.map((l) => [l, flatten(dicts[l])]),
);
const hasKey = (dict, key) =>
  key in dict || PLURAL_SUFFIXES.some((s) => `${key}${s}` in dict);

const allKeys = new Set(
  LOCALES.flatMap((l) => Object.keys(flatDicts[l]).map(stripPlural)),
);

// Coleta de chaves usadas no código. Aceita t('x'), t("x"), t(`x`).
// Ignora chamadas dinâmicas como t(variavel).
const KEY_RE = /(?<![A-Za-z0-9_$])t\(\s*['"`]([A-Za-z0-9_.:-]+)['"`]/g;
const usedKeys = new Map(); // key -> Set(file)

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (/\.(t|j)sx?$/.test(entry.name)) {
      // Ignora os próprios JSON e o setup
      if (full.includes(`${path.sep}i18n${path.sep}locales${path.sep}`)) continue;
      const src = fs.readFileSync(full, 'utf8');
      let m;
      while ((m = KEY_RE.exec(src)) !== null) {
        const key = m[1];
        // Ignora pseudo-chaves óbvias
        if (key.length < 2 || key.includes(' ')) continue;
        if (!usedKeys.has(key)) usedKeys.set(key, new Set());
        usedKeys.get(key).add(path.relative(ROOT, full));
      }
    }
  }
}
walk(SRC_DIR);

const usedSet = new Set(usedKeys.keys());

const missingInLocale = {}; // locale -> [keys]
for (const lng of LOCALES) {
  missingInLocale[lng] = [...allKeys].filter((k) => !hasKey(flatDicts[lng], k)).sort();
}

const missingInCode = [...usedSet].filter((k) => !allKeys.has(k)).sort();
const unused = [...allKeys].filter((k) => !usedSet.has(k) && !usedSet.has(stripPlural(k))).sort();

const total = (arr) => (arr.length === 0 ? '\x1b[32m0\x1b[0m' : `\x1b[33m${arr.length}\x1b[0m`);

console.log('\n=== Verificador i18n ===');
console.log(`Chaves únicas em JSONs: ${allKeys.size}`);
console.log(`Chaves usadas em código: ${usedSet.size}`);

for (const lng of LOCALES) {
  console.log(`\n[missing-in-locale:${lng}] ${total(missingInLocale[lng])}`);
  missingInLocale[lng].slice(0, 50).forEach((k) => console.log(`  - ${k}`));
  if (missingInLocale[lng].length > 50) console.log(`  … (+${missingInLocale[lng].length - 50})`);
}

console.log(`\n[missing-in-code] (usadas mas sem tradução) ${total(missingInCode)}`);
missingInCode.forEach((k) => {
  const where = [...(usedKeys.get(k) || [])].slice(0, 3).join(', ');
  console.log(`  - ${k}  →  ${where}`);
});

console.log(`\n[unused] (definidas mas nunca usadas) ${total(unused)}`);
unused.slice(0, 50).forEach((k) => console.log(`  - ${k}`));
if (unused.length > 50) console.log(`  … (+${unused.length - 50})`);

const hardFail = missingInCode.length > 0;
const softFail = LOCALES.some((l) => missingInLocale[l].length > 0);

if (hardFail) {
  console.error('\n✖ Existem chaves usadas no código sem tradução. A falhar.');
  process.exit(1);
}
if (STRICT && softFail) {
  console.error('\n✖ Modo --strict: existem diferenças entre locales.');
  process.exit(1);
}
console.log('\n✓ Verificação concluída.');