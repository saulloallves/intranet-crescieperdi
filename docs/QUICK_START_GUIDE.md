# 🚀 Guia Rápido - Ativação do Módulo de Treinamentos

## ⚡ 3 Passos para Ativar

### **PASSO 1: Aplicar a Migration** (5 minutos)

1. Acesse: https://supabase.com/dashboard
2. Selecione o projeto `crescendo-conectado-59951-hml`
3. Vá em **SQL Editor** → **New Query**
4. Copie e cole o conteúdo completo de:
   ```
   supabase/migrations/20251028000001_training_paths_and_feedback.sql
   ```
5. Clique em **Run** (Ctrl+Enter)
6. ✅ Aguarde mensagem de sucesso

---

### **PASSO 2: Configurar as Trilhas** (10 minutos)

1. No mesmo **SQL Editor**, execute:
   ```sql
   SELECT id, name, target_role 
   FROM training_paths 
   ORDER BY order_index;
   ```

2. **Copie os 6 UUIDs** que aparecerem. Exemplo:
   ```
   a1b2c3d4-... | Jornada de Avaliadora    | avaliadora
   b2c3d4e5-... | Jornada de Gerente       | gerente
   c3d4e5f6-... | Jornada de Social Mídia  | social_midia
   ...
   ```

3. Abra o arquivo: `scripts/setup-training-module.sql`

4. **Encontre a seção "PASSO 3"** e substitua os UUIDs:
   ```sql
   UPDATE automation_settings 
   SET value = '{
     "avaliadora": "COLE_UUID_AQUI",
     "gerente": "COLE_UUID_AQUI",
     "social_midia": "COLE_UUID_AQUI",
     "operador_caixa": "COLE_UUID_AQUI",
     "franqueado": "COLE_UUID_AQUI",
     "suporte": "COLE_UUID_AQUI"
   }'::jsonb
   WHERE key = 'default_training_by_role';
   ```

5. **Execute essa parte** no SQL Editor

6. **Execute também:**
   ```sql
   UPDATE automation_settings 
   SET value = 'true'::jsonb
   WHERE key = 'onboarding_auto_assign';
   ```

---

### **PASSO 3: Criar Bucket de Certificados** (2 minutos)

1. No Supabase Dashboard, vá em **Storage**
2. Clique em **New Bucket**
3. Configure:
   - **Name:** `training-certificates`
   - **Public bucket:** ✅ Marque como público
   - **File size limit:** 10 MB
   - **Allowed MIME types:** `application/pdf`
4. Clique em **Create bucket**

---

## ✅ Verificação Rápida

Execute no SQL Editor para confirmar:

```sql
-- 1. Verificar trilhas criadas
SELECT name, target_role, is_active FROM training_paths;
-- Deve retornar 6 trilhas

-- 2. Verificar configuração
SELECT key, value FROM automation_settings 
WHERE key IN ('onboarding_auto_assign', 'default_training_by_role');
-- onboarding_auto_assign deve ser true
-- default_training_by_role deve ter os 6 UUIDs

-- 3. Verificar bucket
SELECT * FROM storage.buckets WHERE name = 'training-certificates';
-- Deve retornar 1 linha
```

---

## 🎯 Teste Básico (Opcional)

Para testar se está funcionando:

1. Crie um usuário teste no Admin
2. Defina o cargo como "avaliadora"
3. Vá em **Minha Jornada** com esse usuário
4. Você deve ver a trilha "Jornada de Avaliadora" automaticamente atribuída

---

## 📚 Próximos Passos

Agora você precisa **criar conteúdo de treinamento**:

### Opção A - Via Interface (Recomendado)
1. Acesse como Admin
2. Vá em **Admin → Treinamentos**
3. Clique em **Novo Treinamento**
4. Preencha:
   - Título
   - Descrição
   - Categoria
   - Cargo(s) alvo
   - Duração
   - Módulos (vídeos, PDFs, quizzes)
5. Salve e publique
6. Vá em **Admin → Trilhas de Treinamento**
7. Associe o treinamento à trilha correspondente

### Opção B - Via SQL (Exemplo)
Use os templates do arquivo `scripts/setup-training-module.sql`

---

## 📞 Precisa de Ajuda?

- **Documentação completa:** `TRAINING_MODULE_IMPLEMENTATION_REPORT.md`
- **Instruções detalhadas:** `SETUP_INSTRUCTIONS.md`
- **Script SQL completo:** `scripts/setup-training-module.sql`
- **Queries úteis:** Consulte a seção final do `setup-training-module.sql`

---

## ✨ Funcionalidades Ativas

Após concluir os 3 passos, você terá:

- ✅ Trilhas de treinamento por cargo
- ✅ Onboarding automático de novos colaboradores
- ✅ Sistema de quiz com IA
- ✅ Certificação automática com QR Code
- ✅ Notificações push e WhatsApp
- ✅ Dashboards de progresso e feedback
- ✅ GiraBot como tutor interativo
- ✅ Relatórios automáticos com IA

**Tempo total: ~15-20 minutos** ⏱️

Bora começar! 🚀

