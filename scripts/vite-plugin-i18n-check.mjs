/**
 * Vite plugin: corre o verificador i18n no início do build e ao guardar
 * ficheiros TS/TSX em dev. Em build, faz o build falhar se houver chaves
 * usadas no código sem tradução.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function runCheck({ strict = false, failOnError = true } = {}) {
  const args = ['scripts/i18n-check.mjs'];
  if (strict) args.push('--strict');
  const res = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (res.status !== 0 && failOnError) {
    throw new Error('[i18n-check] falhou — corrige as chaves em falta antes de continuar.');
  }
}

export default function i18nCheckPlugin(opts = {}) {
  let isBuild = false;
  return {
    name: 'i18n-check',
    apply: () => true,
    configResolved(cfg) {
      isBuild = cfg.command === 'build';
    },
    buildStart() {
      runCheck({ strict: opts.strict, failOnError: isBuild });
    },
    handleHotUpdate({ file }) {
      if (/\.(t|j)sx?$/.test(file) || /locales\/.+\.json$/.test(file)) {
        // Apenas avisa em dev — não bloqueia o HMR.
        runCheck({ strict: false, failOnError: false });
      }
    },
  };
}