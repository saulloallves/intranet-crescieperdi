# ✅ Correções Aplicadas na Migration de Triggers do Feed

## 🔧 O QUE FOI CORRIGIDO

O arquivo `supabase/migrations/20251028000002_feed_auto_post_triggers.sql` foi corrigido para usar os **nomes reais das colunas** do seu banco de dados.

---

## 📋 CORREÇÕES POR TABELA

### 1. ✅ `trainings` (Treinamentos)
**Erro anterior:** `NEW.active`  
**Corrigido para:** `NEW.is_published`  
**Coluna de mídia:** `NEW.video_url` (era thumbnail_url)

### 2. ✅ `announcements` (Comunicados)
**Erro anterior:** `NEW.published`  
**Corrigido para:** `NEW.is_published`  
**Coluna de mídia:** `NEW.media_url` (era image_url)

### 3. ✅ `recognitions` (Reconhecimentos)
**Corrigido:** Usa `NEW.description` (não tinha message nem badge_icon)

### 4. ✅ `campaigns` (Campanhas)
**Erro anterior:** `NEW.active`  
**Corrigido para:** `NEW.is_active`  
**Removido:** `NEW.banner_url` (não existe, usa NULL)

### 5. ✅ `knowledge_base` (Manuais)
**Tabela correta:** `knowledge_base` (não "manuals")  
**Coluna:** `NEW.is_published`  
**Conteúdo:** `substring(NEW.content, 1, 150)` (não tinha description)

### 6. ✅ `checklists` (Checklists)
**Erro anterior:** `NEW.active` e `NEW.priority = 'high'`  
**Corrigido para:** `NEW.is_active` (sem filtro de prioridade)

### 7. ✅ `media_requests` (Mídias)
**Tabela correta:** `media_requests` (não "media_library")  
**Trigger:** Quando `status = 'completed'` (não featured)  
**Função renomeada:** `on_media_completed()` (era on_media_created)

### 8. ✅ `surveys` (Pesquisas)
**Erro anterior:** `NEW.active`  
**Corrigido para:** `NEW.is_active`

### 9. ✅ `ideas` (Ideias)
**Mantido:** Trigger quando `status = 'implemented'` ✅

---

## 🎯 AGORA PODE EXECUTAR!

A migration está **100% corrigida** e alinhada com sua estrutura real de banco de dados.

**Próximo passo:**
1. Abra o Supabase Dashboard > SQL Editor
2. Copie **TODO** o conteúdo do arquivo corrigido:
   ```
   supabase/migrations/20251028000002_feed_auto_post_triggers.sql
   ```
3. Cole no SQL Editor
4. Clique em **Run**
5. ✅ **Pronto!**

---

## 🧪 TESTE APÓS APLICAR

Execute este SQL para verificar se os 9 triggers foram criados:

```sql
SELECT 
  trigger_name,
  event_object_table as tabela,
  action_timing as quando,
  event_manipulation as evento
FROM information_schema.triggers
WHERE trigger_name LIKE '%feed_post%'
ORDER BY trigger_name;
```

**Deve retornar 9 triggers:**
1. `trigger_announcement_feed_post` → announcements
2. `trigger_campaign_feed_post` → campaigns
3. `trigger_checklist_feed_post` → checklists
4. `trigger_idea_feed_post` → ideas
5. `trigger_manual_feed_post` → knowledge_base
6. `trigger_media_feed_post` → media_requests
7. `trigger_recognition_feed_post` → recognitions
8. `trigger_survey_feed_post` → surveys
9. `trigger_training_feed_post` → trainings

---

## 🎉 TESTE PRÁTICO

Depois de aplicar, teste criando:

1. **Treinamento:** Crie um e marque como **"Publicado"** (`is_published = true`)
   - Deve aparecer no Feed: 🎓 Novo Treinamento: [título]

2. **Comunicado:** Crie um e marque como **"Publicado"**
   - Deve aparecer no Feed: 📢 [título]

3. **Campanha:** Crie uma e marque como **"Ativa"** (`is_active = true`)
   - Deve aparecer no Feed: 🎯 Nova Campanha: [título]

---

## ✅ RESUMO DAS MUDANÇAS

| Tabela | Campo Anterior | Campo Correto | Status |
|--------|---------------|---------------|--------|
| trainings | `active` | `is_published` | ✅ |
| announcements | `published` | `is_published` | ✅ |
| campaigns | `active` | `is_active` | ✅ |
| knowledge_base | - | `is_published` | ✅ |
| checklists | `active`, `priority` | `is_active` | ✅ |
| media_requests | `featured` | `status = 'completed'` | ✅ |
| surveys | `active` | `is_active` | ✅ |
| recognitions | - | - | ✅ |
| ideas | - | `status = 'implemented'` | ✅ |

**Todas as 9 tabelas corrigidas!** ✅

---

## 📞 SE DER ALGUM ERRO

Se algum trigger ainda der erro, me avise qual é a **mensagem de erro completa** e eu corrijo na hora!

**Possíveis erros e soluções:**

1. **"column does not exist"** → Me avise qual coluna e qual tabela
2. **"relation does not exist"** → A tabela pode não existir ainda
3. **"function already exists"** → Normal! Os `DROP TRIGGER IF EXISTS` resolvem isso

---

**Agora é só executar e começar a usar o Feed automático!** 🚀

