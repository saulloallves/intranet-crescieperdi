-- ================================================
-- Script de Configuração Inicial do Módulo de Treinamentos
-- ================================================
-- Execute este script no Supabase SQL Editor após aplicar a migration
-- Substitua os UUIDs pelos valores reais obtidos das trilhas criadas

-- ================================================
-- PASSO 1: Verificar trilhas criadas
-- ================================================
-- Execute primeiro esta query para obter os IDs:
/*
SELECT id, name, target_role, estimated_duration_hours
FROM training_paths
ORDER BY order_index;
*/

-- Copie os IDs e substitua nas variáveis abaixo:
-- Exemplo de estrutura esperada:
-- id                                    | name                          | target_role
-- a1b2c3d4-e5f6-7890-abcd-ef1234567890 | Jornada de Avaliadora        | avaliadora
-- b2c3d4e5-f6a7-8901-bcde-f12345678901 | Jornada de Gerente           | gerente
-- etc...

-- ================================================
-- PASSO 2: Habilitar onboarding automático
-- ================================================

-- Verificar se as settings existem
SELECT key, value FROM automation_settings 
WHERE key IN ('onboarding_auto_assign', 'default_training_by_role');

-- Habilitar auto-assign
UPDATE automation_settings 
SET value = 'true'::jsonb,
    updated_at = now()
WHERE key = 'onboarding_auto_assign';

-- ================================================
-- PASSO 3: Configurar mapeamento de cargos → trilhas
-- ================================================
-- ⚠️ IMPORTANTE: SUBSTITUA os UUIDs pelos IDs reais da sua base!

UPDATE automation_settings 
SET value = '{
  "avaliadora": "COLE_AQUI_O_UUID_DA_JORNADA_AVALIADORA",
  "gerente": "COLE_AQUI_O_UUID_DA_JORNADA_GERENTE",
  "social_midia": "COLE_AQUI_O_UUID_DA_JORNADA_SOCIAL_MIDIA",
  "operador_caixa": "COLE_AQUI_O_UUID_DA_JORNADA_OPERADOR_CAIXA",
  "franqueado": "COLE_AQUI_O_UUID_DA_JORNADA_FRANQUEADO",
  "suporte": "COLE_AQUI_O_UUID_DA_JORNADA_SUPORTE"
}'::jsonb,
    updated_at = now()
WHERE key = 'default_training_by_role';

-- ================================================
-- PASSO 4: Criar treinamentos de exemplo
-- ================================================
-- Aqui estão alguns templates para você adaptar

-- Exemplo 1: Treinamento para Avaliadora
DO $$
DECLARE
  v_training_id uuid;
  v_path_id uuid;
BEGIN
  -- Buscar ID da trilha de Avaliadora
  SELECT id INTO v_path_id 
  FROM training_paths 
  WHERE target_role = 'avaliadora' 
  LIMIT 1;

  -- Criar treinamento
  INSERT INTO trainings (
    title,
    description,
    content,
    video_url,
    category,
    target_roles,
    duration_minutes,
    certificate_enabled,
    min_score,
    max_attempts,
    is_published,
    modules,
    order_index
  ) VALUES (
    'Módulo 1: Introdução à Avaliação de Peças',
    'Aprenda os fundamentos da avaliação de roupas usadas, técnicas de inspeção e critérios de qualidade.',
    'Neste módulo você aprenderá:
    - Como identificar diferentes tipos de tecidos
    - Critérios de avaliação de qualidade
    - Técnicas de inspeção visual
    - Como usar a balança corretamente
    - Processo de precificação básico',
    'https://www.youtube.com/watch?v=EXAMPLE', -- Substitua pela URL real
    'avaliacao',
    ARRAY['avaliadora']::user_role[],
    45,
    true,
    70,
    3,
    true,
    '[
      {
        "id": "intro-video",
        "title": "Vídeo: Bem-vinda ao Time!",
        "description": "Conheça a história da Cresci e Perdi e sua missão",
        "type": "video",
        "content_url": "https://www.youtube.com/watch?v=EXAMPLE",
        "duration_minutes": 10
      },
      {
        "id": "manual-avaliacao",
        "title": "Material: Manual de Avaliação",
        "description": "Guia completo com todos os procedimentos",
        "type": "pdf",
        "content_url": "https://seusite.com/manual-avaliacao.pdf",
        "duration_minutes": 15
      },
      {
        "id": "quiz-fundamentos",
        "title": "Quiz: Fundamentos da Avaliação",
        "description": "Teste seus conhecimentos",
        "type": "quiz",
        "duration_minutes": 20,
        "quiz": {
          "min_score": 70,
          "max_attempts": 3,
          "questions": [
            {
              "id": "q1",
              "question": "Qual é a primeira etapa ao receber uma peça para avaliação?",
              "options": [
                "Precificação imediata",
                "Inspeção visual detalhada",
                "Pesagem da peça",
                "Cadastro no sistema"
              ],
              "correct_answer": "Inspeção visual detalhada",
              "feedback": "Correto! A inspeção visual é sempre o primeiro passo para identificar defeitos, manchas ou problemas que possam afetar o valor da peça."
            },
            {
              "id": "q2",
              "question": "Quais critérios são essenciais na avaliação de qualidade?",
              "options": [
                "Apenas a marca",
                "Cor e tamanho",
                "Estado de conservação, marca e tipo de tecido",
                "Somente o preço original"
              ],
              "correct_answer": "Estado de conservação, marca e tipo de tecido",
              "feedback": "Excelente! Avaliar a conservação, marca e tipo de tecido nos permite fazer uma precificação justa e adequada."
            },
            {
              "id": "q3",
              "question": "O que fazer ao encontrar uma peça com pequeno defeito?",
              "options": [
                "Recusar a peça automaticamente",
                "Aceitar pelo valor total",
                "Ajustar o valor de acordo com o defeito",
                "Enviar para o gerente decidir"
              ],
              "correct_answer": "Ajustar o valor de acordo com o defeito",
              "feedback": "Isso mesmo! Pequenos defeitos podem ser aceitos com ajuste no valor. Use a tabela de descontos do manual."
            }
          ]
        }
      }
    ]'::jsonb,
    1
  ) RETURNING id INTO v_training_id;

  -- Associar à trilha
  IF v_path_id IS NOT NULL THEN
    INSERT INTO training_path_items (
      path_id,
      training_id,
      order_index,
      is_required,
      unlock_after
    ) VALUES (
      v_path_id,
      v_training_id,
      1,
      true,
      NULL -- Primeiro módulo, não precisa desbloquear
    );
  END IF;

  RAISE NOTICE 'Treinamento criado com ID: %', v_training_id;
END $$;

-- Exemplo 2: Treinamento para Gerente
DO $$
DECLARE
  v_training_id uuid;
  v_path_id uuid;
BEGIN
  SELECT id INTO v_path_id 
  FROM training_paths 
  WHERE target_role = 'gerente' 
  LIMIT 1;

  INSERT INTO trainings (
    title,
    description,
    category,
    target_roles,
    duration_minutes,
    certificate_enabled,
    min_score,
    is_published,
    modules,
    order_index
  ) VALUES (
    'Módulo 1: Fundamentos da Gestão de Loja',
    'Aprenda os princípios básicos de gestão, liderança de equipe e indicadores de performance.',
    'gestao',
    ARRAY['gerente']::user_role[],
    60,
    true,
    75,
    true,
    '[
      {
        "id": "intro-gestao",
        "title": "Vídeo: O Papel do Gerente",
        "type": "video",
        "content_url": "https://www.youtube.com/watch?v=EXAMPLE",
        "duration_minutes": 15
      },
      {
        "id": "kpis-loja",
        "title": "Material: KPIs e Indicadores",
        "type": "pdf",
        "content_url": "https://seusite.com/kpis-loja.pdf",
        "duration_minutes": 20
      },
      {
        "id": "quiz-gestao",
        "title": "Quiz: Fundamentos de Gestão",
        "type": "quiz",
        "duration_minutes": 25,
        "quiz": {
          "min_score": 75,
          "questions": [
            {
              "id": "q1",
              "question": "Qual é o principal KPI de performance de uma loja?",
              "options": [
                "Número de funcionários",
                "Faturamento mensal e ticket médio",
                "Quantidade de avaliações",
                "Horário de abertura"
              ],
              "correct_answer": "Faturamento mensal e ticket médio",
              "feedback": "Correto! Faturamento e ticket médio são indicadores essenciais para avaliar a saúde financeira da loja."
            }
          ]
        }
      }
    ]'::jsonb,
    1
  ) RETURNING id INTO v_training_id;

  IF v_path_id IS NOT NULL THEN
    INSERT INTO training_path_items (
      path_id,
      training_id,
      order_index,
      is_required
    ) VALUES (
      v_path_id,
      v_training_id,
      1,
      true
    );
  END IF;

  RAISE NOTICE 'Treinamento de Gerente criado com ID: %', v_training_id;
END $$;

-- ================================================
-- PASSO 5: Verificar configuração
-- ================================================

-- Ver trilhas e seus treinamentos associados
SELECT 
  tp.name AS trilha,
  tp.target_role AS cargo,
  tp.estimated_duration_hours AS duracao_horas,
  COUNT(tpi.id) AS num_treinamentos,
  tp.is_active AS ativa
FROM training_paths tp
LEFT JOIN training_path_items tpi ON tpi.path_id = tp.id
GROUP BY tp.id, tp.name, tp.target_role, tp.estimated_duration_hours, tp.is_active
ORDER BY tp.order_index;

-- Ver automation settings
SELECT 
  key,
  CASE 
    WHEN key = 'onboarding_auto_assign' THEN value::text
    WHEN key = 'default_training_by_role' THEN jsonb_pretty(value)
    ELSE value::text
  END as configuracao
FROM automation_settings
WHERE key IN ('onboarding_auto_assign', 'default_training_by_role');

-- ================================================
-- PASSO 6: Criar storage bucket para certificados
-- ================================================

-- Verificar se o bucket existe
SELECT * FROM storage.buckets WHERE name = 'training-certificates';

-- Se não existir, criar via dashboard ou executar:
-- (Isso pode precisar ser feito via dashboard)
/*
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-certificates', 'training-certificates', true);
*/

-- ================================================
-- PASSO 7: Testar com usuário de exemplo
-- ================================================

-- Criar usuário de teste (opcional)
/*
DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
BEGIN
  -- Inserir na tabela auth.users primeiro (via Supabase Auth)
  -- Depois inserir profile
  INSERT INTO profiles (
    id,
    full_name,
    role,
    unit_code,
    phone,
    receive_whatsapp_notifications
  ) VALUES (
    v_user_id,
    'Maria Teste Avaliadora',
    'avaliadora',
    'UND001',
    '11999999999',
    false -- false para não enviar WhatsApp em teste
  );

  RAISE NOTICE 'Usuário de teste criado: %', v_user_id;
END $$;
*/

-- ================================================
-- QUERIES ÚTEIS PARA MONITORAMENTO
-- ================================================

-- Ver progresso de todos os usuários
SELECT 
  p.full_name,
  p.role,
  p.unit_code,
  tp.name AS trilha,
  utp.progress_percentage AS progresso,
  CASE 
    WHEN utp.completed_at IS NOT NULL THEN '✅ Concluído'
    WHEN utp.progress_percentage > 0 THEN '🔄 Em andamento'
    ELSE '⏸️ Não iniciado'
  END as status,
  utp.started_at AS inicio,
  utp.completed_at AS conclusao
FROM user_training_paths utp
JOIN profiles p ON p.id = utp.user_id
JOIN training_paths tp ON tp.id = utp.path_id
ORDER BY utp.started_at DESC;

-- Ver certificados emitidos
SELECT 
  p.full_name,
  p.unit_code,
  t.title AS treinamento,
  tc.issued_at AS emitido_em,
  tc.certificate_code AS codigo,
  tc.verified AS verificado
FROM training_certificates tc
JOIN profiles p ON p.id = tc.user_id
JOIN trainings t ON t.id = tc.training_id
ORDER BY tc.issued_at DESC;

-- Ver estatísticas por trilha
SELECT 
  tp.name AS trilha,
  tp.target_role AS cargo_alvo,
  COUNT(DISTINCT utp.user_id) AS usuarios_inscritos,
  COUNT(DISTINCT CASE WHEN utp.completed_at IS NOT NULL THEN utp.user_id END) AS concluidos,
  ROUND(AVG(utp.progress_percentage), 2) AS progresso_medio,
  ROUND(
    COUNT(DISTINCT CASE WHEN utp.completed_at IS NOT NULL THEN utp.user_id END)::numeric / 
    NULLIF(COUNT(DISTINCT utp.user_id), 0) * 100, 
    2
  ) AS taxa_conclusao_pct
FROM training_paths tp
LEFT JOIN user_training_paths utp ON utp.path_id = tp.id
GROUP BY tp.id, tp.name, tp.target_role
ORDER BY tp.order_index;

-- Ver feedback recente
SELECT 
  p.full_name,
  p.role,
  t.title AS treinamento,
  tf.clarity_rating AS clareza,
  tf.preparedness_rating AS preparacao,
  tf.content_relevance_rating AS relevancia,
  CASE WHEN tf.would_recommend THEN '👍 Sim' ELSE '👎 Não' END as recomenda,
  tf.comments,
  tf.submitted_at
FROM training_feedback tf
JOIN profiles p ON p.id = tf.user_id
JOIN trainings t ON t.id = tf.training_id
ORDER BY tf.submitted_at DESC
LIMIT 20;

-- Ver tentativas de quiz
SELECT 
  p.full_name,
  t.title AS treinamento,
  tqa.attempt_number AS tentativa,
  tqa.score AS pontuacao,
  CASE WHEN tqa.passed THEN '✅ Aprovado' ELSE '❌ Reprovado' END as resultado,
  tqa.completed_at
FROM training_quiz_attempts tqa
JOIN profiles p ON p.id = tqa.user_id
JOIN trainings t ON t.id = tqa.training_id
ORDER BY tqa.completed_at DESC
LIMIT 30;

-- ================================================
-- FIM DO SCRIPT
-- ================================================

-- ✅ Próximos passos após executar este script:
-- 1. Verifique se as queries de verificação retornam dados corretos
-- 2. Teste criar um novo usuário e verificar se a trilha é atribuída automaticamente
-- 3. Faça login como o usuário teste e complete um treinamento
-- 4. Verifique se o certificado é gerado corretamente
-- 5. Teste o feedback pós-treinamento
-- 6. Acesse o dashboard admin e veja os relatórios

SELECT '✅ Script de configuração concluído! Verifique os resultados acima.' AS status;

