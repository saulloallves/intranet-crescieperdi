# Multi-stage build para aplicação React (Vite)
# --- Stage 1: Build ---
FROM node:20-alpine AS build
WORKDIR /app

# Dependências
COPY package.json package-lock.json* bun.lockb* ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copia código
COPY . .

# Args para injetar variáveis Vite (VITE_*)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Build
RUN npm run build

# --- Stage 2: Runtime ---
FROM nginx:1.27-alpine AS runtime
WORKDIR /usr/share/nginx/html

# Remove conteúdo padrão
RUN rm -rf ./*

# Copia artefatos
COPY --from=build /app/dist .

# Configuração nginx SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -qO- http://localhost/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
