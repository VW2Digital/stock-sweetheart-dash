# Passo a passo — Rodar o `install.sh` na VPS

Guia operacional rápido para provisionar a aplicação em uma VPS Ubuntu/Debian zerada usando `deploy-vps/install.sh`.

> Para a documentação completa do que o script faz, veja [`INSTALL.md`](./INSTALL.md).

---

## 1. Antes de começar — checklist

Tenha em mãos:

- [ ] **VPS** Ubuntu 20.04+ ou Debian 11+ com acesso `root` (via `sudo`).
- [ ] **DNS** já apontando para o IP da VPS:
  - `DOMAIN` (ex: `luminaeliberty.com`) → registro A
  - `API_DOMAIN` (ex: `api.luminaeliberty.com`) → registro A
- [ ] **Portas liberadas** no firewall do provedor cloud: `22, 80, 443, 465, 587`.
- [ ] **URL do repositório Git** (`GIT_REPO_URL`) — público ou com token embutido se privado.
- [ ] **Supabase Access Token** pessoal (`sbp_...`) — gere em https://supabase.com/dashboard/account/tokens
- [ ] **Supabase Project Ref** do projeto do cliente (ex: `ntlfjekvisepsusbcjsv`).
- [ ] **Credenciais SMTP Hostinger**: e-mail (`SMTP_USER`) e senha (`SMTP_PASS`).

> As chaves `anon` e `service_role` são buscadas automaticamente via Supabase Management API. **Não cole chaves na mão.**

---

## 2. Conectar na VPS

```bash
ssh root@SEU_IP_DA_VPS
# ou, se usa usuário não-root:
ssh ubuntu@SEU_IP_DA_VPS
```

---

## 3. Baixar e executar o instalador

### Opção A — Modo interativo (recomendado)

O script vai pedir cada variável em prompts:

```bash
curl -fsSL "https://raw.githubusercontent.com/VW2Digital/prod-pal-admin/main/deploy-vps/install.sh?v=$(date +%s)" -o /tmp/install.sh \
  && sudo bash /tmp/install.sh
```

Responda na ordem que o script perguntar:

1. `GIT_REPO_URL`
2. `SUPABASE_ACCESS_TOKEN`
3. `SUPABASE_PROJECT_REF`
4. `DOMAIN`
5. `API_DOMAIN`
6. `SMTP_USER`
7. `SMTP_PASS`

### Opção B — Modo não-interativo (CI / automação)

```bash
sudo GIT_REPO_URL="https://github.com/VW2Digital/prod-pal-admin.git" \
     SUPABASE_ACCESS_TOKEN="sbp_xxx" \
     SUPABASE_PROJECT_REF="ntlfjekvisepsusbcjsv" \
     DOMAIN="luminaeliberty.com" \
     API_DOMAIN="api.luminaeliberty.com" \
     SMTP_USER="contato@luminaeliberty.com" \
     SMTP_PASS="senha-smtp" \
     bash /tmp/install.sh
```

---

## 4. Acompanhar a instalação

Em outro terminal SSH, se quiser ver o log ao vivo:

```bash
sudo tail -f /var/log/install-vvc.log
```

O script executa, em ordem:

1. Instala dependências (`nginx`, `certbot`, `nodejs 20`, `supabase-cli`, `jq`, `ufw`).
2. Configura firewall UFW.
3. Clona/atualiza o repositório em `/opt/app`.
4. Sobrescreve `.env` com as credenciais do cliente.
5. Builda o frontend (`npm install` + `npm run build`) — cria swap temporário se VPS tem <1.5 GB RAM.
6. Publica em `/var/www/app/dist`.
7. Deploya as Edge Functions detectadas em `supabase/functions/*`.
8. Configura SMTP + URLs públicas como secrets no Supabase.
9. Cria vhosts Nginx (`app-spa.conf` e `app-api.conf`).
10. Emite SSL via Let's Encrypt.
11. Roda checklist final (7 verificações).

Tempo típico: **5–10 minutos** numa VPS pequena.

---

## 5. Validar após a instalação

Ao terminar, o script imprime um resumo `PASS/FAIL`. Verifique também manualmente:

```bash
# Nginx ativo?
sudo systemctl status nginx

# SPA respondendo?
curl -I https://SEU_DOMINIO

# API proxy respondendo?
curl -I https://api.SEU_DOMINIO

# Edge Functions deployadas?
sudo supabase functions list --project-ref SEU_PROJECT_REF
```

Abra `https://SEU_DOMINIO` no navegador — a aplicação deve carregar.

---

## 6. Atualizações futuras (sem reinstalar)

Para puxar mudanças novas do repositório após edits na Lovable:

```bash
cd /opt/app
sudo bash deploy-vps/deploy.sh
```

Esse script só faz `git pull` + rebuild + publish, preservando o `.env`.

---

## 7. Problemas comuns

| Problema | Solução |
|---|---|
| Script trava no meio | `sudo tail -200 /var/log/install-vvc.log` |
| `npm run build` falhou | `cat /var/log/install-vvc-build.log` |
| SSL não emitiu | Confirme DNS (`dig SEU_DOMINIO`) e rode `sudo certbot --nginx -d SEU_DOMINIO -d www.SEU_DOMINIO` |
| API retorna 502 | `sudo nginx -t && sudo systemctl reload nginx` |
| Edge Function faltando | Confirme que existe `supabase/functions/<nome>/index.ts` no repo |
| Token Supabase rejeitado | O token precisa ter permissão no `SUPABASE_PROJECT_REF` informado |
| Repositório privado | Use URL com token: `https://USER:TOKEN@github.com/org/repo.git` |

---

## 8. Reinstalar do zero

Se precisar limpar tudo e recomeçar:

```bash
sudo bash /opt/app/deploy-vps/uninstall.sh
# depois rode novamente o install.sh
```

---

**Arquivos relacionados:**
- [`install.sh`](./install.sh) — instalador principal (não alterar)
- [`deploy.sh`](./deploy.sh) — atualização rápida pós-instalação
- [`uninstall.sh`](./uninstall.sh) — remoção completa
- [`issue-ssl.sh`](./issue-ssl.sh) — re-emissão manual de SSL
- [`check-vps.sh`](./check-vps.sh) — diagnóstico geral
- [`INSTALL.md`](./INSTALL.md) — documentação técnica completa
