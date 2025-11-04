# 🚀 Guia de Deploy - Abmix no VPS com EasyPanel

Este guia te leva do zero ao deploy completo do sistema Abmix no seu VPS com EasyPanel usando FaleVono.

---

## 📋 Pré-requisitos

✅ VPS com EasyPanel instalado  
✅ Conta FaleVono ativa (vono2.me)  
✅ Conta ElevenLabs (para voice AI)  
✅ Conta GitHub, GitLab ou Bitbucket  

---

## 🔧 PASSO 1: Preparar o Repositório Git

### 1.1 - Criar Repositório no GitHub

1. Acesse https://github.com/new
2. Nome do repositório: `abmix-voip`
3. Visibilidade: Private (recomendado)
4. **NÃO** marque "Initialize with README"
5. Clique em "Create repository"

### 1.2 - Fazer Push do Código

Copie e execute estes comandos no terminal do Replit:

```bash
# Inicializar Git (se ainda não estiver)
git init

# Adicionar todos os arquivos
git add .

# Fazer commit inicial
git commit -m "Deploy inicial - Abmix VoIP System"

# Conectar ao GitHub (substitua SEU_USUARIO pelo seu username)
git remote add origin https://github.com/SEU_USUARIO/abmix-voip.git

# Enviar código
git branch -M main
git push -u origin main
```

**Importante:** O GitHub vai pedir suas credenciais. Use:
- **Username:** seu_usuario_github
- **Password:** Personal Access Token (crie em: github.com/settings/tokens)

---

## 🖥️ PASSO 2: Configurar no EasyPanel

### 2.1 - Acessar EasyPanel

Abra seu navegador e acesse:
```
https://seu-dominio.com:3000
ou
http://IP-DA-VPS:3000
```

Faça login com suas credenciais EasyPanel.

### 2.2 - Criar Novo App

1. Clique em **"+ Create"** ou **"New App"**
2. Selecione **"GitHub"** (ou seu provedor Git)
3. **Autorize** EasyPanel a acessar seus repositórios
4. Selecione o repositório conforme abaixo

### 2.3 - Configurações Básicas (COPIE EXATAMENTE)

Preencha no EasyPanel exatamente como está aqui:

**Proprietário:**
```
Abmix-tech-Programacao
```

**Repositório:**
```
abmix-telefone
```

**Ramo:**
```
main
```

**Caminho de Build:**
```
/
```

**Dockerfile Path:**
```
Dockerfile
```

**Port:**
```
5000
```

### 2.4 - Configurar Domínio (Opcional)

Se você tem um domínio:

1. Na seção **"Domains"**, clique em **"Add Domain"**
2. Digite: `abmix.seudominio.com`
3. EasyPanel vai configurar **SSL automático** via Let's Encrypt
4. Aguarde alguns minutos para propagação DNS

Se não tem domínio, o EasyPanel vai gerar uma URL automática.

---

## 🔐 PASSO 3: Configurar Variáveis de Ambiente

**MUITO IMPORTANTE** - Clique na aba **"Environment"** e adicione:

### Variáveis Obrigatórias:

```env
NODE_ENV=production
PORT=5000
FALEVONO_PASSWORD=sua_senha_falevono
ELEVENLABS_API_KEY=sk_sua_chave_elevenlabs
DEEPGRAM_API_KEY=sua_chave_deepgram
```

**Como adicionar:**
1. Clique em **"+ Add Variable"**
2. **Name:** Digite o nome (ex: `FALEVONO_PASSWORD`)
3. **Value:** Cole sua senha real da FaleVono
4. Clique em **"Save"**
5. Repita para cada variável

### Onde obter as chaves:

**ELEVENLABS_API_KEY:**
- Acesse: https://elevenlabs.io/app/settings/api-keys
- Copie sua API Key

**DEEPGRAM_API_KEY:**
- Acesse: https://console.deepgram.com/
- Vá em: Project → API Keys → Create New Key
- Copie a chave

---

## 🌐 PASSO 4: Configurar Rede para SIP/UDP

**CRÍTICO** - Esta configuração permite que o SIP funcione:

### Opção A: Network Mode Host (Recomendado)

1. Vá para a aba **"Advanced"** ou **"Networking"**
2. Encontre a opção **"Network Mode"**
3. Selecione: **`host`**
4. Salve as configurações

### Opção B: Port Mapping Manual

Se "Network Mode Host" não estiver disponível:

1. Na seção **"Ports"**, adicione:
   ```
   Container Port: 5000
   Protocol: TCP
   Published Port: 5000
   ```

2. Adicione porta UDP para SIP:
   ```
   Container Port: 6060
   Protocol: UDP
   Published Port: 6060
   ```

---

## 🚀 PASSO 5: Deploy!

1. Clique no botão **"Deploy"** ou **"Build & Deploy"**
2. Aguarde o build (2-5 minutos)
3. Acompanhe os logs em tempo real

**Status esperado:**
```
✓ Building... (1-2 min)
✓ Starting... (30s)
✓ Running (verde)
```

---

## ✅ PASSO 6: Verificar se Funcionou

### 6.1 - Abrir a Aplicação

Acesse:
```
https://abmix.seudominio.com
ou
http://IP-DA-VPS:5000
```

Você deve ver a interface do Abmix!

### 6.2 - Testar uma Chamada

1. Na interface, digite um número: `11999999999` (apenas DDD + número)
2. Selecione: **FaleVono - SP**
3. Clique em **"Discar"**
4. Verifique os logs no EasyPanel

### 6.3 - Verificar Logs

No EasyPanel, vá em:
- **Logs** → Veja mensagens do sistema
- Procure por: `[SIP_SERVICE]` para ver status SIP
- Procure por: `[CALL]` para ver status das chamadas

**Logs esperados (sucesso):**
```
[SIP_SERVICE] Starting SIP stack for the first time...
[SIP_SERVICE] Global SIP stack started successfully
[SIP_SERVICE] Registering...
[SIP_SERVICE] >>> SENT: REGISTER sip:vono2.me:5060
[SIP_SERVICE] <<< RECEIVED: 200 OK
[SIP_SERVICE] ✅ Registration successful!
```

---

## 🐛 Troubleshooting

### Problema: "SIP not registered"

**Causa:** Porta UDP 5060 bloqueada

**Solução:**
1. Verifique se configurou **Network Mode: host**
2. Ou se adicionou porta **6060/udp**
3. Verifique firewall do VPS:
   ```bash
   sudo ufw allow 6060/udp
   sudo ufw allow 5000/tcp
   ```

### Problema: "Build failed"

**Causa:** Falta de memória ou dependências

**Solução:**
1. Aumente recursos do VPS (mínimo 1GB RAM)
2. Ou desabilite build multi-stage no Dockerfile (linha 25)

### Problema: App não abre (404)

**Causa:** Build não encontrou o código

**Solução:**
1. Verifique se fez push do código para GitHub
2. Confirme que selecionou o repositório correto
3. Verifique branch correta (main)

### Problema: "Cannot find module"

**Causa:** Dependencies não instaladas

**Solução:**
1. Verifique logs de build
2. Force rebuild: Clique em **"Rebuild"** no EasyPanel
3. Delete e recrie o app

---

## 🔄 Como Fazer Updates

Quando você fizer alterações no código:

```bash
# No Replit ou seu editor local
git add .
git commit -m "Descrição da mudança"
git push origin main
```

**No EasyPanel:**
1. Clique em **"Redeploy"** ou **"Rebuild"**
2. Aguarde novo build (~2 min)
3. Aplicação reinicia automaticamente

---

## 📊 Monitoramento

### Ver Logs em Tempo Real

No EasyPanel:
1. Vá para seu app **"abmix"**
2. Clique em **"Logs"**
3. Logs aparecem em tempo real

### Health Check

O Docker verifica automaticamente a saúde do app:
```
http://seu-dominio.com/api/health
```

Deve retornar:
```json
{
  "status": "ok",
  "timestamp": "2025-11-03T23:00:00.000Z"
}
```

### Persistência de Dados

O banco de dados SQLite fica em:
```
/app/data/app.db
```

É persistido automaticamente via volume Docker.

---

## 🔒 Segurança

### Variáveis de Ambiente

✅ **NUNCA** commite o arquivo `.env` para Git  
✅ **SEMPRE** use variáveis de ambiente no EasyPanel  
✅ **NUNCA** exponha FALEVONO_PASSWORD ou API KEYS  

### SSL/HTTPS

EasyPanel configura SSL automaticamente se você:
1. Adicionar um domínio próprio
2. Aguardar validação Let's Encrypt (~5 min)

---

## 📞 Suporte

Se tiver problemas:

1. **Verifique logs** no EasyPanel primeiro
2. **Teste health endpoint:** `/api/health`
3. **Verifique portas UDP:** 6060/udp deve estar aberta
4. **Confirme credenciais:** FALEVONO_PASSWORD correto

**Comandos úteis para debug no VPS:**

```bash
# Ver containers rodando
docker ps

# Ver logs do container
docker logs abmix-voip -f --tail 100

# Entrar no container
docker exec -it abmix-voip sh

# Testar conectividade SIP
nc -u vono2.me 5060
```

---

## ✅ Checklist Final

Antes de considerar o deploy completo, verifique:

- [ ] App acessível via navegador
- [ ] Interface Abmix carrega corretamente
- [ ] Pode fazer login/acessar dashboard
- [ ] Consegue fazer uma chamada teste
- [ ] Logs mostram "Registration successful"
- [ ] Health check retorna 200 OK
- [ ] SSL configurado (se usar domínio)
- [ ] Variáveis de ambiente todas configuradas

---

🎉 **Parabéns! Seu sistema Abmix está no ar com FaleVono!**

Agora você pode fazer chamadas VoIP com IA diretamente do seu VPS!
