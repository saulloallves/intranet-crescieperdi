# Deploy em VPS (Ubuntu) com Docker + Nginx Reverso

## 1. Pré-requisitos VPS

- Ubuntu 22.04+ atualizado
- Acesso sudo
- Docker e Docker Compose instalados
- Nginx já atuando como proxy reverso de outras apps
- Certbot (para HTTPS) já configurado

## 2. Variáveis de Ambiente

Defina no arquivo `.env` (mesmo diretório do `docker-compose.yml`):

```bash
VITE_SUPABASE_URL=https://SEU_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=SEU_ANON_KEY
```

Essas variáveis são incorporadas em build (Vite inlining). Para alterar depois, é necessário rebuild da imagem.

## 3. Construir e subir container

```bash
docker network create intranet_net  # se ainda não existir
export VITE_SUPABASE_URL=https://SEU_PROJECT.supabase.co
export VITE_SUPABASE_ANON_KEY=SEU_ANON_KEY
docker compose build --no-cache
docker compose up -d
```

Verifique:

```bash
docker ps
curl http://localhost:8084/health
```

## 4. Bloco Nginx (host) - /etc/nginx/sites-available/intranet.conf

```nginx
server {
  server_name intranet.seudominio.com;

  # HTTPS (assumindo que Certbot gerará certificados)
  listen 80;
  listen 443 ssl http2;
  ssl_certificate /etc/letsencrypt/live/intranet.seudominio.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/intranet.seudominio.com/privkey.pem;

  # Segurança básica
  add_header X-Frame-Options SAMEORIGIN;
  add_header X-Content-Type-Options nosniff;
  add_header Referrer-Policy same-origin;
  add_header Permissions-Policy "interest-cohort=()";

  location / {
    proxy_pass http://127.0.0.1:8084;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 60s;
  }

  # Cache estático (opcional)
  location ~* \.(?:js|css|png|jpg|jpeg|gif|svg|ico|webp)$ {
    proxy_pass http://127.0.0.1:8084;
    expires 7d;
    access_log off;
  }
}
```

Ative e teste:

```bash
sudo ln -s /etc/nginx/sites-available/intranet.conf /etc/nginx/sites-enabled/intranet.conf
sudo nginx -t && sudo systemctl reload nginx
```

## 5. Renovação de Certificados

Se ainda não tiver certificados:

```bash
sudo certbot --nginx -d intranet.seudominio.com --redirect --agree-tos -m seu-email@dominio.com
```

## 6. Atualização da Aplicação

```bash
git pull
docker compose build
docker compose up -d
```

Para limpar imagens antigas:

```bash
docker image prune -f
```

## 7. Troubleshooting

| Problema | Ação |
|----------|------|
| 404 em rotas internas | Verificar fallback SPA no nginx.conf do container |
| Erros Supabase (401) | Conferir se chave ANON e URL estão corretas |
| Build falha por dependências | Atualizar lock / executar `npm install` local e commitar package-lock.json |
| Cache não atualiza | Invalidar com ?v=timestamp ou alterar nome dos assets (build novo já faz) |

## 8. Boas Práticas

- Não expor chave service do Supabase no frontend
- Usar somente ANON KEY
- Rebuild sempre que variáveis VITE_* mudarem
- Monitorar logs: `docker logs -f intranet-crescieperdi`
- Healthcheck exposto em `/health`

## 9. Próximos Passos

- Adicionar observabilidade (Prometheus + Grafana)
- Rate limiting com Nginx / Cloudflare
- WAF e fail2ban no servidor

---
Guia criado para padronizar deploy desta intranet em produção.
