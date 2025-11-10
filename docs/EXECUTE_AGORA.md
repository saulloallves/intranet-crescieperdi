# 🚀 EXECUTE AGORA - Ativação do Módulo de Treinamentos

## ⏱️ Tempo Total: 15-20 minutos

---

## 📍 PASSO 1: APLICAR MIGRATION (5 minutos)

### 1.1 - Acesse o Supabase Dashboard

1. Abra no navegador: https://supabase.com/dashboard
2. Faça login
3. Selecione o projeto: **`crescendo-conectado-59951-hml`**

### 1.2 - Abra o SQL Editor

1. No menu lateral esquerdo, clique em **"SQL Editor"**
2. Clique em **"New Query"** (botão verde no canto superior direito)

### 1.3 - Execute a Migration

1. **Copie TODO o conteúdo** do arquivo:
   ```
   supabase/migrations/20251028000001_training_paths_and_feedback.sql
   ```

2. **Cole no editor SQL** (Ctrl+V)

3. **Clique em "Run"** (ou pressione Ctrl+Enter)

4. **Aguarde** a mensagem de sucesso (deve aparecer em verde)

### 1.4 - Verifique se funcionou

Execute esta query no mesmo SQL Editor:

```sql
SELECT name, target_role, is_active 
FROM training_paths 
ORDER BY order_index;
```

**✅ Resultado esperado:** 6 linhas mostrando as trilhas criadas:
- Jornada de Avaliadora (avaliadora)
- Jornada de Gerente (gerente)
- Jornada de Social Mídia (social_midia)
- Jornada de Operador de Caixa (operador_caixa)
- Jornada de Franqueado (franqueado)
- Jornada de Suporte (suporte)

---

## 📍 PASSO 2: CONFIGURAR TRILHAS (10 minutos)

### 2.1 - Obter os IDs das Trilhas

No SQL Editor, execute:

```sql
SELECT 
  id, 
  name, 
  target_role 
FROM training_paths 
ORDER BY order_index;
```

### 2.2 - Copiar os UUIDs

**IMPORTANTE:** Você verá algo assim:

```
id                                    | name                          | target_role
--------------------------------------|-------------------------------|------------------
a1b2c3d4-e5f6-7890-abcd-ef1234567890 | Jornada de Avaliadora        | avaliadora
b2c3d4e5-f6a7-8901-bcde-f12345678901 | Jornada de Gerente           | gerente
c3d4e5f6-a7b8-9012-cdef-123456789012 | Jornada de Social Mídia      | social_midia
d4e5f6a7-b8c9-0123-def1-234567890123 | Jornada de Operador de Caixa | operador_caixa
e5f6a7b8-c9d0-1234-ef12-345678901234 | Jornada de Franqueado        | franqueado
f6a7b8c9-d0e1-2345-f123-456789012345 | Jornada de Suporte           | suporte
```

**Copie os 6 UUIDs** (primeira coluna) para usar no próximo passo.

### 2.3 - Configurar Mapeamento de Cargos

No SQL Editor, execute este comando **SUBSTITUINDO os UUIDs** pelos valores reais que você copiou:

```sql
-- Substitua COLE_UUID_AQUI pelos UUIDs reais da sua base!
UPDATE automation_settings 
SET value = '{
  "avaliadora": "ea128acd-0a9b-435d-b973-716ed84e1b71",
  "gerente": "3c77e3f3-699e-4c58-8c8e-ce03329cfe79",
  "social_midia": "be9cb4b9-a819-4d26-9ef0-66e7cf43351a",
  "operador_caixa": "1ec504c6-82a0-4d5a-9a30-3598b2b77047",
  "franqueado": "fc4624c5-82ed-4bda-85a2-55a22a3206e3",
  "suporte": "4377dbfb-40c0-4426-8960-f57067cc2869"
}'::jsonb,
updated_at = now()
WHERE key = 'default_training_by_role';
```

**Exemplo com UUIDs preenchidos:**

```sql
UPDATE automation_settings 
SET value = '{
  "avaliadora": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "gerente": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "social_midia": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "operador_caixa": "d4e5f6a7-b8c9-0123-def1-234567890123",
  "franqueado": "e5f6a7b8-c9d0-1234-ef12-345678901234",
  "suporte": "f6a7b8c9-d0e1-2345-f123-456789012345"
}'::jsonb,
updated_at = now()
WHERE key = 'default_training_by_role';
```

### 2.4 - Verificar Configuração

Execute para confirmar:

```sql
SELECT 
  key, 
  jsonb_pretty(value) as configuracao 
FROM automation_settings 
WHERE key = 'default_training_by_role';
```

**✅ Resultado esperado:** Ver os 6 UUIDs configurados corretamente.

---

## 📍 PASSO 3: CRIAR BUCKET DE CERTIFICADOS (2 minutos)

### 3.1 - Acessar Storage

1. No menu lateral do Supabase, clique em **"Storage"**

### 3.2 - Criar Novo Bucket

1. Clique em **"New Bucket"** (botão verde)
2. Preencha:
   - **Name:** `training-certificates`
   - **Public bucket:** ✅ **MARQUE como público**
   - **File size limit:** `10 MB`
   - **Allowed MIME types:** `application/pdf`
3. Clique em **"Create bucket"**

### 3.3 - Configurar Políticas de Acesso

No SQL Editor, execute:

```sql
-- Permitir upload de certificados (service role only)
CREATE POLICY "Service role can upload certificates"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'training-certificates');

-- Permitir leitura pública de certificados
CREATE POLICY "Anyone can view certificates"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'training-certificates');
```

### 3.4 - Verificar Bucket

Execute:

```sql
SELECT name, public, file_size_limit 
FROM storage.buckets 
WHERE name = 'training-certificates';
```

**✅ Resultado esperado:** 1 linha com o bucket criado e público = true.

---

## ✅ VERIFICAÇÃO FINAL

Execute todas estas queries no SQL Editor para confirmar que está tudo OK:

```sql
-- 1. Verificar trilhas (deve retornar 6)
SELECT COUNT(*) as total_trilhas FROM training_paths;

-- 2. Verificar configuração de onboarding (deve ser true)
SELECT value FROM automation_settings WHERE key = 'onboarding_auto_assign';

-- 3. Verificar mapeamento de cargos (deve ter 6 UUIDs)
SELECT jsonb_pretty(value) FROM automation_settings WHERE key = 'default_training_by_role';

-- 4. Verificar bucket (deve retornar 1)
SELECT COUNT(*) as bucket_criado FROM storage.buckets WHERE name = 'training-certificates';

-- 5. Verificar tabelas criadas
SELECT 
  table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'training%'
ORDER BY table_name;
```

**✅ Resultado esperado:**
- total_trilhas: 6
- onboarding_auto_assign: true
- default_training_by_role: JSON com 6 UUIDs
- bucket_criado: 1
- 9 tabelas de treinamento listadas

---

## 🎉 PRONTO!

Se todas as verificações acima passaram, **o módulo está ativo!**

### 🚀 Próximos Passos

Agora você precisa **criar conteúdo de treinamento**:

#### Opção A - Via Interface (Recomendado)

1. **Acesse o sistema como Admin**
2. Vá em **Admin → Treinamentos**
3. Clique em **"Novo Treinamento"**
4. Preencha:
   - Título: "Módulo 1: Introdução à Avaliação"
   - Descrição
   - Categoria: "Avaliação"
   - Cargo alvo: "Avaliadora"
   - Duração: 45 minutos
   - Habilitar certificado: ✅
   - Nota mínima: 70%
5. **Adicione módulos:**
   - Vídeo de boas-vindas
   - PDF com manual
   - Quiz com 3-5 questões
6. **Publique o treinamento**
7. Vá em **Admin → Trilhas de Treinamento**
8. Selecione "Jornada de Avaliadora"
9. **Associe o treinamento criado**

#### Opção B - Via SQL (Exemplo Rápido)

Execute no SQL Editor:

```sql
-- Criar treinamento de exemplo
INSERT INTO trainings (
  title,
  description,
  category,
  target_roles,
  duration_minutes,
  certificate_enabled,
  min_score,
  is_published,
  modules
) VALUES (
  'Módulo 1: Introdução à Avaliação',
  'Aprenda os fundamentos da avaliação de peças',
  'avaliacao',
  ARRAY['avaliadora']::user_role[],
  45,
  true,
  70,
  true,
  '[
    {
      "id": "video-intro",
      "title": "Vídeo: Bem-vinda!",
      "type": "video",
      "content_url": "https://www.youtube.com/watch?v=SEU_VIDEO",
      "duration_minutes": 15
    },
    {
      "id": "quiz-basico",
      "title": "Quiz: Fundamentos",
      "type": "quiz",
      "duration_minutes": 30,
      "quiz": {
        "min_score": 70,
        "questions": [
          {
            "id": "q1",
            "question": "Qual a primeira etapa da avaliação?",
            "options": ["Precificação", "Inspeção visual", "Pesagem"],
            "correct_answer": "Inspeção visual",
            "feedback": "Correto! A inspeção visual é sempre o primeiro passo."
          }
        ]
      }
    }
  ]'::jsonb
);
```

---

## 🧪 TESTE BÁSICO

Para testar se tudo funciona:

### 1. Criar Usuário Teste

Via Admin ou SQL:

```sql
-- Primeiro criar via Supabase Auth Dashboard
-- Depois adicionar profile:

INSERT INTO profiles (
  id, -- Use o UUID do auth.users
  full_name,
  role,
  unit_code,
  phone,
  receive_whatsapp_notifications
) VALUES (
  'UUID_DO_AUTH_USERS',
  'Maria Teste',
  'avaliadora',
  'UND001',
  '11999999999',
  false -- false para não enviar WhatsApp em teste
);
```

### 2. Testar Onboarding Automático

Faça login com o usuário teste e vá em **"Minha Jornada"**.

**✅ Você deve ver:** A trilha "Jornada de Avaliadora" já atribuída automaticamente!

---

## 📊 QUERIES ÚTEIS

Para monitorar o sistema:

```sql
-- Ver progresso de usuários
SELECT 
  p.full_name,
  p.role,
  tp.name AS trilha,
  utp.progress_percentage AS progresso,
  CASE 
    WHEN utp.completed_at IS NOT NULL THEN '✅ Concluído'
    WHEN utp.progress_percentage > 0 THEN '🔄 Em andamento'
    ELSE '⏸️ Não iniciado'
  END as status
FROM user_training_paths utp
JOIN profiles p ON p.id = utp.user_id
JOIN training_paths tp ON tp.id = utp.path_id
ORDER BY utp.started_at DESC;

-- Ver certificados emitidos
SELECT 
  p.full_name,
  t.title,
  tc.issued_at,
  tc.pdf_url
FROM training_certificates tc
JOIN profiles p ON p.id = tc.user_id
JOIN trainings t ON t.id = tc.training_id
ORDER BY tc.issued_at DESC;

-- Ver estatísticas gerais
SELECT 
  tp.name AS trilha,
  COUNT(DISTINCT utp.user_id) AS usuarios,
  COUNT(DISTINCT CASE WHEN utp.completed_at IS NOT NULL THEN utp.user_id END) AS concluidos,
  ROUND(AVG(utp.progress_percentage), 2) AS progresso_medio
FROM training_paths tp
LEFT JOIN user_training_paths utp ON utp.path_id = tp.id
GROUP BY tp.id, tp.name
ORDER BY tp.order_index;
```

---

## 🆘 PROBLEMAS?

### "Trilhas não aparecem"
- Verifique se a migration foi executada com sucesso
- Execute: `SELECT COUNT(*) FROM training_paths;` (deve retornar 6)

### "Onboarding não funciona"
- Verifique: `SELECT value FROM automation_settings WHERE key = 'onboarding_auto_assign';`
- Deve retornar: `true`

### "Certificado não é gerado"
- Verifique se o bucket existe: `SELECT * FROM storage.buckets WHERE name = 'training-certificates';`
- Verifique as variáveis de ambiente das Edge Functions

### "GiraBot não responde"
- Verifique a variável `LOVABLE_API_KEY` nas Edge Functions
- Dashboard → Project Settings → Edge Functions → Environment Variables

---

## 📚 DOCUMENTAÇÃO COMPLETA

- 📘 **Relatório técnico:** `TRAINING_MODULE_IMPLEMENTATION_REPORT.md`
- 📗 **Setup detalhado:** `SETUP_INSTRUCTIONS.md`
- 📙 **Script SQL completo:** `scripts/setup-training-module.sql`
- 📓 **Resumo executivo:** `RESUMO_IMPLEMENTACAO.md`

---

## ✨ FUNCIONALIDADES ATIVAS APÓS CONCLUSÃO

- ✅ 6 Trilhas de treinamento por cargo
- ✅ Onboarding automático de novos colaboradores
- ✅ Sistema de quiz com IA (GiraBot)
- ✅ Certificação automática com QR Code
- ✅ Notificações push e WhatsApp
- ✅ Dashboards de progresso e feedback
- ✅ Relatórios automáticos com IA

---

**🎉 Bora ativar! Siga os 3 passos acima e em 15 minutos está tudo funcionando!**

---

*Criado em: 28/10/2025*  
*Sistema: Crescendo Conectado v2.0*  
*Módulo: Treinamento Operacional*

