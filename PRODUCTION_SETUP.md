# Configuração de Produção - Abmix Telefone Inteligente

## Informações do Domínio Customizado

### Endereços de Acesso
- **URL Principal**: https://telefoneinteligente.abmix.tech
- **IP do Servidor**: 72.60.149.107
- **Ambiente**: Produção

## Configuração DNS Necessária

Para que o domínio customizado funcione, você precisa configurar os seguintes registros DNS:

### Registro A (IPv4)
```
Type: A
Name: telefoneinteligente
Value: 72.60.149.107
TTL: 3600 (ou automático)
```

### Configuração no Provedor DNS (ex: Cloudflare, Route53, etc.)
1. Acesse o painel do seu provedor DNS (onde você gerencia abmix.tech)
2. Adicione um novo registro A:
   - **Host/Nome**: `telefoneinteligente`
   - **Aponta para**: `72.60.149.107`
   - **Tipo**: A
3. Salve as alterações
4. Aguarde propagação DNS (pode levar de 5 minutos a 48 horas)

## Configuração do Replit para Domínio Customizado

### Passo 1: Publicar o App (Deploy)
1. No Replit, clique em **"Deploy"** no topo
2. Escolha o tipo de deploy:
   - **Autoscale**: Para app web que responde a requests (recomendado)
   - **VM**: Para manter sempre rodando (mais caro)
3. Configure o build e run commands se solicitado
4. Aguarde o deploy ser concluído

### Passo 2: Adicionar Domínio Customizado
1. Após o deploy, vá em **"Deployments"** → **"Settings"**
2. Procure por **"Custom Domains"**
3. Clique em **"Add Domain"**
4. Digite: `telefoneinteligente.abmix.tech`
5. O Replit mostrará instruções de DNS para verificação
6. Configure os registros DNS conforme instruções acima
7. Aguarde a verificação (pode levar alguns minutos)

## Configuração SobreIP (Webhooks)

### Variáveis de Ambiente Configuradas
✅ As seguintes variáveis já estão no arquivo `.env`:
- `BASE_URL=https://telefoneinteligente.abmix.tech`
- `DOMAIN=telefoneinteligente.abmix.tech`
- `SOBREIP_SERVER=voz.sobreip.com.br`
- `SOBREIP_USERNAME=1151944022`
- `SOBREIP_DID=+5511951944022`
- `WEBHOOK_MEDIA_URL=wss://telefoneinteligente.abmix.tech/media`
- `WEBHOOK_EVENTS_URL=https://telefoneinteligente.abmix.tech/events`

✅ **Secret já configurada no Replit**:
- `SOBREIP_PASSWORD` (armazenada de forma segura)

### Endpoints de Webhook Disponíveis

#### 1. WebSocket de Mídia (Áudio em Tempo Real)
```
URL: wss://telefoneinteligente.abmix.tech/media
Protocolo: WebSocket
Uso: Streaming bidirecional de áudio durante chamadas
```

**Como configurar na SobreIP**:
1. Acesse o painel da SobreIP (https://voz.sobreip.com.br)
2. Vá em configurações do número/DID +5511951944022
3. Configure o webhook de mídia:
   - **Media Stream URL**: `wss://telefoneinteligente.abmix.tech/media`

#### 2. Endpoint de Eventos (Status de Chamadas)
```
URL: https://telefoneinteligente.abmix.tech/events
Método: POST
Formato: JSON
Uso: Receber notificações de eventos de chamada
```

**Eventos Suportados**:
- `call.initiated` - Chamada iniciada
- `call.ringing` - Telefone tocando
- `call.answered` - Chamada atendida
- `call.ended` - Chamada encerrada (com duração)

**Como configurar na SobreIP**:
1. No painel da SobreIP, vá em Webhooks/Eventos
2. Configure:
   - **Event URL**: `https://telefoneinteligente.abmix.tech/events`
   - **Método**: POST
   - **Eventos**: Marque todos (initiated, ringing, answered, ended)

## Configuração Completa da SobreIP

### Informações de Acesso SIP
```
Servidor SIP: voz.sobreip.com.br
Usuário: 1151944022
Senha: (configurada em SOBREIP_PASSWORD secret)
DID Principal: +5511951944022
```

### Checklist de Configuração no Painel SobreIP
- [ ] Login realizado em https://voz.sobreip.com.br
- [ ] Número/DID +5511951944022 ativo
- [ ] Webhook de mídia configurado: `wss://telefoneinteligente.abmix.tech/media`
- [ ] Webhook de eventos configurado: `https://telefoneinteligente.abmix.tech/events`
- [ ] Teste de chamada realizado

## Verificação Pós-Deploy

### 1. Testar Conectividade
```bash
# Testar se o domínio está acessível
curl https://telefoneinteligente.abmix.tech/api/health

# Deve retornar:
# {"status":"ok","timestamp":"..."}
```

### 2. Verificar DNS
```bash
# Verificar se o DNS está propagado
nslookup telefoneinteligente.abmix.tech

# Deve retornar:
# Server: ...
# Address: 72.60.149.107
```

### 3. Testar Endpoint de Eventos
```bash
# Simular evento da SobreIP
curl -X POST https://telefoneinteligente.abmix.tech/events \
  -H "Content-Type: application/json" \
  -d '{"event":"call.initiated","call_id":"test-123"}'

# Deve retornar:
# {"success":true,"message":"Event received"}
```

## Monitoramento

### Logs de Eventos SobreIP
Os eventos recebidos da SobreIP são registrados no console do servidor:
```
[SOBREIP_EVENTS] Call event received: {...}
[SOBREIP_EVENTS] Call initiated: call-id-123
[SOBREIP_EVENTS] Call answered: call-id-123
[SOBREIP_EVENTS] Call ended: call-id-123 Duration: 45
```

### WebSocket de Mídia
Conexões WebSocket são registradas em:
```
[TELEPHONY] WebSocket servers initialized on /captions and /media
```

## Troubleshooting

### Problema: Domínio não resolve
- **Solução**: Aguarde propagação DNS (até 48h) ou use ferramenta como https://dnschecker.org

### Problema: Erro SSL/HTTPS
- **Solução**: O Replit gera certificado SSL automaticamente após verificar o domínio. Aguarde alguns minutos.

### Problema: WebSocket não conecta
- **Solução**: Verifique se o domínio está usando HTTPS (não HTTP). WebSocket seguro (wss://) requer HTTPS.

### Problema: Eventos não chegam
- **Solução**: 
  1. Confirme que o endpoint está acessível: `curl https://telefoneinteligente.abmix.tech/events`
  2. Verifique se configurou corretamente no painel SobreIP
  3. Teste com curl (exemplo acima)

## Segurança

### Secrets Configuradas ✅
- `SOBREIP_PASSWORD` - Senha SIP armazenada de forma segura no Replit
- `DEEPGRAM_API_KEY` - Chave API Deepgram para transcrição
- `ELEVENLABS_API_KEY` - Chave API ElevenLabs para TTS

### Boas Práticas
- ✅ Senhas nunca armazenadas no código ou banco de dados
- ✅ Todas credenciais sensíveis em environment variables
- ✅ API responses sanitizadas (sem expor senhas)
- ✅ HTTPS obrigatório para todos os endpoints

## Próximos Passos

1. ✅ Configurar DNS do domínio
2. ✅ Fazer deploy no Replit
3. ✅ Adicionar domínio customizado no Replit
4. ⏳ Configurar webhooks no painel SobreIP
5. ⏳ Testar chamada real
6. ⏳ Monitorar logs de eventos

## Suporte

Em caso de dúvidas:
- **Replit**: https://replit.com/support
- **SobreIP**: Painel de suporte em voz.sobreip.com.br
- **Documentação**: Este arquivo e replit.md
