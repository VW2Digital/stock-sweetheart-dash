- [Multi-Gateway Card Fallback](mem://features/fallback-multi-gateway) — Re-try same card on MP→Pagar.me→Asaas after issuer rejection, via `gatewayOverride`

- [Admin Multi-Currency](mem://features/admin/moeda-multipla) — BRL/USD/EUR/GBP visual switcher in admin header with editable rates (gateways still BRL)
- [Public Currency](mem://features/moeda-publica-por-idioma) — Site público troca moeda conforme idioma (pt→R$, en→US$, es→€) via exchangerate.host com cache 24h
- [Footer Logos](mem://features/admin/logos-rodape-dinamicos) — Tabela `footer_logos` com upload/reorder via /admin/configuracoes/rodape; fallback para assets estáticos