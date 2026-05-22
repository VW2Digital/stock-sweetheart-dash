---
name: Logos dinâmicos do rodapé
description: Tabela footer_logos por categoria (payment/security/shipping) com upload em bucket footer-logos e fallback para assets estáticos quando vazio
type: feature
---
- Tabela `footer_logos` (category enum: payment|security|shipping, label, image_url, link_url, active, sort_order) com RLS: público lê ativos, admin gere tudo.
- Bucket Storage público `footer-logos` — apenas admin escreve.
- Admin UI: `FooterLogosManager` embutido em `/admin/configuracoes/rodape` (upload, reordenar, toggle ativo, editar label/link, remover).
- `Footer.tsx` carrega logos ativos; se categoria vazia, mostra os assets PNG estáticos antigos (Visa/Mastercard, selos SSL/Google, SEDEX/PAC/Jadlog/J&T).
- Atualizar `/mnt/documents/schema_supabase.sql` quando esta tabela mudar.
