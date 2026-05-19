# Documentação — `deploy-vps/install.sh`

Instalador profissional de produção para VPS Ubuntu/Debian. Provisiona, em uma única execução, **frontend SPA estático (React/Vite)** servido por **Nginx**, com backend em **Supabase** (Edge Functions + Auth + DB) e **SMTP Hostinger** já configurado nos secrets.

> ⚠️ **Status:** versão final aprovada em produção. Não deve ser alterada sem pedido explícito.

---

## 1. O que o script faz (visão geral)

1. **Log persistente** em `/var/log/install-vvc.log` com rotação (5 versões, 5 MB cada) e redaction automática de segredos (SMTP_PASS, Access Token, JWTs).
2. **Coleta de inputs** interativa ou via variáveis de ambiente.
3. **Busca automática** das chaves `anon` e `service_role` via **Supabase Management API** usando o `SUPABASE_ACCESS_TOKEN` (você nunca cola chaves na mão).
4. Instala pacotes do sistema: `nginx`, `certbot`, `ufw`, `nodejs 20`, `supabase-cli`, `jq`, etc.
5. Configura **firewall UFW** (apenas 22, 80, 443, 465, 587).
6. **Clona/atualiza** o repositório em `/opt/app`.
7. **Sobrescreve** o `.env` com as credenciais do cliente (nunca usa o `.env` do repositório).
8. **Build do frontend** (`npm install` + `npm run build`) com proteção contra OOM (swap temporário de 2 GB em VPS pequena).
9. **Publicação atômica** em `/var/www/app/dist`.
10. **Deploy dinâmico das Edge Functions** — detecta `supabase/functions/*/index.ts` e implanta cada uma; ignora diretórios `_shared`.
11. Grava **secrets SMTP + URLs públicas** no Supabase (`SMTP_HOST`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS`, `PUBLIC_SITE_URL`, `PUBLIC_API_URL`).
12. Cria 2 vhosts Nginx:
    - **`app-spa.conf`** → serve a SPA estática (gzip, cache imutável em `/assets/`, SPA fallback, headers de segurança).
    - **`app-api.conf`** → proxy `https://API_DOMAIN/` → `https://<ref>.supabase.co/functions/v1/`.
13. Emite **SSL Let's Encrypt** (best-effort, não falha o script).
14. **Checklist final** com 7 verificações reais (Nginx ativo, loopback SPA, SPA fallback, loopback API, acesso público, HTTPS, portas inesperadas).

---

## 2. Pré-requisitos

| Requisito | Detalhe |
|---|---|
| SO | Ubuntu 20.04+ ou Debian 11+ |
| Acesso | `root` (rode com `sudo`) |
| DNS | `DOMAIN` e `API_DOMAIN` apontando para o IP da VPS (necessário para SSL) |
| Portas | 80, 443, 465 e 587 liberadas no provedor cloud |
| Supabase | Projeto já criado + Access Token com permissão no projeto |
| SMTP | Conta Hostinger válida (`smtp.hostinger.com:465`) |

---

## 3. Variáveis de entrada

Todas podem ser passadas via prompt interativo ou via variáveis de ambiente.

| Variável | Descrição | Exemplo |
|---|---|---|
| `GIT_REPO_URL` | URL do repositório Git | `https://github.com/user/repo.git` |
| `SUPABASE_ACCESS_TOKEN` | Token pessoal Supabase (`sbp_...`) | `sbp_abc123...` |
| `SUPABASE_PROJECT_REF` | Ref do projeto Supabase | `ntlfjekvisepsusbcjsv` |
| `DOMAIN` | Domínio principal | `luminaeliberty.com` |
| `API_DOMAIN` | Subdomínio da API | `api.luminaeliberty.com` |
| `SMTP_USER` | E-mail SMTP Hostinger | `contato@dominio.com` |
| `SMTP_PASS` | Senha SMTP | — |

As chaves `anon` e `service_role` são obtidas automaticamente — **não pergunte ao usuário**.

---

## 4. Uso

### Modo interativo (recomendado)
```bash
sudo bash deploy-vps/install.sh
```

### Modo não-interativo (CI/automação)
```bash
sudo GIT_REPO_URL="https://github.com/user/repo.git" \
     SUPABASE_ACCESS_TOKEN="sbp_xxx" \
     SUPABASE_PROJECT_REF="ntlfjekvisepsusbcjsv" \
     DOMAIN="luminaeliberty.com" \
     API_DOMAIN="api.luminaeliberty.com" \
     SMTP_USER="contato@luminaeliberty.com" \
     SMTP_PASS="senha-smtp" \
     bash deploy-vps/install.sh
```

---

## 5. Estrutura resultante na VPS

```
/opt/app/                       # Código-fonte clonado
  ├── .env                      # Sobrescrito com creds do cliente (chmod 600)
  ├── dist/                     # Build do Vite
  └── supabase/functions/*      # Edge Functions deployadas

/var/www/app/dist/              # Frontend publicado (servido pelo Nginx)

/etc/nginx/sites-available/
  ├── app-spa.conf              # SPA estática (DOMAIN + www.DOMAIN)
  └── app-api.conf              # Proxy API → Supabase Functions (API_DOMAIN)

/var/log/install-vvc.log        # Log da instalação (com redaction)
/var/log/install-vvc-build.log  # Log completo do npm run build
```

---

## 6. Arquitetura de rede

```
        Internet
           │
   ┌───────┴────────┐
   │   Nginx :80/443│
   └───┬────────┬───┘
       │        │
DOMAIN │        │ API_DOMAIN
       │        │
   ┌───▼──┐  ┌──▼────────────────────────────────┐
   │ SPA  │  │ proxy_pass → supabase.co/         │
   │static│  │   functions/v1/<path>             │
   └──────┘  └───────────────────────────────────┘
```

- **Sem Node em produção** — não há processo escutando em `:3000`.
- Toda chamada de API do frontend vai direto ao Supabase OU pelo subdomínio `API_DOMAIN`.

---

## 7. Idempotência

O script pode ser executado várias vezes com segurança:
- Repositório já clonado → faz `git fetch && reset --hard origin/HEAD`.
- Vhosts existentes → sobrescritos.
- Edge Functions → redeploy sem efeito colateral.
- Build publicado atomicamente (`dist.new` → `mv` → `dist.old` → `rm`), sem janela de downtime.

Para apenas **atualizar código** depois (sem reinstalar tudo), use `deploy-vps/deploy.sh`.

---

## 8. Solução de problemas

| Sintoma | Onde olhar |
|---|---|
| Script falha no meio | `tail -200 /var/log/install-vvc.log` |
| Build falhou | `cat /var/log/install-vvc-build.log` |
| SSL não emitiu | Verifique DNS (`dig DOMAIN`) → rode `certbot --nginx -d DOMAIN` |
| API retorna 502 | `nginx -t && systemctl reload nginx`; testar `curl -I https://<ref>.supabase.co/functions/v1/` |
| Edge Function não foi deployada | Verifique se existe `supabase/functions/<nome>/index.ts` |
| `npm install` OOM | Script já cria swap automático em VPS <1.5 GB — confirme com `swapon --show` |
| Token rejeitado | Confirme que o `SUPABASE_ACCESS_TOKEN` tem permissão no `SUPABASE_PROJECT_REF` |

---

## 9. Segurança

- Logs filtram automaticamente `SMTP_PASS`, `SUPABASE_ACCESS_TOKEN` e JWTs (`eyJ...`).
- `.env` gravado com `chmod 600`.
- UFW bloqueia tudo exceto SSH, HTTP/S e SMTP.
- Headers Nginx: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`.
- Diretórios ocultos (`/\.`) negados.
- Vhosts antigos com `proxy_pass localhost:3000` são removidos automaticamente.

---

## 10. Checklist final (executado pelo script)

| # | Verificação |
|---|---|
| 1 | Nginx está ativo |
| 2 | Loopback SPA responde 200/301/302 |
| 3 | SPA fallback (`try_files`) entrega `index.html` |
| 4 | Loopback API responde 200/401/404 (proxy OK) |
| 5 | Acesso público ao `DOMAIN` |
| 6 | HTTPS público (se SSL emitido) |
| 7 | Nenhuma porta inesperada escutando |

Se algum item falhar, o script exibe contagem `PASS/FAIL` no fim mas **não desfaz** a instalação.

---

**Arquivos relacionados:**
- `deploy-vps/deploy.sh` — atualização rápida pós-instalação
- `deploy-vps/uninstall.sh` — remoção completa
- `deploy-vps/issue-ssl.sh` — re-emissão manual de SSL
- `deploy-vps/check-vps.sh` — diagnóstico
