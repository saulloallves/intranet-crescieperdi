# ✅ Checklist de Ativação - Módulo de Treinamentos

Use este checklist para acompanhar o progresso da ativação.

---

## 📍 PASSO 1: APLICAR MIGRATION

- [ ] Acessei o Supabase Dashboard
- [ ] Abri o SQL Editor
- [ ] Copiei o conteúdo de `supabase/migrations/20251028000001_training_paths_and_feedback.sql`
- [ ] Colei no SQL Editor
- [ ] Executei com sucesso (mensagem verde)
- [ ] Verifiquei que 6 trilhas foram criadas: `SELECT COUNT(*) FROM training_paths;`

**✅ Confirmação:** ___________ trilhas criadas (esperado: 6)

---

## 📍 PASSO 2: CONFIGURAR TRILHAS

### 2.1 - Obter IDs
- [ ] Executei: `SELECT id, name, target_role FROM training_paths ORDER BY order_index;`
- [ ] Copiei os 6 UUIDs

### 2.2 - Configurar Mapeamento
- [ ] Substitui os UUIDs no comando `UPDATE automation_settings`
- [ ] Executei o comando com os UUIDs corretos
- [ ] Verifiquei a configuração: `SELECT jsonb_pretty(value) FROM automation_settings WHERE key = 'default_training_by_role';`

**✅ IDs Copiados:**

```
avaliadora:     ____________________________________
gerente:        ____________________________________
social_midia:   ____________________________________
operador_caixa: ____________________________________
franqueado:     ____________________________________
suporte:        ____________________________________
```

---

## 📍 PASSO 3: CRIAR BUCKET

- [ ] Acessei Storage no Supabase
- [ ] Cliquei em "New Bucket"
- [ ] Nome: `training-certificates`
- [ ] Marquei como público ✅
- [ ] File size limit: 10 MB
- [ ] Allowed MIME types: `application/pdf`
- [ ] Criei o bucket
- [ ] Executei as políticas RLS do bucket
- [ ] Verifiquei: `SELECT * FROM storage.buckets WHERE name = 'training-certificates';`

**✅ Bucket criado:** [ ] SIM [ ] NÃO

---

## ✅ VERIFICAÇÃO FINAL

Execute todas estas queries e marque ✅:

- [ ] `SELECT COUNT(*) FROM training_paths;` → Retorna: **6**
- [ ] `SELECT value FROM automation_settings WHERE key = 'onboarding_auto_assign';` → Retorna: **true**
- [ ] `SELECT value FROM automation_settings WHERE key = 'default_training_by_role';` → Retorna: **JSON com 6 UUIDs**
- [ ] `SELECT COUNT(*) FROM storage.buckets WHERE name = 'training-certificates';` → Retorna: **1**
- [ ] `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'training%';` → Retorna: **9**

---

## 📊 STATUS GERAL

**Data de Ativação:** ___/___/______

**Horário de Início:** ___:___

**Horário de Conclusão:** ___:___

**Tempo Total:** _______ minutos (esperado: 15-20 min)

---

## 🚀 PRÓXIMOS PASSOS

Após marcar todos os itens acima:

### Criar Conteúdo

- [ ] Criei ao menos 1 treinamento via Admin ou SQL
- [ ] Publiquei o treinamento
- [ ] Associei o treinamento a uma trilha

### Testar Sistema

- [ ] Criei usuário de teste
- [ ] Fiz login como usuário teste
- [ ] Verifiquei que trilha foi atribuída automaticamente
- [ ] Iniciei um treinamento
- [ ] Completei um módulo
- [ ] Fiz um quiz
- [ ] Verifiquei progresso no dashboard

---

## 🧪 TESTE COMPLETO

### Fluxo de Onboarding

- [ ] Novo usuário criado com cargo "avaliadora"
- [ ] Trilha "Jornada de Avaliadora" atribuída automaticamente
- [ ] Notificação recebida (verificar tabela `notifications`)
- [ ] WhatsApp enviado (se configurado)

### Fluxo de Treinamento

- [ ] Usuário acessou "Minha Jornada"
- [ ] Visualizou módulos da trilha
- [ ] Assistiu vídeo / leu material
- [ ] Fez quiz
- [ ] Quiz aprovado (score >= 70%)
- [ ] Progresso atualizado automaticamente

### Fluxo de Certificação

- [ ] Usuário completou todos os módulos
- [ ] Nota final >= min_score
- [ ] Certificado gerado automaticamente
- [ ] PDF criado no Storage
- [ ] QR Code presente no certificado
- [ ] Notificação de certificado recebida
- [ ] Gerente notificado

### Fluxo de Feedback

- [ ] Formulário de feedback exibido após conclusão
- [ ] Usuário respondeu as 4 perguntas
- [ ] Feedback salvo na tabela `training_feedback`
- [ ] Admin pode ver feedback no dashboard

### GiraBot

- [ ] Chat do GiraBot acessível durante treinamento
- [ ] GiraBot responde perguntas sobre conteúdo
- [ ] Feedback contextual em quiz errado
- [ ] Sugestões de revisão funcionando

---

## 📈 MÉTRICAS INICIAIS

Após alguns dias de uso, verifique:

- [ ] Total de usuários com trilhas: _______
- [ ] Taxa de conclusão média: _______% 
- [ ] Certificados emitidos: _______
- [ ] Feedbacks recebidos: _______
- [ ] Nota média de satisfação: _______/5

---

## 🆘 PROBLEMAS ENCONTRADOS

Liste aqui qualquer problema:

1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

**Soluções aplicadas:**

1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

---

## 📝 OBSERVAÇÕES

Anotações adicionais:

________________________________________________________________________
________________________________________________________________________
________________________________________________________________________
________________________________________________________________________

---

## ✅ APROVAÇÃO FINAL

- [ ] **Todos os passos concluídos**
- [ ] **Testes passaram**
- [ ] **Sistema em produção**

**Responsável:** _______________________________

**Assinatura:** ________________________________

**Data:** ___/___/______

---

## 🎉 PARABÉNS!

O Módulo de Treinamento Operacional está **ATIVO** e **FUNCIONAL**!

**Sistema pronto para uso em produção** 🚀

---

*Checklist criado em: 28/10/2025*  
*Módulo: Treinamento Operacional*  
*Versão: 1.0*

