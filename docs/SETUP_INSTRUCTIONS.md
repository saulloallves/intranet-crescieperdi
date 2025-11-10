# 🚀 Instruções de Configuração - Módulo de Treinamentos

## 📋 Passo a Passo para Ativação

### **PASSO 1: Aplicar Migration no Supabase**

Como o projeto não está linkado via Supabase CLI, você deve aplicar a migration manualmente:

1. **Acesse o Supabase Dashboard:**
   - Entre em: https://supabase.com/dashboard
   - Selecione o projeto `crescendo-conectado-59951-hml`

2. **Vá para o SQL Editor:**
   - Menu lateral → SQL Editor
   - Clique em "New Query"

3. **Execute a Migration:**
   - Copie todo o conteúdo do arquivo:
     ```
     supabase/migrations/20251028000001_training_paths_and_feedback.sql
     ```
   - Cole no editor SQL
   - Clique em "Run" (ou pressione Ctrl+Enter)

4. **Verifique o Sucesso:**
   - Você deve ver mensagem de sucesso
   - Confira se as novas tabelas foram criadas:
     - `training_paths`
     - `training_path_items`
     - `user_training_paths`
     - `training_feedback`
     - `training_quiz_attempts`

---

### **PASSO 2: Configurar IDs das Trilhas no CrossConfig**

Após criar a migration, você precisa mapear os cargos às trilhas:

1. **Obter os IDs das Trilhas Criadas:**

   Execute no SQL Editor:
   ```sql
   SELECT id, name, target_role 
   FROM training_paths 
   ORDER BY order_index;
   ```

   Copie os IDs (UUIDs) que serão retornados.

2. **Atualizar Automation Settings:**

   Execute no SQL Editor (substitua os UUIDs pelos IDs reais):
   ```sql
   -- Habilitar auto-assign
   UPDATE automation_settings 
   SET value = 'true'::jsonb
   WHERE key = 'onboarding_auto_assign';

   -- Configurar mapeamento (SUBSTITUA os IDs pelos valores reais)
   UPDATE automation_settings 
   SET value = '{
     "avaliadora": "UUID_DA_JORNADA_AVALIADORA",
     "gerente": "UUID_DA_JORNADA_GERENTE",
     "social_midia": "UUID_DA_JORNADA_SOCIAL_MIDIA",
     "operador_caixa": "UUID_DA_JORNADA_OPERADOR_CAIXA",
     "franqueado": "UUID_DA_JORNADA_FRANQUEADO",
     "suporte": "UUID_DA_JORNADA_SUPORTE"
   }'::jsonb
   WHERE key = 'default_training_by_role';
   ```

   **Exemplo com UUIDs reais:**
   ```sql
   UPDATE automation_settings 
   SET value = '{
     "avaliadora": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
     "gerente": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
     "social_midia": "c3d4e5f6-a7b8-9012-cdef-123456789012",
     "operador_caixa": "d4e5f6a7-b8c9-0123-def1-234567890123",
     "franqueado": "e5f6a7b8-c9d0-1234-ef12-345678901234",
     "suporte": "f6a7b8c9-d0e1-2345-f123-456789012345"
   }'::jsonb
   WHERE key = 'default_training_by_role';
   ```

---

### **PASSO 3: Criar Treinamentos Iniciais**

As trilhas foram criadas, mas ainda não têm treinamentos associados. Você pode:

**Opção A - Via Interface Admin:**
1. Acesse o sistema como Admin
2. Vá em Admin → Treinamentos
3. Crie treinamentos para cada cargo
4. Depois vá em Admin → Trilhas de Treinamento
5. Associe os treinamentos às trilhas correspondentes

**Opção B - Via SQL (Exemplo):**

```sql
-- Exemplo: Criar treinamento de Avaliadora
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
      "id": "mod1",
      "title": "Bem-vinda ao time!",
      "type": "video",
      "content_url": "URL_DO_VIDEO",
      "duration_minutes": 15
    },
    {
      "id": "mod2",
      "title": "Quiz de Avaliação",
      "type": "quiz",
      "quiz": {
        "questions": [
          {
            "id": "q1",
            "question": "Qual a primeira etapa da avaliação?",
            "options": ["Precificação", "Inspeção visual", "Pesagem"],
            "correct_answer": "Inspeção visual",
            "feedback": "A inspeção visual é sempre o primeiro passo!"
          }
        ],
        "min_score": 70
      }
    }
  ]'::jsonb
) RETURNING id;

-- Depois associe à trilha (use o ID retornado acima)
INSERT INTO training_path_items (
  path_id, 
  training_id, 
  order_index, 
  is_required
) VALUES (
  'UUID_DA_TRILHA_AVALIADORA',
  'UUID_DO_TREINAMENTO_CRIADO',
  1,
  true
);
```

---

### **PASSO 4: Verificar Storage Bucket para Certificados**

1. **Acesse Storage no Supabase:**
   - Menu lateral → Storage

2. **Criar Bucket (se não existir):**
   - Nome: `training-certificates`
   - Público: `true`
   - File size limit: 10MB
   - Allowed MIME types: `application/pdf`

3. **Configurar Políticas RLS:**
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

---

### **PASSO 5: Configurar Variáveis de Ambiente (Edge Functions)**

Verifique se as seguintes variáveis estão configuradas no Supabase:

1. **Dashboard → Project Settings → Edge Functions → Environment Variables**

   Necessárias:
   - ✅ `SUPABASE_URL`
   - ✅ `SUPABASE_SERVICE_ROLE_KEY`
   - ✅ `LOVABLE_API_KEY` (para IA)
   - ✅ `ZAPI_TOKEN` (para WhatsApp)
   - ✅ `ZAPI_INSTANCE_ID`
   - ✅ `ZAPI_CLIENT_TOKEN`

---

### **PASSO 6: Testar o Fluxo Completo**

#### **Teste 1: Onboarding Automático**

1. **Criar novo usuário:**
   ```sql
   -- Via SQL ou interface de Admin
   INSERT INTO profiles (
     id,
     full_name,
     role,
     unit_code,
     phone
   ) VALUES (
     'UUID_TEMPORARIO',
     'Maria Teste',
     'avaliadora',
     'UND001',
     '11999999999'
   );
   ```

2. **Chamar Edge Function de auto-assign:**
   ```javascript
   // Via código ou Postman
   const { data, error } = await supabase.functions.invoke(
     'auto-assign-training-path',
     {
       body: {
         user_id: 'UUID_DO_USUARIO',
         role: 'avaliadora',
         full_name: 'Maria Teste',
         phone: '11999999999'
       }
     }
   );
   ```

3. **Verificar:**
   - ✅ Trilha atribuída em `user_training_paths`
   - ✅ Notificação criada em `notifications`
   - ✅ WhatsApp enviado (se configurado)

#### **Teste 2: Completar Treinamento**

1. Faça login como o usuário teste
2. Acesse "Minha Jornada"
3. Inicie um treinamento
4. Complete os módulos
5. Faça o quiz (com nota >= 70%)
6. Verifique:
   - ✅ Progresso atualizado
   - ✅ Certificado gerado automaticamente
   - ✅ PDF disponível no Storage
   - ✅ Notificação recebida

#### **Teste 3: Feedback Pós-Treinamento**

1. Após completar treinamento
2. Preencha o formulário de feedback
3. Verifique registro em `training_feedback`
4. Como admin, vá em Admin → Dashboard de Feedback
5. Gere relatório com IA

#### **Teste 4: GiraBot Tutor**

1. Durante um treinamento
2. Abra o chat do GiraBot
3. Faça perguntas sobre o conteúdo
4. Erre uma questão do quiz
5. Solicite ajuda da IA
6. Verifique resposta contextual

---

### **PASSO 7: Monitoramento e Logs**

**Verificar Edge Functions:**
1. Dashboard → Edge Functions
2. Clique em cada função
3. Veja "Logs" para debugging

**Consultas SQL Úteis:**

```sql
-- Ver progresso de todos os usuários
SELECT 
  p.full_name,
  p.role,
  tp.name AS trilha,
  utp.progress_percentage,
  utp.started_at,
  utp.completed_at
FROM user_training_paths utp
JOIN profiles p ON p.id = utp.user_id
JOIN training_paths tp ON tp.id = utp.path_id
ORDER BY utp.started_at DESC;

-- Ver certificados emitidos
SELECT 
  p.full_name,
  tp.name AS trilha,
  tc.issued_at,
  tc.pdf_url
FROM training_certificates tc
JOIN profiles p ON p.id = tc.user_id
JOIN training_paths tp ON tp.id = tc.training_path_id
ORDER BY tc.issued_at DESC;

-- Ver feedback recente
SELECT 
  p.full_name,
  t.title AS treinamento,
  tf.clarity_rating,
  tf.preparedness_rating,
  tf.content_relevance_rating,
  tf.would_recommend,
  tf.comments,
  tf.submitted_at
FROM training_feedback tf
JOIN profiles p ON p.id = tf.user_id
JOIN trainings t ON t.id = tf.training_id
ORDER BY tf.submitted_at DESC
LIMIT 20;

-- Ver estatísticas gerais
SELECT 
  tp.name AS trilha,
  COUNT(DISTINCT utp.user_id) AS usuarios_inscritos,
  COUNT(DISTINCT CASE WHEN utp.completed_at IS NOT NULL THEN utp.user_id END) AS usuarios_concluidos,
  ROUND(AVG(utp.progress_percentage), 2) AS progresso_medio
FROM training_paths tp
LEFT JOIN user_training_paths utp ON utp.path_id = tp.id
GROUP BY tp.id, tp.name
ORDER BY tp.order_index;
```

---

## ✅ Checklist Final

Antes de considerar a configuração completa, verifique:

- [ ] Migration aplicada com sucesso
- [ ] IDs das trilhas mapeados no `automation_settings`
- [ ] Bucket `training-certificates` criado
- [ ] Variáveis de ambiente configuradas
- [ ] Ao menos 1 treinamento criado e associado a uma trilha
- [ ] Teste de onboarding funcionando
- [ ] Teste de conclusão e certificado funcionando
- [ ] GiraBot respondendo corretamente
- [ ] Notificações sendo enviadas
- [ ] Dashboard admin acessível

---

## 🆘 Troubleshooting

### Problema: "Trilha não foi atribuída automaticamente"
**Solução:**
- Verifique se `onboarding_auto_assign = true` nas settings
- Confirme que o cargo do usuário está mapeado em `default_training_by_role`
- Veja os logs da Edge Function `auto-assign-training-path`

### Problema: "Certificado não foi gerado"
**Solução:**
- Verifique se `certificate_enabled = true` no treinamento
- Confirme que o usuário atingiu o `min_score`
- Verifique se o bucket `training-certificates` existe
- Veja os logs da Edge Function `generate-training-certificate`

### Problema: "GiraBot não responde"
**Solução:**
- Verifique se `LOVABLE_API_KEY` está configurada
- Veja os logs da Edge Function `girabot-tutor`
- Confirme que o modelo está acessível (Gemini 2.5 Flash)

### Problema: "WhatsApp não é enviado"
**Solução:**
- Verifique as variáveis Z-API (`ZAPI_TOKEN`, `ZAPI_INSTANCE_ID`, `ZAPI_CLIENT_TOKEN`)
- Confirme que o usuário tem `receive_whatsapp_notifications = true`
- Teste a conexão com Z-API via Edge Function `test-zapi`

---

## 📞 Suporte

Em caso de dúvidas ou problemas:
1. Consulte os logs das Edge Functions no Supabase Dashboard
2. Verifique o arquivo `TRAINING_MODULE_IMPLEMENTATION_REPORT.md` para detalhes técnicos
3. Execute as queries SQL de diagnóstico acima

**Sistema pronto para produção!** 🎉

