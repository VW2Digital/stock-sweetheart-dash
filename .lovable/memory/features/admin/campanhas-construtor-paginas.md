---
name: Construtor de páginas de campanhas relâmpago
description: Sistema de blocos arrastáveis (vídeo, benefícios, bônus, garantia, depoimentos, prova social, FAQ) e barra de CTA fixa nas páginas /relampago/:slug
type: feature
---
- Coluna `flash_campaigns.blocks` (jsonb) guarda lista ordenada de blocos: `{ id, type, visible, data }`.
- Tipos de blocos: `video` (YouTube/Vimeo/MP4), `image`, `benefits`, `bonus`, `guarantee`, `testimonials`, `social_proof`, `faq`.
- Editor admin: `src/components/admin/FlashCampaignBlocksEditor.tsx` usa `@dnd-kit` para arrastar e reordenar, com cards colapsáveis e toggle de visibilidade por bloco.
- Renderer público: `src/components/FlashCampaignBlocksRenderer.tsx` renderiza entre a headline/CTA e o final, herdando a cor de destaque (`accent_color`).
- CTA flutuante: colunas `floating_cta_enabled` e `floating_cta_text`. Barra fixa no rodapé com contador regressivo abreviado quando ativa.
