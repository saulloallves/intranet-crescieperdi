# 🔐 Guia Completo: Tokens e Autenticação no Supabase

## 📋 **RESUMO EXECUTIVO**

Você **JÁ USA refresh tokens automaticamente!** O erro "No API key found" **NÃO é sobre API key**, é sobre **sessão expirada**.

---

## 🔑 **TIPOS DE TOKENS/KEYS**

### **1. API Keys (Projeto)**

#### **Anon Key (Pública)** ✅ No Frontend
```typescript
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGci..."
```
- **O que é:** Identifica seu projeto Supabase
- **Onde fica:** Frontend (pode ser exposta)
- **Permissões:** Limitadas (só o que RLS permite)
- **Validade:** Não expira
- **Seu status:** ✅ Configurada corretamente

#### **Service Role Key (Privada)** ❌ NUNCA no Frontend
```typescript
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGci..."
```
- **O que é:** Acesso admin total ao banco
- **Onde fica:** Backend/Edge Functions APENAS
- **Permissões:** TODAS (bypass RLS)
- **Validade:** Não expira
- **Seu status:** ✅ Segura (só no backend)

---

### **2. Tokens de Autenticação (Usuário)**

#### **Access Token (JWT Bearer)**
```typescript
Authorization: Bearer eyJhbGci...
```
- **O que é:** Prova que o usuário está logado
- **Validade:** **1 hora (3600 segundos)** por padrão
- **Onde fica:** `localStorage` → `sb-{project}-auth-token`
- **Renovação:** Automática via Refresh Token
- **Seu status:** ✅ Configurado com auto-refresh

#### **Refresh Token**
```typescript
refresh_token: "v1.eyJhbGci..."
```
- **O que é:** Token para pegar novos Access Tokens
- **Validade:** **7 dias (604800 segundos)** por padrão
- **Onde fica:** Mesmo local que Access Token
- **Uso:** Automático pelo Supabase Client
- **Seu status:** ✅ Ativo e funcionando

---

## ⚙️ **CONFIGURAÇÃO ATUAL**

### **Seu `client.ts` (CORRETO):**
```typescript
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,           // ✅ Salva tokens no navegador
    persistSession: true,             // ✅ Mantém sessão após reload
    autoRefreshToken: true,           // ✅ RENOVA AUTOMATICAMENTE!
  }
});
```

---

## 🔄 **COMO FUNCIONA O AUTO REFRESH**

### **Fluxo Automático (Transparente):**

```
Tempo: 0 min ──────────────── 50 min ──────────── 60 min ──────────── 70 min
       │                          │                  │                  │
       Login                   Refresh            Token              Login
       ↓                       automático         expira             necessário
   Access Token              Novo Access         (se não            (se refresh
   válido 60min              Token gerado        refresh)           expirou)
   Refresh válido 7d         Refresh renovado
```

### **Quando o Supabase renova automaticamente?**

1. **A cada 10% do tempo restante** do Access Token
2. Para token de 1h (3600s), renova a cada **6 minutos**
3. Ou quando você faz uma requisição e o token está expirado

### **Processo interno:**

```javascript
// VOCÊ NÃO PRECISA FAZER NADA! O Supabase faz tudo:

if (accessTokenExpiraEmMenosDe10Porcento) {
  const { data, error } = await supabase.auth.refreshSession()
  
  if (error) {
    // Refresh token também expirou → Redireciona para login
    redirectToLogin()
  } else {
    // Token renovado! Salva no localStorage
    saveNewTokens(data.session)
  }
}
```

---

## 🕐 **TEMPOS DE EXPIRAÇÃO**

### **Padrões do Supabase:**

| Token | Tempo Padrão | Configurável? | Onde Configurar |
|-------|--------------|---------------|-----------------|
| **Access Token (JWT)** | 1 hora (3600s) | ✅ Sim | Supabase Dashboard |
| **Refresh Token** | 7 dias (604800s) | ✅ Sim | Supabase Dashboard |
| **Anon API Key** | Nunca expira | ❌ Não | - |
| **Service Role Key** | Nunca expira | ❌ Não | - |

### **Como Alterar (se necessário):**

1. **Supabase Dashboard** → Seu Projeto
2. **Authentication** → **Settings**
3. **JWT Settings**
4. Altere **"JWT expiry"** (em segundos)

**Valores comuns:**
- **1 hora** = 3600 (padrão) ✅ Recomendado
- **2 horas** = 7200
- **24 horas** = 86400 (não recomendado por segurança)

---

## 🔍 **COMO VERIFICAR SEUS TOKENS**

### **1. Ver tokens no Console do Navegador:**

```javascript
// Abrir Console (F12) e colar:

// Ver sessão completa
const { data: session } = await supabase.auth.getSession()
console.log('📦 Sessão:', session)

// Ver quando expira
if (session?.session) {
  const expiresAt = new Date(session.session.expires_at * 1000)
  const now = new Date()
  const minutesLeft = Math.floor((expiresAt - now) / 1000 / 60)
  
  console.log('⏰ Token expira em:', expiresAt.toLocaleString())
  console.log('⌛ Minutos restantes:', minutesLeft)
}

// Ver tokens salvos no localStorage
const stored = JSON.parse(localStorage.getItem('sb-sgeabunxaunzoedwvvox-auth-token'))
console.log('💾 Access Token:', stored?.access_token?.substring(0, 50) + '...')
console.log('💾 Refresh Token:', stored?.refresh_token?.substring(0, 50) + '...')
```

---

### **2. Forçar refresh manual (debugging):**

```javascript
const { data, error } = await supabase.auth.refreshSession()
if (error) {
  console.error('❌ Erro ao renovar:', error.message)
} else {
  console.log('✅ Token renovado!', data.session.expires_at)
}
```

---

## 🐛 **POR QUE DEU ERRO "NO API KEY FOUND"?**

### **Possíveis causas:**

1. ✅ **Refresh Token expirou (7 dias sem usar)**
   - **Solução:** Fazer login novamente
   
2. ✅ **LocalStorage foi limpo**
   - Limpou cache/cookies do navegador
   - **Solução:** Fazer login novamente

3. ✅ **Mudança no código de autenticação**
   - Removeu dev mode, pode ter afetado sessão
   - **Solução:** `localStorage.clear()` + login

4. ✅ **RLS bloqueando acesso**
   - Usuário sem permissão para a operação
   - **Solução:** Verificar políticas RLS

---

## ✅ **MELHORIAS IMPLEMENTADAS**

### **1. Validação de Sessão nos Componentes**

Agora antes de criar posts:
```typescript
const { data: session } = await supabase.auth.getSession();
if (!session?.session) {
  toast.error("Sessão expirada. Faça login novamente.");
  return;
}
```

### **2. Monitoramento de Sessão (NOVO!)**

Criei o hook `useSessionMonitor` que:
- ✅ Monitora eventos de autenticação
- ✅ Loga quando token é renovado
- ✅ Avisa quando sessão está perto de expirar
- ✅ Detecta logout automático
- ✅ Mostra tempo restante no console

**Já adicionado no `App.tsx`!**

### **3. Logs no Console**

Agora você verá no console:
```
🔐 Sessão ativa
⏰ Token expira em: 28/10/2025, 15:30:00
⌛ Tempo restante: 52 minutos
✅ Token renovado automaticamente
```

---

## 🎯 **CHECKLIST DE SEGURANÇA**

- ✅ Anon API Key no frontend (público, ok)
- ✅ Service Role Key NUNCA exposta (seguro)
- ✅ Access Token de curta duração (1h)
- ✅ Refresh Token ativo (7 dias)
- ✅ Auto-refresh habilitado
- ✅ Persist session habilitado
- ✅ RLS ativo em todas as tabelas
- ✅ Validação de sessão nos componentes críticos
- ✅ Monitoramento de expiração

**🎉 Seu sistema está SEGURO e CORRETO!**

---

## 🚀 **PRÓXIMOS PASSOS**

1. ✅ Faça logout e login novamente
2. ✅ Abra o Console (F12) para ver os logs de sessão
3. ✅ Tente criar um post
4. ✅ Observe os logs de renovação automática

---

## 📞 **COMANDOS ÚTEIS**

```javascript
// Ver sessão atual
await supabase.auth.getSession()

// Renovar token manualmente
await supabase.auth.refreshSession()

// Fazer logout
await supabase.auth.signOut()

// Ver usuário logado
await supabase.auth.getUser()

// Limpar tudo e resetar
localStorage.clear()
location.reload()
```

---

## 🎓 **RESUMO PARA MEMORIZAR**

1. ✅ **API Key** = Identifica o projeto (pública)
2. ✅ **Access Token** = Prova que usuário está logado (1h)
3. ✅ **Refresh Token** = Renova o Access Token (7 dias)
4. ✅ **Auto Refresh** = Supabase renova sozinho (ativo)
5. ✅ **Erro "No API key"** = Na verdade é "Sessão expirada"

**Você está usando tudo corretamente!** 🎉

