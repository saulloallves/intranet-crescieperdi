-- ================================================
-- SCRIPT DE VALIDAÇÃO COMPLETA DO SISTEMA
-- Crescendo Conectado v2.0
-- Data: 28/10/2025
-- ================================================

\echo '================================================'
\echo 'INICIANDO VALIDAÇÃO DO SISTEMA'
\echo '================================================'
\echo ''

-- ================================================
-- 1. ESTRUTURA DE BANCO DE DADOS
-- ================================================

\echo '1️⃣  VERIFICANDO ESTRUTURA DO BANCO...'
\echo ''

-- Contar tabelas
\echo '📊 Total de tabelas:'
SELECT COUNT(*) as total_tabelas
FROM information_schema.tables 
WHERE table_schema = 'public';

\echo ''
\echo '📋 Tabelas relacionadas a treinamentos:'
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'training%'
ORDER BY table_name;

\echo ''
\echo '✅ Esperado: 9 tabelas de treinamento'
\echo ''

-- ================================================
-- 2. TRILHAS DE TREINAMENTO
-- ================================================

\echo '2️⃣  VERIFICANDO TRILHAS DE TREINAMENTO...'
\echo ''

SELECT 
  '✓ ' || name as trilha,
  target_role as cargo,
  estimated_duration_hours || 'h' as duracao,
  CASE WHEN is_active THEN '🟢 Ativa' ELSE '🔴 Inativa' END as status
FROM training_paths 
ORDER BY order_index;

\echo ''
\echo '✅ Esperado: 6 trilhas ativas'
\echo ''

-- ================================================
-- 3. CONFIGURAÇÕES DE ONBOARDING
-- ================================================

\echo '3️⃣  VERIFICANDO CONFIGURAÇÕES DE ONBOARDING...'
\echo ''

SELECT 
  key as configuracao,
  value as valor,
  description as descricao
FROM automation_settings 
WHERE key IN ('onboarding_auto_assign', 'default_training_by_role')
ORDER BY key;

\echo ''
\echo '✅ onboarding_auto_assign deve ser true'
\echo '✅ default_training_by_role deve ter 6 UUIDs'
\echo ''

-- ================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ================================================

\echo '4️⃣  VERIFICANDO ROW LEVEL SECURITY...'
\echo ''

\echo '🔒 Tabelas com RLS habilitado:'
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '✅ Habilitado' ELSE '❌ DESABILITADO' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE 'training%'
ORDER BY tablename;

\echo ''
\echo '⚠️  TODAS devem ter RLS habilitado!'
\echo ''

-- ================================================
-- 5. POLÍTICAS RLS
-- ================================================

\echo '5️⃣  VERIFICANDO POLÍTICAS RLS...'
\echo ''

\echo '🛡️  Contagem de políticas por tabela:'
SELECT 
  tablename as tabela,
  COUNT(*) as num_policies
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename LIKE 'training%'
GROUP BY tablename
ORDER BY tablename;

\echo ''
\echo '✅ Cada tabela deve ter ao menos 2 políticas'
\echo ''

-- ================================================
-- 6. TRIGGERS
-- ================================================

\echo '6️⃣  VERIFICANDO TRIGGERS...'
\echo ''

\echo '⚡ Triggers de updated_at:'
SELECT 
  trigger_name,
  event_object_table as tabela,
  action_timing || ' ' || event_manipulation as evento
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%updated_at%'
ORDER BY event_object_table;

\echo ''

\echo '⚡ Trigger de progresso de trilhas:'
SELECT 
  trigger_name,
  event_object_table as tabela,
  event_manipulation as evento
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
  AND trigger_name = 'training_progress_update_path';

\echo ''
\echo '✅ Deve existir trigger training_progress_update_path'
\echo ''

-- ================================================
-- 7. STORAGE BUCKETS
-- ================================================

\echo '7️⃣  VERIFICANDO STORAGE BUCKETS...'
\echo ''

SELECT 
  name as bucket,
  CASE WHEN public THEN '🌐 Público' ELSE '🔒 Privado' END as visibilidade,
  file_size_limit / 1048576 || ' MB' as limite_tamanho
FROM storage.buckets 
ORDER BY name;

\echo ''
\echo '✅ Deve existir bucket: training-certificates (público)'
\echo ''

-- ================================================
-- 8. FUNCTIONS E PROCEDURES
-- ================================================

\echo '8️⃣  VERIFICANDO FUNCTIONS...'
\echo ''

\echo '🔧 Functions de treinamento:'
SELECT 
  routine_name as function_name
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION'
  AND routine_name LIKE '%training%'
ORDER BY routine_name;

\echo ''
\echo '✅ Deve incluir: update_training_path_progress'
\echo ''

-- ================================================
-- 9. ÍNDICES
-- ================================================

\echo '9️⃣  VERIFICANDO ÍNDICES...'
\echo ''

\echo '📑 Índices em tabelas de treinamento:'
SELECT 
  tablename as tabela,
  indexname as indice
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename LIKE 'training%'
  AND indexname NOT LIKE '%pkey%'
ORDER BY tablename, indexname;

\echo ''
\echo '✅ Deve haver índices em foreign keys e campos de busca'
\echo ''

-- ================================================
-- 10. DADOS EXISTENTES
-- ================================================

\echo '🔟 VERIFICANDO DADOS EXISTENTES...'
\echo ''

\echo '📊 Contagem de registros:'
SELECT 
  'profiles' as tabela, 
  COUNT(*) as registros,
  CASE 
    WHEN COUNT(*) = 0 THEN '⚠️  Vazio'
    WHEN COUNT(*) < 10 THEN '🟡 Poucos dados'
    ELSE '🟢 OK'
  END as status
FROM profiles
UNION ALL
SELECT 
  'training_paths', 
  COUNT(*),
  CASE 
    WHEN COUNT(*) = 6 THEN '🟢 OK (6 trilhas)'
    WHEN COUNT(*) > 0 THEN '🟡 Parcial'
    ELSE '❌ PROBLEMA'
  END
FROM training_paths
UNION ALL
SELECT 
  'trainings', 
  COUNT(*),
  CASE 
    WHEN COUNT(*) = 0 THEN '⚠️  Sem treinamentos'
    WHEN COUNT(*) < 5 THEN '🟡 Poucos treinamentos'
    ELSE '🟢 OK'
  END
FROM trainings
UNION ALL
SELECT 
  'user_training_paths', 
  COUNT(*),
  CASE 
    WHEN COUNT(*) = 0 THEN '⏸️  Sem usuários em trilhas'
    ELSE '🟢 OK'
  END
FROM user_training_paths
UNION ALL
SELECT 
  'training_certificates', 
  COUNT(*),
  CASE 
    WHEN COUNT(*) = 0 THEN '⏸️  Sem certificados emitidos'
    ELSE '🟢 ' || COUNT(*) || ' certificados'
  END
FROM training_certificates
UNION ALL
SELECT 
  'training_feedback', 
  COUNT(*),
  CASE 
    WHEN COUNT(*) = 0 THEN '⏸️  Sem feedbacks'
    ELSE '🟢 ' || COUNT(*) || ' feedbacks'
  END
FROM training_feedback
UNION ALL
SELECT 
  'feed_posts', 
  COUNT(*),
  CASE 
    WHEN COUNT(*) = 0 THEN '⚠️  Sem posts no feed'
    WHEN COUNT(*) < 10 THEN '🟡 Poucos posts'
    ELSE '🟢 OK'
  END
FROM feed_posts
UNION ALL
SELECT 
  'notifications', 
  COUNT(*),
  CASE 
    WHEN COUNT(*) = 0 THEN '⏸️  Sem notificações'
    ELSE '🟢 OK'
  END
FROM notifications;

\echo ''

-- ================================================
-- 11. DIAGNÓSTICO DE PROBLEMAS
-- ================================================

\echo '1️⃣1️⃣  DIAGNÓSTICO DE PROBLEMAS...'
\echo ''

\echo '🚨 Verificando tabelas SEM RLS (PROBLEMA DE SEGURANÇA):'
SELECT 
  '❌ ' || tablename as tabela_sem_rls
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = false
  AND tablename NOT IN ('settings', 'automation_settings', 'cross_config')
ORDER BY tablename;

\echo ''
\echo '⚠️  Se houver tabelas listadas, ATIVE RLS!'
\echo ''

\echo '🔍 Verificando configuração de mapeamento de trilhas:'
SELECT 
  CASE 
    WHEN value->>'avaliadora' IS NOT NULL 
      AND value->>'gerente' IS NOT NULL 
      AND value->>'social_midia' IS NOT NULL 
      AND value->>'operador_caixa' IS NOT NULL 
      AND value->>'franqueado' IS NOT NULL 
      AND value->>'suporte' IS NOT NULL 
    THEN '✅ TODOS os 6 cargos mapeados'
    ELSE '❌ FALTAM cargos no mapeamento!'
  END as status_mapeamento
FROM automation_settings 
WHERE key = 'default_training_by_role';

\echo ''

-- ================================================
-- 12. VALIDAÇÃO DE FOREIGN KEYS
-- ================================================

\echo '1️⃣2️⃣  VALIDANDO RELACIONAMENTOS...'
\echo ''

\echo '🔗 Foreign Keys em tabelas de treinamento:'
SELECT 
  tc.table_name as tabela,
  kcu.column_name as coluna,
  ccu.table_name as referencia
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name LIKE 'training%'
ORDER BY tc.table_name, kcu.column_name;

\echo ''
\echo '✅ Relacionamentos devem estar corretos'
\echo ''

-- ================================================
-- 13. CHECKLIST FINAL
-- ================================================

\echo '1️⃣3️⃣  CHECKLIST FINAL...'
\echo ''

-- Criar uma view temporária com o status geral
WITH system_status AS (
  SELECT 
    (SELECT COUNT(*) FROM training_paths) as trilhas,
    (SELECT COUNT(*) FROM trainings) as treinamentos,
    (SELECT COUNT(*) FROM storage.buckets WHERE name = 'training-certificates') as bucket_cert,
    (SELECT COUNT(*) FROM automation_settings WHERE key = 'onboarding_auto_assign' AND value::text = 'true') as onboarding_ativo,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'training%' AND rowsecurity = true) as tabelas_com_rls
)
SELECT 
  CASE WHEN trilhas = 6 THEN '✅' ELSE '❌' END || ' Trilhas criadas: ' || trilhas || '/6' as item_1,
  CASE WHEN treinamentos > 0 THEN '✅' ELSE '⚠️ ' END || ' Treinamentos: ' || treinamentos as item_2,
  CASE WHEN bucket_cert > 0 THEN '✅' ELSE '❌' END || ' Bucket de certificados criado' as item_3,
  CASE WHEN onboarding_ativo > 0 THEN '✅' ELSE '❌' END || ' Onboarding automático ativo' as item_4,
  CASE WHEN tabelas_com_rls = 9 THEN '✅' ELSE '⚠️ ' END || ' RLS: ' || tabelas_com_rls || '/9 tabelas' as item_5
FROM system_status;

\echo ''
\echo '================================================'
\echo 'VALIDAÇÃO CONCLUÍDA!'
\echo '================================================'
\echo ''
\echo '📋 Próximos passos:'
\echo '   1. Se houver ❌, corrija os problemas'
\echo '   2. Se houver ⚠️ , adicione conteúdo de teste'
\echo '   3. Execute testes manuais no frontend'
\echo '   4. Teste Edge Functions via API'
\echo ''
\echo '📚 Documentação completa em:'
\echo '   - TESTE_COMPLETO_SISTEMA.md'
\echo '   - TRAINING_MODULE_IMPLEMENTATION_REPORT.md'
\echo ''
\echo '================================================'

