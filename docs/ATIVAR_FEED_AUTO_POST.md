# 🚀 Ativar Publicação Automática no Feed

## ✅ O QUE É ISSO?

Esta migration ativa os **triggers automáticos** que fazem os módulos publicarem automaticamente no Feed quando:

- 🎓 Novo **treinamento** é ativado
- 📢 Novo **comunicado** é publicado
- 🏆 Novo **reconhecimento** é criado
- 🎯 Nova **campanha** é ativada
- 📚 Novo **manual** é publicado
- ✅ Novo **checklist de alta prioridade** é criado
- 🎬 Nova **mídia em destaque** é adicionada
- 📊 Nova **pesquisa** é ativada
- 💡 Nova **ideia** é aprovada/implementada

---

## 🎯 PASSO A PASSO (2 MINUTOS)

### 1️⃣ Abrir Supabase Dashboard

1. Acesse: https://supabase.com/dashboard
2. Entre no seu projeto: `crescendo-conectado-59951-hml`
3. Vá em **SQL Editor** (menu lateral esquerdo)

---

### 2️⃣ Executar a Migration

1. Clique em **+ New Query**
2. Abra o arquivo `supabase/migrations/20251028000002_feed_auto_post_triggers.sql` no seu editor
3. **Copie TODO o conteúdo** do arquivo
4. **Cole** no SQL Editor do Supabase
5. Clique em **Run** (ou `Ctrl+Enter`)

**Aguarde:** Deve aparecer "Success. No rows returned" (é normal!)

---

### 3️⃣ Verificar se Funcionou

Execute este SQL no mesmo editor:

```sql
-- Verificar triggers criados
SELECT 
  trigger_name,
  event_object_table as tabela,
  action_timing as quando,
  event_manipulation as evento
FROM information_schema.triggers
WHERE trigger_name LIKE '%feed_post%'
ORDER BY trigger_name;
```

**Resultado esperado: 9 triggers**

```
trigger_name                      | tabela          | quando | evento
----------------------------------|-----------------|--------|--------
trigger_announcement_feed_post    | announcements   | AFTER  | INSERT
trigger_campaign_feed_post        | campaigns       | AFTER  | INSERT
trigger_checklist_feed_post       | checklists      | AFTER  | INSERT
trigger_idea_feed_post            | ideas           | AFTER  | INSERT
trigger_manual_feed_post          | manuals         | AFTER  | INSERT
trigger_media_feed_post           | media_library   | AFTER  | INSERT
trigger_recognition_feed_post     | recognitions    | AFTER  | INSERT
trigger_survey_feed_post          | surveys         | AFTER  | INSERT
trigger_training_feed_post        | trainings       | AFTER  | INSERT
```

✅ **Se aparecer 9 triggers, está tudo certo!**

---

## 🧪 TESTAR SE FUNCIONOU

### Teste 1: Criar um Treinamento

1. Vá em **Admin > Treinamentos**
2. Crie um novo treinamento
3. Marque como **"Ativo"**
4. Salve
5. Vá na aba **Feed**
6. **Deve aparecer um post:** 🎓 Novo Treinamento: [título]

---

### Teste 2: Criar um Comunicado

1. Vá em **Admin > Comunicados**
2. Crie um comunicado
3. Marque como **"Publicado"**
4. Salve
5. Vá na aba **Feed**
6. **Deve aparecer um post:** 📢 [título do comunicado]

---

### Teste 3: Criar um Reconhecimento

1. Vá em **Reconhecimento**
2. Crie um reconhecimento para um colaborador
3. Envie
4. Vá na aba **Feed**
5. **Deve aparecer um post:** 🏆 Reconhecimento: [nome do colaborador]

---

## ⚙️ CONFIGURAÇÕES ADICIONAIS (OPCIONAL)

### Desabilitar Auto-Publicação (se necessário)

Se você quiser **desligar** temporariamente a publicação automática:

```sql
UPDATE automation_settings
SET value = '{"enabled": false}'::jsonb
WHERE key = 'feed_auto_publish';
```

Para **reativar**:

```sql
UPDATE automation_settings
SET value = '{"enabled": true}'::jsonb
WHERE key = 'feed_auto_publish';
```

---

### Configurar Tipos que Enviam WhatsApp

Por padrão, apenas estes tipos enviam WhatsApp:
- 📢 Comunicados (announcement)
- 🎯 Campanhas (campaign)
- 📚 Manuais (manual)

Para adicionar mais tipos:

```sql
UPDATE automation_settings
SET value = '{"types": ["announcement", "campaign", "manual", "training", "checklist"]}'::jsonb
WHERE key = 'feed_zapi_critical_types';
```

---

## ❌ SOLUÇÃO DE PROBLEMAS

### Erro: "relation does not exist"

**Causa:** A tabela do módulo ainda não foi criada.

**Solução:** 
1. Verifique se o módulo está implementado
2. Execute as migrations dos módulos primeiro
3. Depois execute esta migration

---

### Erro: "function already exists"

**Causa:** Os triggers já foram criados antes.

**Solução:** Está tudo certo! Os `DROP TRIGGER IF EXISTS` garantem que não há duplicação.

---

### Posts não aparecem no Feed

**Checklist de debug:**

1. ✅ Verifique se o conteúdo está **ativo/publicado**
2. ✅ Verifique se `feed_auto_publish` está **enabled**:
   ```sql
   SELECT * FROM automation_settings WHERE key = 'feed_auto_publish';
   ```
3. ✅ Verifique se há posts criados:
   ```sql
   SELECT * FROM feed_posts ORDER BY created_at DESC LIMIT 5;
   ```
4. ✅ Veja os logs de erro:
   ```sql
   SELECT * FROM pg_stat_statements 
   WHERE query LIKE '%feed_post%' 
   ORDER BY calls DESC LIMIT 10;
   ```

---

## 📊 MONITORAMENTO

### Ver últimos posts criados automaticamente

```sql
SELECT 
  type,
  title,
  created_at,
  CASE 
    WHEN created_by IS NULL THEN '🤖 Automático'
    ELSE '👤 Manual'
  END as origem
FROM feed_posts
ORDER BY created_at DESC
LIMIT 10;
```

---

### Ver estatísticas de publicação por tipo

```sql
SELECT 
  type,
  COUNT(*) as total_posts,
  MAX(created_at) as ultimo_post
FROM feed_posts
GROUP BY type
ORDER BY total_posts DESC;
```

---

## 🎉 PRONTO!

Agora o seu Feed está **100% automático**! 🚀

Sempre que você criar conteúdo nos módulos, ele aparecerá automaticamente no Feed para todos os usuários!

---

## 📞 SUPORTE

**Problemas?**
- Consulte o arquivo `RELATORIO_MODULO_FEED.md` para visão geral completa
- Veja `FEED_SETUP.md` para mais detalhes técnicos
- Logs de erro: Supabase Dashboard > Logs

**Arquivo da Migration:**
```
supabase/migrations/20251028000002_feed_auto_post_triggers.sql
```

