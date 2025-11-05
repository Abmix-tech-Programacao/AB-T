# Correção do Erro SIP no EasyPanel

## URL de Produção
**URL Principal**: https://projeto-abmix-tech-abmix-telefone2.asfaje.easypanel.host

## Problema
O erro `TypeError: sip.send is not a function` indica que o stack SIP não está sendo inicializado corretamente no ambiente de produção.

## Soluções Implementadas

### 1. Melhor Inicialização do SIP Stack
- ✅ Aumentado tempo de espera para inicialização (3 segundos)
- ✅ Adicionadas verificações múltiplas para `sip.send`
- ✅ Melhor tratamento de erros na inicialização
- ✅ Verificação de disponibilidade antes de cada uso

### 2. Sistema de Retry e Timeouts Melhorados
- ✅ Timeout aumentado para produção (20s UDP, 30s TCP)
- ✅ Sistema de retry automático (até 3 tentativas)
- ✅ Melhor logging para diagnóstico
- ✅ Detecção de ambiente (desenvolvimento vs produção)

### 2. Configurações de Ambiente Necessárias

No EasyPanel, configure estas variáveis de ambiente:

```bash
NODE_ENV=production
FALEVONO_PASSWORD=sua_senha_falevono
ELEVENLABS_API_KEY=sua_chave_elevenlabs
DEEPGRAM_API_KEY=sua_chave_deepgram
PORT=5001
SIP_USE_TCP=false
FALEVONO_SIP_PORT=7060
```

### 3. Verificação da Configuração

Execute antes do deploy:
```bash
npm run check-prod-env
```

## Passos para Corrigir no EasyPanel

### 1. Verificar Variáveis de Ambiente
1. Acesse o painel do EasyPanel
2. Vá para a seção "Environment Variables"
3. Certifique-se de que todas as variáveis estão configuradas:
   - `FALEVONO_PASSWORD` - Senha do seu provedor SIP
   - `ELEVENLABS_API_KEY` - Chave da API ElevenLabs
   - `DEEPGRAM_API_KEY` - Chave da API Deepgram
   - `NODE_ENV=production`
   - `SIP_USE_TCP=false` (UDP é mais estável em produção)
   - `FALEVONO_PUBLIC_IP=72.60.149.107` - IP publico do servidor (necessario atras de NAT)
   - `FALEVONO_LOCAL_IP` (opcional) - Defina apenas se precisar forcar a interface local

### 2. Configuração de Rede
- Certifique-se de que as portas UDP estão liberadas
- Porta padrão SIP: 5060 (servidor)
- Porta cliente SIP: 7060 (configurável via FALEVONO_SIP_PORT)

### 3. Logs de Diagnóstico
Após o deploy, verifique os logs para:
```
[SIP_SERVICE] Starting SIP stack for the first time...
[SIP_SERVICE] ✅ SIP stack started successfully
[SIP_SERVICE] ✅ Registration successful!
```

### 4. Teste de Conectividade
1. Acesse a interface web
2. Tente fazer uma ligação de teste
3. Verifique os logs em tempo real no EasyPanel

## Troubleshooting

### Se o erro persistir:

1. **Reinicie o container**:
   - No EasyPanel, vá para "Actions" → "Restart"

2. **Verifique os logs detalhados**:
   ```
   [SIP_SERVICE] Available sip methods: [...]
   ```

3. **Teste com TCP** (temporário):
   - Configure `SIP_USE_TCP=true`
   - Reinicie o container
   - Note: TCP pode ter limitações com alguns provedores

4. **Verifique conectividade de rede**:
   - Teste se o servidor SIP está acessível
   - Verifique firewall/proxy do EasyPanel

## Arquivos Modificados

- `server/sipService.ts` - Melhor inicialização e verificações
- `scripts/check-production-env.js` - Script de verificação
- `package.json` - Novo script `check-prod-env`

## Próximos Passos

1. Faça o deploy das correções
2. Configure as variáveis de ambiente
3. Execute `npm run check-prod-env` localmente para verificar
4. Reinicie o container no EasyPanel
5. Teste uma ligação

## Suporte

Se o problema persistir, verifique:
1. Logs completos do container
2. Configuração de rede do EasyPanel
3. Status do provedor SIP (FaleVono)
4. Conectividade UDP na porta 5060


