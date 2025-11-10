# 🔧 Solução: Erro 403 "No API key found in request"

**Erro:** `{"message":"No API key found in request","hint":"No apikey request header or url param was found."}`

**Contexto:** Ao criar um treinamento no Admin

---

## 🎯 CAUSA DO PROBLEMA

O erro **NÃO** é falta de API key. As chaves já estão configuradas em:
```typescript
// src/integrations/supabase/client.ts
const SUPABASE_URL = "https://sgeabunxaunzoedwvvox.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGc..." // Sua chave está aqui
```

### Causas Reais (em ordem de probabilidade):

1. **🔴 MAIS PROVÁVEL: Sessão Expirada**
   - Você fez login há muito tempo
   - O token JWT expirou
   - Supabase não consegue validar sua identidade

2. **🟡 PERMISSÕES RLS**
   - Row Level Security está bloqueando
   - Seu usuário não tem role `admin` ou `gestor_setor`
   - Policies não permitem INSERT

3. **🟡 CACHE DO NAVEGADOR**
   - Token antigo em cache
   - LocalStorage corrompido

---

## ✅ SOLUÇÃO APLICADA

Atualizei `AdminTreinamentos.tsx` para:

### 1. Verificar Sessão Antes de Inserir
```typescript
// Verifica se está autenticado
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  toast({
    title: 'Sessão expirada',
    description: 'Faça login novamente para continuar.',
  });
  return;
}
```

### 2. Melhor Tratamento de Erros
```typescript
if (error) {
  console.error('Erro ao criar treinamento:', error);
  throw error;
}

// Catch com mensagem detalhada
catch (error: any) {
  console.error('Erro completo:', error);
  toast({
    title: 'Erro ao criar treinamento',
    description: error.message || 'Verifique suas permissões.',
  });
}
```

---

## 🔍 COMO DIAGNOSTICAR

### Passo 1: Verificar no Console do Navegador

Abra o DevTools (F12) e tente criar o treinamento novamente. Agora você verá:
```javascript
Erro ao criar treinamento: {código, mensagem, detalhes}
Erro completo: {objeto completo}
```

### Passo 2: Verificar Autenticação

No console do navegador, execute:
```javascript
const { data } = await supabase.auth.getSession();
console.log('Sessão:', data.session);
console.log('Usuário:', data.session?.user);
```

**Resultado esperado:**
- ✅ `session` não é null
- ✅ `user.id` existe
- ✅ Token está presente

**Problema:**
- ❌ `session` é null → **Faça login novamente**

### Passo 3: Verificar Role do Usuário

```javascript
const { data } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', 'SEU_USER_ID')
  .single();
  
console.log('Seu role:', data.role);
```

**Para criar treinamentos, você precisa ser:**
- ✅ `admin` OU
- ✅ `gestor_setor`

---

## 🛠️ SOLUÇÕES RÁPIDAS

### Solução 1: Fazer Logout/Login
```
1. Clique em "Sair" no sistema
2. Faça login novamente
3. Tente criar o treinamento
```

### Solução 2: Limpar Cache
```javascript
// No console do navegador (F12):
localStorage.clear();
sessionStorage.clear();
location.reload();
```

Depois faça login novamente.

### Solução 3: Verificar/Atualizar Role no Banco

Se você não é admin, execute no Supabase SQL Editor:

```sql
-- Ver seu role atual
SELECT id, email, role 
FROM profiles 
WHERE email = 'SEU_EMAIL@email.com';

-- Tornar-se admin (se necessário)
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'SEU_EMAIL@email.com';
```

---

## 📊 VERIFICAR POLICIES RLS

Execute no Supabase SQL Editor:

```sql
-- Ver policies da tabela trainings
SELECT 
  policyname, 
  cmd, 
  qual 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'trainings';
```

**Você deve ver algo como:**
```
"Admins can manage trainings" | ALL | (EXISTS ( SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor_setor')))
```

### Se a Policy Não Existir, Crie:

```sql
-- Permitir admins e gestores criarem treinamentos
CREATE POLICY "Admins can manage trainings"
  ON public.trainings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() 
        AND role IN ('admin', 'gestor_setor')
    )
  );
```

---

## 🧪 TESTE COMPLETO

### 1. Teste de Autenticação
```javascript
// Console do navegador
const { data: { session } } = await supabase.auth.getSession();
console.log('✅ Autenticado:', !!session);
console.log('📧 Email:', session?.user?.email);
console.log('🆔 User ID:', session?.user?.id);
```

### 2. Teste de Role
```javascript
const { data: profile } = await supabase
  .from('profiles')
  .select('role, full_name')
  .eq('id', session.user.id)
  .single();
  
console.log('👤 Nome:', profile.full_name);
console.log('🎭 Role:', profile.role);
console.log('✅ Pode criar?', ['admin', 'gestor_setor'].includes(profile.role));
```

### 3. Teste de Inserção Direto
```javascript
const { data, error } = await supabase
  .from('trainings')
  .insert([{
    title: 'Teste',
    description: 'Teste de criação',
    category: 'teste',
    duration_minutes: 10,
    is_published: false
  }])
  .select();

if (error) {
  console.error('❌ Erro:', error);
} else {
  console.log('✅ Sucesso:', data);
}
```

---

## 🔐 VERIFICAR CONFIGURAÇÃO DO SUPABASE

### 1. Autenticação Habilitada?

No Supabase Dashboard:
1. Authentication → Settings
2. Verificar se "Enable email provider" está ON

### 2. RLS Habilitado?

```sql
-- Verificar se RLS está ativo
SELECT 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'trainings';
```

Deve retornar: `rowsecurity = true`

### 3. Service Role Key (Para Edge Functions)

Se o problema for em Edge Functions, você precisa da **Service Role Key**:

1. Supabase Dashboard → Settings → API
2. Copie a **service_role** key (não a anon key!)
3. Configure como variável de ambiente: `SUPABASE_SERVICE_ROLE_KEY`

**⚠️ NUNCA use service_role no frontend!**

---

## 📝 CHECKLIST DE RESOLUÇÃO

- [ ] Fiz logout e login novamente
- [ ] Limpei cache do navegador
- [ ] Verifiquei que sou admin ou gestor_setor
- [ ] Vi os logs detalhados no console (F12)
- [ ] Verifiquei que RLS está configurado
- [ ] Verifiquei que as policies permitem INSERT
- [ ] Testei com o código de teste acima
- [ ] Erro persiste mesmo após tudo acima

---

## 🆘 SE NADA FUNCIONAR

### 1. Desabilitar RLS Temporariamente (APENAS PARA TESTE!)

```sql
-- ⚠️ APENAS EM DESENVOLVIMENTO!
ALTER TABLE trainings DISABLE ROW LEVEL SECURITY;
```

Se funcionar → problema é nas policies RLS
Se não funcionar → problema é autenticação/sessão

**NÃO ESQUEÇA DE REABILITAR:**
```sql
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;
```

### 2. Ver Logs do Supabase

No Supabase Dashboard:
1. Logs → Postgres Logs
2. Filtrar por "INSERT" e "trainings"
3. Ver erro detalhado

### 3. Criar Treinamento Via SQL Direto

```sql
INSERT INTO trainings (
  title,
  description,
  category,
  duration_minutes,
  is_published
) VALUES (
  'Teste Manual',
  'Criado via SQL',
  'teste',
  30,
  false
) RETURNING *;
```

Se funcionar → problema é no frontend/autenticação
Se não funcionar → problema é no banco

---

## ✅ RESUMO

**Problema:** Erro 403 "No API key found"  
**Causa Real:** Sessão expirada ou permissões RLS  
**Solução:** Fazer logout/login + verificar role admin

**Arquivo Corrigido:** `src/components/admin/AdminTreinamentos.tsx`

**Melhorias Aplicadas:**
- ✅ Verifica sessão antes de inserir
- ✅ Mensagens de erro mais claras
- ✅ Logs detalhados no console
- ✅ Tratamento de sessão expirada

**Próximo Passo:** 
1. Abra o DevTools (F12)
2. Tente criar um treinamento
3. Veja os logs detalhados
4. Me mande o erro que aparecer

---

*Solução criada em: 28/10/2025*  
*Arquivo atualizado: AdminTreinamentos.tsx*

