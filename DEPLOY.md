# 🚀 Tutorial Completo: Deploy do Abmix no EasyPanel

> **Guia passo-a-passo para fazer deploy do sistema Abmix de telefonia com IA no seu VPS usando EasyPanel**

---

## 📑 Índice

1. [Visão Geral](#-visão-geral)
2. [Pré-requisitos](#-pré-requisitos)
3. [Etapa 1: Garantir Código no GitHub](#-etapa-1-garantir-código-no-github)
4. [Etapa 2: Acessar e Conectar EasyPanel](#-etapa-2-acessar-e-conectar-easypanel)
5. [Etapa 3: Criar Aplicação](#-etapa-3-criar-aplicação)
6. [Etapa 4: Configurar Variáveis de Ambiente](#-etapa-4-configurar-variáveis-de-ambiente)
7. [Etapa 5: Configurações Avançadas (CRÍTICO)](#-etapa-5-configurações-avançadas-crítico)
8. [Etapa 6: Fazer o Deploy Inicial](#-etapa-6-fazer-o-deploy-inicial)
9. [Etapa 7: Verificar Funcionamento](#-etapa-7-verificar-funcionamento)
10. [Como Atualizar o Sistema (Redeploy)](#-como-atualizar-o-sistema-redeploy)
11. [Troubleshooting](#-troubleshooting)
12. [Checklist Final](#-checklist-final)

---

## 🎯 Visão Geral

### O Que Você Vai Fazer

```
1. GitHub       → Garantir que o código está no repositório
2. EasyPanel    → Conectar ao GitHub
3. Configurar   → Definir variáveis e portas (IMPORTANTE!)
4. Deploy       → Apertar o botão "Deploy"
5. Testar       → Confirmar que está funcionando
```

### Tempo Estimado
- **Primeira vez:** 15-20 minutos
- **Próximas atualizações (Redeploy):** 2-3 minutos

---

## 📋 Pré-requisitos

Antes de começar, tenha em mãos:

| Item | Onde Obter | Obrigatório? |
|------|------------|--------------|
| **VPS com EasyPanel instalado** | Seu provedor (DigitalOcean, Hetzner, etc) | ✅ SIM |
| **Conta GitHub** | https://github.com | ✅ SIM |
| **Senha FaleVono** | Sua conta vono2.me | ✅ SIM |
| **API Key ElevenLabs** | https://elevenlabs.io/app/settings/api-keys | ✅ SIM |
| **API Key Deepgram** | https://console.deepgram.com/ | ✅ SIM |
| **Domínio próprio** | Registrar.br, GoDaddy, etc | ⚪ OPCIONAL |

---

## ⚠️ **IMPORTANTE: Limitação do Ambiente de Desenvolvimento**

### Por Que Não Funciona no Replit?

O **Replit bloqueia portas UDP** no ambiente de desenvolvimento por razões de segurança e gerenciamento de recursos. Isso impacta diretamente o SIP:

- ✅ **SIP usa UDP** (porta 5060) por padrão para sinalização
- ✅ **RTP usa UDP** (portas 10000-20000) para áudio em tempo real
- ❌ **Replit bloqueia UDP** → Timeout nas tentativas de registro SIP

### Como Testar no Desenvolvimento?

Existem 3 opções:

1. **TCP Fallback** (limitado) - Adicione `SIP_USE_TCP=true` nas variáveis de ambiente
   - ⚠️ Nem todos providers SIP suportam TCP
   - ⚠️ FaleVono pode não aceitar conexões TCP

2. **Docker Local** - Execute `docker-compose up` na sua máquina
   - ✅ UDP funciona normalmente
   - ✅ Teste completo do sistema

3. **Deploy em Produção** - A forma recomendada
   - ✅ VPS/EasyPanel não tem restrições UDP
   - ✅ Sistema funciona 100%

**Recomendação:** Use Replit apenas para desenvolvimento do código. Para testar telefonia, faça deploy imediato no EasyPanel.

---

## 📂 Etapa 1: Garantir Código no GitHub

### 1.1 - Verificar Repositório Atual

O código já deve estar neste repositório GitHub:

```
Proprietário: Abmix-tech-Programacao
Repositório:  abmix-telefone
Branch:       main
URL:          https://github.com/Abmix-tech-Programacao/abmix-telefone
```

### 1.2 - Atualizar Código (Se Necessário)

Se você fez mudanças no Replit e ainda não enviou para o GitHub:

**No painel Git do Replit:**
1. Clique no ícone de **Source Control** (barra lateral esquerda)
2. Se houver mudanças pendentes, clique em **"Commit all"**
3. Escreva uma mensagem: `Update Abmix system`
4. Clique em **"Push"** para enviar ao GitHub

**OU via terminal:**
```bash
git add .
git commit -m "Update Abmix system"
git push origin main
```

### 1.3 - Confirmar GitHub Atualizado

Acesse: https://github.com/Abmix-tech-Programacao/abmix-telefone

Você deve ver os arquivos:
- ✅ `Dockerfile`
- ✅ `docker-compose.yml`
- ✅ `package.json`
- ✅ Pastas: `client`, `server`, `shared`

---

## 🖥️ Etapa 2: Acessar e Conectar EasyPanel

### 2.1 - Fazer Login no EasyPanel

Acesse o painel do seu VPS:

```
https://seu-dominio.com:3000
OU
http://IP-DO-SEU-VPS:3000
```

**Exemplo:**
```
https://vps.abmix.com.br:3000
http://123.45.67.89:3000
```

Faça login com seu **usuário e senha** do EasyPanel.

### 2.2 - Conectar ao GitHub (Primeira Vez)

Se é sua primeira vez usando EasyPanel com GitHub:

1. No menu lateral, clique em **"Settings"** (Configurações)
2. Vá em **"Git Providers"** ou **"Integrations"**
3. Clique em **"Connect GitHub"**
4. Você será redirecionado para o GitHub
5. **Autorize** o EasyPanel a acessar seus repositórios
6. Selecione:
   - ✅ **Acesso a repositórios específicos** (mais seguro)
   - Escolha: `Abmix-tech-Programacao/abmix-telefone`
7. Clique em **"Authorize EasyPanel"**
8. Você voltará ao EasyPanel

---

## 🏗️ Etapa 3: Criar Aplicação

### 3.1 - Iniciar Criação do App

1. No dashboard principal do EasyPanel, clique no botão:
   - **"+ Create"** OU
   - **"New Application"** OU
   - **"Add App"**

2. Selecione a opção: **"From GitHub Repository"** ou **"Git"**

### 3.2 - Selecionar Repositório

**Preencha EXATAMENTE assim:**

| Campo | Valor |
|-------|-------|
| **Repository** | `Abmix-tech-Programacao/abmix-telefone` |
| **Branch** | `main` |
| **Build Context** | `/` (raiz do projeto) |
| **Dockerfile Path** | `Dockerfile` |

### 3.3 - Definir Nome e Porta

| Campo | Valor |
|-------|-------|
| **Application Name** | `abmix` |
| **Port** | `5000` |

> 💡 **Dica:** O nome `abmix` será usado na URL e nos logs.

---

## 🔐 Etapa 4: Configurar Variáveis de Ambiente

Esta é a seção mais importante! Sem as variáveis corretas, o sistema não funcionará.

### 4.1 - Acessar Seção de Variáveis

Na tela de configuração do app (ou após criar), procure pela aba:
- **"Environment"** OU
- **"Environment Variables"** OU
- **"Variables"**

### 4.2 - Adicionar Cada Variável

Para cada variável abaixo, faça:

1. Clique em **"+ Add Variable"** ou **"+ New"**
2. **Name (Nome):** Digite exatamente como mostrado abaixo
3. **Value (Valor):** Cole sua chave/senha real
4. Clique em **"Save"** ou **"Add"**

### 4.3 - Lista Completa de Variáveis

#### ✅ Variáveis Obrigatórias

| Nome | Valor | Onde Obter |
|------|-------|------------|
| `NODE_ENV` | `production` | Digite exatamente assim |
| `PORT` | `5000` | Digite exatamente assim |
| `FALEVONO_PASSWORD` | Sua senha FaleVono | Sua conta vono2.me |
| `ELEVENLABS_API_KEY` | Sua chave ElevenLabs | Ver seção 4.4 |
| `DEEPGRAM_API_KEY` | Sua chave Deepgram | Ver seção 4.5 |

#### ⚙️ Variáveis Opcionais (Configuração Avançada)

| Nome | Valor Padrão | Quando Alterar |
|------|--------------|----------------|
| `FALEVONO_SIP_PORT` | `6060` | Se outra aplicação já estiver usando a porta 6060 |

> 💡 **Nota sobre Porta SIP:** A porta 6060 é usada para comunicação SIP cliente. Se você tem outra aplicação de telefonia rodando no mesmo servidor que usa a porta 6060, configure esta variável para uma porta diferente (exemplo: `7060`, `8060`, etc).

### 4.4 - Como Obter API Key do ElevenLabs

1. Acesse: https://elevenlabs.io/app/settings/api-keys
2. Faça login na sua conta ElevenLabs
3. Clique em **"Create API Key"** (se não tiver)
4. **Copie** a chave (começa com `sk_...`)
5. **Cole** no campo `ELEVENLABS_API_KEY` no EasyPanel

**Formato esperado:**
```
sk_abc123xyz456...
```

### 4.5 - Como Obter API Key do Deepgram

1. Acesse: https://console.deepgram.com/
2. Faça login na sua conta Deepgram
3. No menu lateral, clique em **"API Keys"**
4. Clique em **"Create New Key"**
5. Dê um nome: `Abmix Production`
6. **Copie** a chave gerada
7. **Cole** no campo `DEEPGRAM_API_KEY` no EasyPanel

**Formato esperado:**
```
abc123def456ghi789...
```

---

## ⚙️ Etapa 5: Configurações Avançadas (CRÍTICO)

> ⚠️ **ATENÇÃO:** Esta etapa é **OBRIGATÓRIA** para o SIP/telefonia funcionar!

### 5.1 - Acessar Configurações Avançadas

Procure pela aba ou seção:
- **"Advanced"** OU
- **"Advanced Settings"** OU
- **"Network"** OU
- **"Networking"**

### 5.2 - Configurar Network Mode = host

**🔴 CRÍTICO - SEM ISSO O SIP NÃO FUNCIONA!**

Procure a opção **"Network Mode"** e configure:

| Campo | Valor | Por Que? |
|-------|-------|----------|
| **Network Mode** | `host` | Permite comunicação UDP para SIP |

**Como fazer:**
1. Encontre o campo **"Network Mode"** (pode estar em dropdown)
2. Selecione a opção: **`host`**
3. Salve a configuração

> 💡 **Explicação Simples:** O protocolo SIP usa portas UDP dinâmicas. O modo `host` permite que o container acesse diretamente a rede do servidor, evitando bloqueios.

### 5.3 - Alternativa: Mapeamento de Portas Manual

**Use SOMENTE se a opção "Network Mode: host" não existir no seu EasyPanel:**

Adicione as seguintes portas:

| Container Port | Protocol | Published Port | Descrição |
|----------------|----------|----------------|-----------|
| `5000` | TCP | `5000` | Interface web |
| `6060` | UDP | `6060` | Cliente SIP (pode variar, veja `FALEVONO_SIP_PORT`) |

**Como adicionar:**
1. Procure por **"Port Mappings"** ou **"Ports"**
2. Clique em **"+ Add Port"**
3. Preencha cada linha da tabela acima
4. Salve

### 5.4 - Configurar Restart Policy

| Campo | Valor |
|-------|-------|
| **Restart Policy** | `unless-stopped` ou `always` |

Isso garante que o app reinicia automaticamente se cair.

---

## 🚀 Etapa 6: Fazer o Deploy Inicial

### 6.1 - Revisar Configurações

Antes de fazer deploy, confirme:

- ✅ Repositório GitHub conectado
- ✅ Branch: `main`
- ✅ Dockerfile Path: `Dockerfile`
- ✅ Porta: `5000`
- ✅ Variáveis de ambiente configuradas (5 obrigatórias)
- ✅ Network Mode: `host` (OU portas mapeadas)

### 6.2 - Iniciar Deploy

1. Procure o botão:
   - **"Deploy"** OU
   - **"Build & Deploy"** OU
   - **"Create & Deploy"**

2. **Clique** no botão

3. Você verá a tela de build em tempo real

### 6.3 - Acompanhar o Build

O processo de build leva **2-5 minutos** e passa por estas etapas:

```
1. ⏳ Cloning repository...        (30s)
2. ⏳ Building Docker image...     (2-4 min)
3. ⏳ Starting container...        (30s)
4. ✅ Running                      (pronto!)
```

**Mensagens esperadas nos logs:**
```
Building image...
Step 1/15 : FROM node:20-alpine AS build
Step 2/15 : WORKDIR /app
...
Successfully built abc123def456
Successfully tagged abmix:latest
Starting container...
Container started successfully
```

### 6.4 - Confirmar Status

Quando terminar, o status deve mostrar:

- ✅ **Status:** `Running` (verde)
- ✅ **Health:** `Healthy` (verde)
- ✅ **URL:** `http://seu-ip:5000` ou `https://seu-dominio.com`

---

## ✅ Etapa 7: Verificar Funcionamento

### 7.1 - Abrir a Interface Web

Acesse a URL do seu app:

```
https://seu-dominio.com
OU
http://IP-DO-VPS:5000
```

**O que você deve ver:**
- ✅ Interface do Abmix carregada
- ✅ Dashboard com opções de chamada
- ✅ Números VoIP disponíveis (FaleVono - SP)

### 7.2 - Testar Health Endpoint

Acesse:
```
https://seu-dominio.com/api/health
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-04T12:00:00.000Z",
  "services": {
    "database": "ok",
    "sip": "ok"
  }
}
```

### 7.3 - Verificar Logs do Sistema

No EasyPanel:

1. Vá para seu app **"abmix"**
2. Clique na aba **"Logs"**
3. Você verá logs em tempo real

**Logs esperados (SIP funcionando):**
```
[DB] Database initialized successfully
[SIP_SERVICE] Starting SIP stack for the first time...
[SIP_SERVICE] Global SIP stack started successfully
[SIP_SERVICE] Registering with server vono2.me:5060...
[SIP_SERVICE] >>> SENT: REGISTER sip:vono2.me:5060
[SIP_SERVICE] <<< RECEIVED: 401 Unauthorized (challenge)
[SIP_SERVICE] >>> SENT: REGISTER with auth credentials
[SIP_SERVICE] <<< RECEIVED: 200 OK
[SIP_SERVICE] ✅ Registration successful! Expires: 3600s
[ROUTES] API routes configured
HTTP/WS server listening on port 5000
```

> 💡 **Atenção:** Se você ver `❌ Registration failed`, vá para a seção [Troubleshooting](#-troubleshooting).

### 7.4 - Fazer uma Chamada Teste

1. Na interface web do Abmix:
   - Digite um número: `11999999999` (apenas DDD + número, sem +55)
   - Selecione: **FaleVono - SP**
   - Escolha voz: **Portuguese (Brazilian)**
   - Clique em **"Discar"** ou **"Call"**

2. Verifique os logs:
   ```
   [CALL] Initiating call to 11999999999
   [SIP_SERVICE] >>> SENT: INVITE sip:11999999999@vono2.me:5060
   [SIP_SERVICE] <<< RECEIVED: 100 Trying
   [SIP_SERVICE] <<< RECEIVED: 183 Session Progress
   [SIP_SERVICE] <<< RECEIVED: 200 OK
   [SIP_SERVICE] >>> SENT: ACK
   [CALL] ✅ Call established successfully!
   ```

3. O telefone deve tocar no número discado

### 7.5 - Testar Domínio e SSL (Se Configurou)

Se você adicionou um domínio:

1. Acesse: `https://seu-dominio.com`
2. Verifique o **cadeado verde** no navegador
3. Clique no cadeado → deve mostrar **"Conexão segura"**

Se o SSL ainda não funcionar:
- Aguarde **5-10 minutos** para propagação DNS
- O EasyPanel configura SSL automático via Let's Encrypt

---

## 🔄 Como Atualizar o Sistema (Redeploy)

### Quando Usar Redeploy

Use quando você fizer mudanças no código:
- ✏️ Corrigiu um bug
- ✨ Adicionou nova funcionalidade
- 🎨 Mudou a interface

### Passo 1: Atualizar Código no GitHub

**No Replit:**
```bash
# Após fazer suas mudanças
git add .
git commit -m "Descrição da mudança feita"
git push origin main
```

**OU no painel Git do Replit:**
1. Commit all
2. Push

### Passo 2: Fazer Redeploy no EasyPanel

1. Acesse o EasyPanel
2. Vá para seu app **"abmix"**
3. Procure o botão:
   - **"Redeploy"** OU
   - **"Rebuild"** OU
   - **"Deploy Latest"**
4. Clique no botão
5. Aguarde 2-3 minutos
6. Status volta para **"Running"** (verde)

### Diferença: Deploy vs Redeploy

| Ação | Quando Usar | Tempo |
|------|-------------|-------|
| **Deploy** | Primeira vez, app novo | 5-10 min |
| **Redeploy** | Atualizar código existente | 2-3 min |

### Auto-Deploy (Opcional)

Alguns painéis EasyPanel têm **auto-deploy** automático:

1. Vá em **"Settings"** do app
2. Procure **"Auto Deploy"** ou **"Continuous Deployment"**
3. Ative a opção
4. Agora toda vez que você fizer `git push`, o EasyPanel faz deploy automaticamente

---

## 🐛 Troubleshooting

### ❌ Problema: "SIP Registration Failed"

**Sintoma:** Nos logs aparece:
```
[SIP_SERVICE] ❌ Registration failed: timeout
```

**Causas possíveis:**

1. **Network Mode não está configurado como `host`**
   - ✅ Solução: Vá em Advanced → Network Mode → Selecione `host` → Redeploy

2. **Porta UDP 6060 bloqueada no firewall do VPS**
   - ✅ Solução: Acesse o VPS via SSH e execute:
   ```bash
   sudo ufw allow 6060/udp
   sudo ufw allow 5000/tcp
   sudo ufw reload
   ```

3. **Senha FaleVono incorreta**
   - ✅ Solução: Verifique a variável `FALEVONO_PASSWORD` no EasyPanel
   - Confirme a senha em: https://vono2.me

---

### ❌ Problema: "Build Failed"

**Sintoma:** Build para na metade com erro:
```
ERROR: failed to solve: process "/bin/sh -c npm install" did not complete successfully
```

**Causas possíveis:**

1. **Memória RAM insuficiente**
   - ✅ Solução: VPS precisa de **mínimo 1GB RAM**
   - Aumente recursos do VPS no provedor

2. **Dependências não instaladas**
   - ✅ Solução: Force rebuild limpo:
     - Delete o app no EasyPanel
     - Crie novamente do zero

3. **Dockerfile com erro**
   - ✅ Solução: Verifique se o arquivo `Dockerfile` está correto no GitHub

---

### ❌ Problema: "Cannot GET /"

**Sintoma:** Ao acessar `http://seu-ip:5000`, aparece:
```
Cannot GET /
```

**Causas possíveis:**

1. **Build do frontend falhou**
   - ✅ Solução: Verifique os logs de build
   - Procure por erros na etapa `vite build`

2. **Porta incorreta**
   - ✅ Solução: Confirme que a variável `PORT=5000` está definida

---

### ❌ Problema: "API Key Invalid" (ElevenLabs ou Deepgram)

**Sintoma:** Nos logs aparece:
```
[ELEVENLABS] Error: Invalid API key
```

**Solução:**
1. Verifique se copiou a chave completa (sem espaços extras)
2. Gere uma nova chave no painel:
   - ElevenLabs: https://elevenlabs.io/app/settings/api-keys
   - Deepgram: https://console.deepgram.com/
3. Atualize a variável no EasyPanel
4. Redeploy

---

### ❌ Problema: "Port 5000 Already in Use"

**Sintoma:**
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solução:**
1. Outro app está usando a porta 5000
2. Mude a porta no EasyPanel para `5001` ou `8000`
3. Atualize a variável `PORT=5001`
4. Redeploy

---

### ❌ Problema: SSL/HTTPS Não Funciona

**Sintoma:** Aparece "Conexão não segura" no navegador

**Solução:**

1. **Aguarde 10-15 minutos** após adicionar o domínio
   - Let's Encrypt leva tempo para validar

2. Verifique DNS do domínio:
   ```bash
   nslookup seu-dominio.com
   ```
   Deve apontar para o IP do seu VPS

3. No EasyPanel, vá em **Domains** → **Force SSL Renewal**

---

## 📊 Monitoramento e Manutenção

### Ver Logs em Tempo Real

No EasyPanel:
1. App **"abmix"** → **Logs**
2. Logs aparecem automaticamente
3. Use filtros para procurar:
   - `ERROR` - Erros críticos
   - `SIP` - Status da telefonia
   - `CALL` - Status de chamadas

### Verificar Uso de Recursos

No EasyPanel:
1. App **"abmix"** → **Metrics** (ou **Statistics**)
2. Veja gráficos de:
   - 💾 **RAM**: Deve ficar abaixo de 80%
   - 🔄 **CPU**: Picos durante chamadas são normais
   - 📶 **Network**: Tráfego aumenta com chamadas

### Backup do Banco de Dados

O banco SQLite fica em `/app/data/app.db`.

Para fazer backup:
```bash
# Acessar o container
docker exec -it abmix sh

# Copiar banco de dados
cp /app/data/app.db /app/data/backup-$(date +%Y%m%d).db
```

---

## ✅ Checklist Final

Antes de considerar o deploy **100% completo**, marque todos os itens:

### Configuração Básica
- [ ] Repositório GitHub atualizado
- [ ] App criado no EasyPanel
- [ ] Dockerfile Path: `Dockerfile`
- [ ] Branch: `main`
- [ ] Port: `5000`

### Variáveis de Ambiente
- [ ] `NODE_ENV=production`
- [ ] `PORT=5000`
- [ ] `FALEVONO_PASSWORD` (senha correta)
- [ ] `ELEVENLABS_API_KEY` (chave válida)
- [ ] `DEEPGRAM_API_KEY` (chave válida)

### Configurações Avançadas
- [ ] **Network Mode: `host`** (CRÍTICO!)
- [ ] Restart Policy: `unless-stopped`
- [ ] Firewall liberado (portas 5000/TCP e 6060/UDP)

### Testes de Funcionamento
- [ ] Interface web abre no navegador
- [ ] Health endpoint retorna `{"status":"ok"}`
- [ ] Logs mostram `✅ Registration successful`
- [ ] Consegue fazer uma chamada teste
- [ ] Telefone toca no número discado

### Segurança e Extras
- [ ] SSL configurado (se usar domínio)
- [ ] Senhas/API keys não estão no código
- [ ] Backup do banco de dados configurado
- [ ] Monitoramento ativo

---

## 🎉 Parabéns!

Se você marcou **todos os itens** do checklist, seu sistema Abmix está:

✅ **Funcionando em produção**  
✅ **Fazendo chamadas VoIP reais**  
✅ **Integrado com IA (ElevenLabs + Deepgram)**  
✅ **Seguro e monitorado**  

---

## 📞 Suporte e Documentação

### Comandos Úteis (SSH no VPS)

```bash
# Ver containers rodando
docker ps

# Ver logs do container
docker logs abmix -f --tail 100

# Entrar no container
docker exec -it abmix sh

# Reiniciar container
docker restart abmix

# Verificar portas abertas
sudo netstat -tulpn | grep 5000
sudo netstat -tulpn | grep 6060
```

### Links Úteis

- **FaleVono:** https://vono2.me
- **ElevenLabs API Keys:** https://elevenlabs.io/app/settings/api-keys
- **Deepgram Console:** https://console.deepgram.com/
- **Documentação Docker:** https://docs.docker.com/
- **Let's Encrypt Status:** https://letsencrypt.status.io/

---

## 🔄 Próximos Passos

Agora que o sistema está no ar, você pode:

1. **Adicionar mais números VoIP** no painel
2. **Customizar vozes da IA** no ElevenLabs
3. **Configurar webhooks** para integrações
4. **Escalar** adicionando mais recursos ao VPS
5. **Monitorar** métricas de chamadas e uso

---

**Desenvolvido com ❤️ para Abmix**  
*Sistema de Telefonia Inteligente com IA*
