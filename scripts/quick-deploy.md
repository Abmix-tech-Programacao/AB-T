# ⚡ Deploy Rápido para VPS

## 🎯 **Resposta Direta:**

**SIM!** É exatamente isso, mas com alguns detalhes importantes:

### **📦 Comandos Exatos:**

```bash
# 1. Local - Build
npm run build

# 2. Enviar para VPS (via SCP/RSYNC)
scp -r dist/ package.json package-lock.json .env usuario@seu-dominio.com:/var/www/abmix/

# 3. Na VPS - Instalar e iniciar
ssh usuario@seu-dominio.com
cd /var/www/abmix
npm install --production
npm start
```

### **⚠️ Pontos CRÍTICOS:**

#### **1. Arquivo .env OBRIGATÓRIO:**
```env
# Mude esta linha para sua URL pública:
PUBLIC_BASE_URL=https://seu-dominio.com

# Mantenha as outras chaves iguais:
ELEVENLABS_API_KEY=sk_sua_chave_aqui
TWILIO_ACCOUNT_SID=AC_seu_sid_aqui
TWILIO_AUTH_TOKEN=seu_token_aqui
TWILIO_NUMBER=+14474442595
NODE_ENV=production
```

#### **2. HTTPS Obrigatório:**
- WebSocket precisa de `wss://` (não `ws://`)
- Configure SSL no seu domínio
- Use Let's Encrypt ou certificado próprio

#### **3. Nginx (Recomendado):**
Configure proxy para porta 5000 e WebSocket

### **🚀 Processo Completo:**

```bash
# === LOCAL ===
npm run build
scp -r dist/ package.json .env usuario@seu-dominio.com:/var/www/abmix/

# === VPS ===
ssh usuario@seu-dominio.com
cd /var/www/abmix
npm install --production

# Editar .env para URL pública
nano .env
# Mudar: PUBLIC_BASE_URL=https://seu-dominio.com

# Iniciar (escolha uma opção)
npm start                    # Simples
# OU
pm2 start dist/index.js --name abmix  # Recomendado
```

### **✅ Resultado:**

Após deploy, você terá:
- 🌐 **Painel**: `https://seu-dominio.com`
- 🎤 **Conversão real**: WebSocket `wss://seu-dominio.com/media`
- 📞 **Ligações**: Funcionando com conversão de voz
- 🔄 **Controles**: Switch ativa/desativa conversão

### **🧪 Como Testar:**

1. **Acesse**: `https://seu-dominio.com`
2. **Faça ligação** pelo painel
3. **Ative conversão** no switch
4. **Converse** - sua voz será modificada!

**É isso! Simples e direto.** 🎯

---

**💡 Dica:** Use o script `./scripts/deploy.sh usuario@seu-dominio.com` para automatizar todo o processo!






