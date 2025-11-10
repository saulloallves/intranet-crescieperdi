# ⚙️ Configuração Final do Cypress

## ✅ Arquivos Criados

Todos os arquivos do Cypress foram criados com sucesso:

- ✅ `cypress.config.ts` - Configuração principal com projectId
- ✅ `cypress/support/commands.ts` - Comandos customizados
- ✅ `cypress/support/e2e.ts` - Setup global
- ✅ `cypress/e2e/auth/login.cy.ts` - Testes de autenticação
- ✅ `cypress/e2e/mural/criar-post.cy.ts` - Testes de criação de posts
- ✅ `cypress/e2e/mural/responder-post.cy.ts` - Testes de respostas
- ✅ `cypress/e2e/admin/moderacao-mural.cy.ts` - Testes de moderação admin
- ✅ `cypress/fixtures/users.json` - Dados de usuários de teste
- ✅ `cypress/fixtures/mural-posts.json` - Dados de posts de exemplo
- ✅ `.github/workflows/cypress.yml` - CI/CD com GitHub Actions
- ✅ `cypress/README.md` - Documentação completa

## 🔧 Scripts para Adicionar ao package.json

**IMPORTANTE:** Adicione estes scripts na seção `"scripts"` do seu `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:dev": "vite build --mode development",
    "lint": "eslint .",
    "preview": "vite preview",
    
    "cypress:open": "cypress open",
    "cypress:run": "cypress run",
    "cypress:run:record": "cypress run --record --key e528c7ef-cb80-4a3a-9282-ad2c41a8c6ca",
    "test:e2e": "start-server-and-test dev http://localhost:8080 cypress:open",
    "test:e2e:ci": "start-server-and-test dev http://localhost:8080 cypress:run:record"
  }
}
```

## 🎯 Como Usar

### 1. Criar Usuários de Teste no Supabase

Execute este SQL no **Supabase SQL Editor**:

```sql
-- IMPORTANTE: Criar usuários de teste para Cypress
-- Estes usuários são necessários para os testes funcionarem

-- 1. Admin
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin@crescendoconectado.com',
  crypt('Admin@123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin Cypress"}',
  'authenticated',
  'authenticated'
);

-- 2. Curador
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'curador@crescendoconectado.com',
  crypt('Curador@123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Curador Cypress"}',
  'authenticated',
  'authenticated'
);

-- 3. Colaborador
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'colaborador@crescendoconectado.com',
  crypt('Colaborador@123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Colaborador Cypress"}',
  'authenticated',
  'authenticated'
);

-- 4. Atribuir roles aos usuários (ajustar conforme sua estrutura de roles)
-- Se você tiver uma tabela user_roles, adicione os roles apropriados aqui
```

### 2. Configurar Secret no GitHub (para CI/CD)

Se for usar CI/CD com GitHub Actions:

1. Vá em: **Repositório → Settings → Secrets and variables → Actions**
2. Clique em **New repository secret**
3. Adicione:
   - **Name:** `CYPRESS_RECORD_KEY`
   - **Value:** `e528c7ef-cb80-4a3a-9282-ad2c41a8c6ca`

4. Adicione também (se necessário):
   - **Name:** `VITE_SUPABASE_PUBLISHABLE_KEY`
   - **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnZWFidW54YXVuem9lZHd2dm94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5OTQ3ODEsImV4cCI6MjA3MjU3MDc4MX0.DCnflwz3CbKpepMcj-sANiApoR-jHnvwnQWsImVFS58`

### 3. Executar Testes Localmente

```bash
# Abrir Cypress em modo interativo (recomendado)
npm run cypress:open

# Executar todos os testes em modo headless
npm run cypress:run

# Executar com servidor dev automaticamente
npm run test:e2e

# Gravar testes no Cypress Cloud
npm run cypress:run:record
```

### 4. Atualizar .gitignore (opcional)

Adicione estas linhas ao seu `.gitignore`:

```
# Cypress
cypress/videos
cypress/screenshots
cypress/downloads
.cypress-cache
```

## 📊 Cypress Cloud Dashboard

Acesse seus testes gravados em:
**https://cloud.cypress.io/projects/zwicbt**

## 🎓 Próximos Passos

1. ✅ Adicionar scripts ao package.json
2. ✅ Criar usuários de teste no Supabase
3. ✅ Configurar secrets no GitHub (se usar CI/CD)
4. ✅ Executar `npm run cypress:open` para testar
5. ✅ Revisar e ajustar testes conforme necessário
6. ✅ Adicionar mais testes para outras funcionalidades

## 📝 Estrutura de Testes Atual

### ✅ Implementados:
- **Auth:** Login, logout, recuperação de senha
- **Mural:** Criar post, anonimização, moderação IA
- **Mural:** Responder post, visualizar respostas
- **Admin:** Aprovar/rejeitar posts, estatísticas

### 🔄 Próximos a Implementar:
- Feed (visualização e interações)
- Treinamentos (módulos e quiz)
- Notificações
- Perfil de usuário
- Busca e filtros

## 🆘 Troubleshooting

### Erro: "Cypress cannot be found"
```bash
npm install
```

### Erro: "baseUrl not configured"
Verifique se o `cypress.config.ts` foi criado corretamente.

### Testes falham com timeout
- Aumentar timeouts no `cypress.config.ts`
- Usar `cy.waitForSupabase()` após navegações
- Verificar se o servidor dev está na porta 8080

### Usuários não conseguem fazer login
- Verificar se os usuários foram criados no Supabase
- Confirmar que `email_confirmed_at` não é null
- Testar login manual antes de rodar testes

## 📚 Documentação

Para mais detalhes, consulte:
- `cypress/README.md` - Documentação completa dos testes
- [Cypress Docs](https://docs.cypress.io)
- [Cypress Cloud](https://cloud.cypress.io/projects/zwicbt)

---

**🎉 Cypress configurado com sucesso!**

Execute `npm run cypress:open` para começar a testar.
