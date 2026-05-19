#!/usr/bin/env node
/**
 * Verifica se todas as chaves de tradução usadas no código (via t('...') ou t("..."))
 * existem nos arquivos pt.json, en.json e es.json.
 *
 * Uso:
 *   node scripts/check-translations.mjs
 *
 * Sai com código 1 se encontrar chaves faltando ou órfãs (apenas avisos).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC_DIR = join(ROOT, "src");
const LOCALES_DIR = join(SRC_DIR, "i18n", "locales");
const LOCALES = ["pt", "en", "es"];
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);

// Captura t('chave'), t("chave"), t(`chave`) e também {t('chave', {...})}
// Ignora chaves dinâmicas (template literals com ${...} ou variáveis).
const T_CALL_RE = /\bt\(\s*(['"`])([A-Za-z0-9_.\-]+)\1/g;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      walk(full, files);
    } else if (EXTS.has(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

function loadLocale(lang) {
  const path = join(LOCALES_DIR, `${lang}.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flatten(v, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

function extractKeys(files) {
  const used = new Map(); // key -> Set(files)
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    let m;
    T_CALL_RE.lastIndex = 0;
    while ((m = T_CALL_RE.exec(src)) !== null) {
      const key = m[2];
      if (!used.has(key)) used.set(key, new Set());
      used.get(key).add(file.replace(ROOT + "/", ""));
    }
  }
  return used;
}

function hasLocaleKey(locale, key) {
  return key in locale || `${key}_one` in locale || `${key}_other` in locale;
}

function main() {
  const files = walk(SRC_DIR);
  const usedKeys = extractKeys(files);

  const locales = {};
  for (const lang of LOCALES) {
    locales[lang] = flatten(loadLocale(lang));
  }

  let missingCount = 0;
  const missingByLang = Object.fromEntries(LOCALES.map((l) => [l, []]));

  for (const [key, where] of usedKeys) {
    for (const lang of LOCALES) {
      if (!hasLocaleKey(locales[lang], key)) {
        missingByLang[lang].push({ key, where: [...where] });
        missingCount++;
      }
    }
  }

  // Chaves órfãs: existem no pt.json mas nunca são usadas no código.
  const orphans = Object.keys(locales.pt).filter((k) => {
    const base = k.replace(/_(one|other)$/, "");
    return !usedKeys.has(k) && !usedKeys.has(base);
  });

  console.log(`\nVerificação de traduções`);
  console.log(`   Arquivos analisados : ${files.length}`);
  console.log(`   Chaves usadas no app: ${usedKeys.size}`);
  for (const lang of LOCALES) {
    console.log(`   Chaves em ${lang}.json    : ${Object.keys(locales[lang]).length}`);
  }

  let hasError = false;
  for (const lang of LOCALES) {
    const miss = missingByLang[lang];
    if (miss.length === 0) {
      console.log(`\nOK ${lang}.json: todas as chaves usadas existem.`);
    } else {
      hasError = true;
      console.log(`\nERRO ${lang}.json: ${miss.length} chave(s) faltando:`);
      for (const { key, where } of miss) {
        console.log(`   - ${key}`);
        for (const f of where.slice(0, 3)) console.log(`       em ${f}`);
        if (where.length > 3) console.log(`       ... +${where.length - 3} arquivo(s)`);
      }
    }
  }

  if (orphans.length > 0) {
    console.log(`\nAVISO ${orphans.length} chave(s) órfã(s) em pt.json (não referenciadas no código):`);
    for (const k of orphans.slice(0, 20)) console.log(`   - ${k}`);
    if (orphans.length > 20) console.log(`   ... +${orphans.length - 20}`);
  }

  console.log("");
  if (hasError) {
    console.error(`Falha: ${missingCount} entrada(s) de tradução faltando.`);
    process.exit(1);
  }
  console.log("Tudo certo!");
}

main();