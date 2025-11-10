# 🧪 Guia de Testes e Validação - Mural Cresci e Perdi

## Acesso ao Painel de Testes

1. **Navegar para Admin**: `/admin`
2. **Clicar na aba**: "Testes Mural"
3. **Executar testes**: Use o botão "Executar Fluxo Completo"

---

## ✅ Checklist de Validação

### 1. Criação de Posts

- [ ] Posts são criados com status "pending"
- [ ] Categoria é salva corretamente
- [ ] Conteúdo original é preservado no banco
- [ ] `author_id` é associado corretamente

**Como testar:**
```
1. Ir para /mural
2. Clicar em "Novo Post"
3. Selecionar categoria
4. Digitar conteúdo com dados sensíveis (ex: "Meu nome é João Silva, CPF 123.456.789-00")
5. Enviar
6. Verificar no Admin -> Mural que o post está em "Aguardando Moderação"
```

---

### 2. Anonimização por IA

- [ ] Nomes são removidos/substituídos
- [ ] CPFs são removidos/substituídos
- [ ] Códigos de unidade são removidos
- [ ] Conteúdo anonimizado está em `content_clean`
- [ ] Conteúdo original permanece em `content`

**Como testar:**
```
1. Criar post com: "Meu nome é Maria Silva, CPF 987.654.321-00, unidade XYZ789"
2. Aguardar processamento (~2-3 segundos)
3. No Admin -> Testes Mural, clicar em "Executar Fluxo Completo"
4. Verificar na resposta se "content_clean" não contém dados pessoais
```

**Exemplo de sucesso:**
- Original: "Meu nome é João, CPF 123.456.789-00"
- Anonimizado: "Estou passando por dificuldades e preciso de ajuda"

---

### 3. Validação e Aprovação Automática

- [ ] IA valida conteúdo inapropriado
- [ ] Posts adequados são aprovados automaticamente
- [ ] `approval_source` é marcado como "ai"
- [ ] `approved_at` é preenchido com timestamp
- [ ] Posts inadequados são rejeitados ou enviados para revisão

**Como testar:**
```
1. Criar post apropriado: "Estou com dificuldades financeiras, alguém pode ajudar?"
2. Aguardar ~3-5 segundos
3. Verificar no Admin -> Mural se status mudou para "Aprovado"
4. Conferir badge "🧠 Aprovado por IA"
```

**Criar post inadequado:**
```
1. Post com conteúdo ofensivo ou spam
2. Verificar se é rejeitado ou vai para revisão manual
```

---

### 4. Moderação Manual (Admin)

- [ ] Admins podem aprovar posts manualmente
- [ ] Admins podem rejeitar posts
- [ ] `approval_source` é marcado como "admin"
- [ ] Status é atualizado imediatamente
- [ ] Ação é registrada nos logs

**Como testar:**
```
1. Como admin, ir para Admin -> Mural
2. Localizar post pendente
3. Clicar em "Aprovar" ou "Rejeitar"
4. Verificar que status muda instantaneamente
5. Conferir badge "✅ Aprovado por Admin"
```

---

### 5. Integração com Feed

- [ ] Posts aprovados aparecem no Feed principal
- [ ] Formato do título: "🧩 Novo pedido em [categoria]"
- [ ] Link direciona para `/mural`
- [ ] Contagem de respostas está visível
- [ ] Badge de aprovação (IA/Admin) está presente

**Como testar:**
```
1. Aprovar um post (IA ou manual)
2. Ir para /feed
3. Verificar se post do mural aparece
4. Clicar no link e verificar se vai para /mural
5. Conferir se informações estão corretas
```

---

### 6. Sistema de Notificações

#### 6.1 Notificação de Aprovação

- [ ] Autor recebe notificação quando post é aprovado
- [ ] Título: "✅ Sua postagem foi aprovada" (admin) ou "🧠 Aprovada pela IA"
- [ ] Notificação aparece em `/notificacoes`
- [ ] Badge de não lido está presente
- [ ] Clicar marca como lida

**Como testar:**
```
1. Criar post como Usuário A
2. Aguardar aprovação (IA ou admin)
3. Como Usuário A, ir para /notificacoes
4. Verificar presença da notificação
5. Clicar e verificar se marca como lida
```

#### 6.2 Notificação de Resposta

- [ ] Autor recebe notificação quando alguém responde
- [ ] Título: "💬 Nova resposta no seu post"
- [ ] Link da notificação direciona para o post no mural
- [ ] Resposta está visível ao clicar

**Como testar:**
```
1. Como Usuário A, criar e aprovar post
2. Como Usuário B, responder ao post
3. Aguardar aprovação da resposta
4. Como Usuário A, verificar notificação em /notificacoes
5. Clicar e verificar se vai para o post com a resposta
```

---

### 7. Sistema de Respostas

- [ ] Respostas são criadas com status "pending"
- [ ] Respostas também passam por moderação IA
- [ ] Respostas aprovadas são visíveis no post
- [ ] Contador de respostas atualiza corretamente
- [ ] `response_count` no post está correto

**Como testar:**
```
1. Abrir post aprovado
2. Clicar em "Responder"
3. Escrever resposta
4. Enviar
5. Aguardar aprovação (~3-5 segundos)
6. Verificar se resposta aparece
7. Conferir se contador incrementou
```

---

### 8. Configurações (CrossConfig)

- [ ] `mural_auto_approval_enabled` funciona
- [ ] Prompts de IA podem ser customizados
- [ ] Sensibilidade da IA (1-5) tem efeito
- [ ] Notificações podem ser desabilitadas
- [ ] Integração com Feed pode ser desabilitada
- [ ] Cargos de curadoria são respeitados

**Como testar:**
```
1. Ir para Admin -> CrossConfig -> Mural
2. Desabilitar "Aprovação Automática via IA"
3. Criar novo post
4. Verificar que permanece em "pending"
5. Reabilitar e testar novamente
```

---

## 🐛 Problemas Comuns e Soluções

### Post não está sendo anonimizado
- Verificar se `LOVABLE_API_KEY` está configurada
- Checar logs da edge function `mural-ai-filter`
- Validar que o post tem `content` preenchido

### Aprovação automática não funciona
- Confirmar que `mural_auto_approval_enabled` está `true`
- Verificar logs da edge function `mural-ai-validate`
- Checar se `LOVABLE_API_KEY` é válida

### Notificações não são enviadas
- Verificar que `mural_notify_on_reply` está `true`
- Checar tabela `notifications` no banco
- Validar que `user_id` do autor está correto

### Posts não aparecem no Feed
- Confirmar que `mural_feed_integration` está `true`
- Verificar logs da edge function `mural-feed-integration`
- Checar se post está realmente aprovado

### Respostas não são contadas
- Verificar trigger `update_mural_response_count`
- Checar se status da resposta é "approved"
- Validar `post_id` da resposta

---

## 📊 Métricas de Sucesso

### Performance
- [ ] Anonimização: < 2 segundos
- [ ] Validação IA: < 3 segundos
- [ ] Criação de notificação: < 1 segundo
- [ ] Integração com Feed: < 2 segundos

### Taxa de Aprovação
- [ ] Posts adequados: > 95% aprovados pela IA
- [ ] Falsos positivos: < 5%
- [ ] Falsos negativos: < 2%

### Experiência do Usuário
- [ ] Feedback visual de processamento
- [ ] Mensagens de erro claras
- [ ] Loading states durante ações
- [ ] Notificações em tempo real

---

## 🔧 Comandos Úteis para Debug

### Ver posts pendentes
```sql
SELECT id, category, status, created_at, approval_source
FROM mural_posts
WHERE status = 'pending'
ORDER BY created_at DESC;
```

### Ver últimas notificações
```sql
SELECT id, user_id, title, message, is_read, created_at
FROM notifications
WHERE type IN ('mural_approved', 'mural_response')
ORDER BY created_at DESC
LIMIT 10;
```

### Verificar integração com Feed
```sql
SELECT fp.id, fp.title, fp.type, mp.status, mp.approval_source
FROM feed_posts fp
LEFT JOIN mural_posts mp ON fp.module_link LIKE '%' || mp.id::text || '%'
WHERE fp.type = 'mural'
ORDER BY fp.created_at DESC
LIMIT 10;
```

### Contar respostas por post
```sql
SELECT 
  mp.id,
  mp.content_clean,
  mp.response_count,
  COUNT(mr.id) as actual_responses
FROM mural_posts mp
LEFT JOIN mural_responses mr ON mr.post_id = mp.id AND mr.status = 'approved'
WHERE mp.status = 'approved'
GROUP BY mp.id, mp.content_clean, mp.response_count
HAVING mp.response_count != COUNT(mr.id);
```

---

## 🎯 Próximos Passos (Opcional)

- [ ] Adicionar métricas de engajamento no dashboard admin
- [ ] Implementar moderação via WhatsApp (integração Z-API)
- [ ] Criar relatórios semanais de posts e respostas
- [ ] Adicionar gamificação (badges para ajudadores ativos)
- [ ] Implementar busca e filtros no mural
- [ ] Permitir anexar imagens (com moderação)

---

## 📚 Documentação Relacionada

- [FEED_IA_GIRABOT.md](./FEED_IA_GIRABOT.md) - IA de moderação
- [AdminCrossConfig.tsx](./src/components/admin/AdminCrossConfig.tsx) - Configurações
- [Edge Functions do Mural](./supabase/functions/mural-*) - Backend

---

**Data de Criação**: 2025-10-29  
**Última Atualização**: 2025-10-29  
**Responsável**: Sistema Crescendo Conectado
