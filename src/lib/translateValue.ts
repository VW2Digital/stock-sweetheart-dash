import i18n from '@/i18n';

/**
 * Normaliza um valor de DB para uma chave i18n estável:
 * "E-book PDF" -> "e_book_pdf"
 */
const slugify = (raw: string) =>
  raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/**
 * Tenta traduzir um valor textual vindo do DB usando o namespace
 * `productValue.<slug>`. Se a chave não existir, devolve o valor original.
 */
export const translateValue = (value?: string | null): string => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const key = `productValue.${slugify(trimmed)}`;
  const translated = i18n.t(key, { defaultValue: '' });
  return translated ? String(translated) : trimmed;
};
