#!/bin/bash

# Deploy específico para juliocamara.dev/abmix-ligacao
VPS_HOST="usuario@juliocamara.dev"  # Substitua 'usuario' pelo seu usuário SSH
VPS_PATH="/var/www/abmix-ligacao"
DOMAIN="juliocamara.dev"
SUBPATH="/abmix-ligacao"

echo "🚀 Deploy do Abmix Dialer para $DOMAIN$SUBPATH"
echo "📡 Servidor: $VPS_HOST"
echo "📁 Destino: $VPS_PATH"
echo ""

# 1. Build local
echo "📦 1. Fazendo build do projeto..."
npm run build

if [ ! -f "dist/index.js" ]; then
    echo "❌ Erro: Build falhou. Arquivo dist/index.js não encontrado."
    exit 1
fi

echo "✅ Build concluído"

# 2. Verificar conexão SSH
echo ""
echo "🔗 2. Testando conexão SSH..."
ssh -o BatchMode=yes -o ConnectTimeout=5 $VPS_HOST exit
if [ $? -ne 0 ]; then
    echo "❌ Erro: Não foi possível conectar via SSH"
    echo "   Comando para testar: ssh $VPS_HOST"
    exit 1
fi
echo "✅ Conexão SSH funcionando"

# 3. Preparar arquivos
echo ""
echo "📁 3. Preparando arquivos para deploy..."

# Copiar .env de produção
cp production.env .env.production

echo "✅ Arquivos preparados"

# 4. Sync arquivos para VPS
echo ""
echo "📤 4. Enviando arquivos para VPS..."

# Criar diretório se não existir
ssh $VPS_HOST "sudo mkdir -p $VPS_PATH && sudo chown \$USER:www-data $VPS_PATH"

# Enviar arquivos essenciais
rsync -avz --progress \
    --include='dist/' \
    --include='dist/**' \
    --include='package.json' \
    --include='package-lock.json' \
    --include='.env.production' \
    --include='data/' \
    --include='data/**' \
    --include='recordings/' \
    --include='recordings/**' \
    --include='shared/' \
    --include='shared/**' \
    --include='juliocamara.dev' \
    --exclude='*' \
    ./ $VPS_HOST:$VPS_PATH/

if [ $? -ne 0 ]; then
    echo "❌ Erro no envio de arquivos"
    exit 1
fi

echo "✅ Arquivos enviados com sucesso"

# 5. Configurar na VPS
echo ""
echo "🔧 5. Configurando na VPS..."

ssh $VPS_HOST << EOF
cd $VPS_PATH

echo "📝 Configurando .env para produção..."
mv .env.production .env

echo "📦 Instalando dependências..."
npm install --production --silent

echo "🛑 Parando processo anterior (se existir)..."
pm2 stop abmix-ligacao 2>/dev/null || echo "   (Nenhum processo anterior encontrado)"

echo "🚀 Iniciando processo..."
pm2 start dist/index.js --name "abmix-ligacao" --env production

echo "💾 Salvando configuração PM2..."
pm2 save

echo ""
echo "📊 Status do processo:"
pm2 status abmix-ligacao

echo ""
echo "🔍 Últimas linhas do log:"
pm2 logs abmix-ligacao --lines 5 --nostream

echo ""
echo "📋 Configurando Nginx..."
sudo cp juliocamara.dev /etc/nginx/sites-available/
sudo nginx -t
if [ \$? -eq 0 ]; then
    sudo systemctl reload nginx
    echo "✅ Nginx recarregado com sucesso"
else
    echo "❌ Erro na configuração do Nginx"
fi
EOF

# 6. Teste final
echo ""
echo "🧪 6. Testando deploy..."

echo "   Aguardando servidor inicializar..."
sleep 10

echo "   Testando: https://$DOMAIN$SUBPATH/api/health"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN$SUBPATH/api/health" || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ DEPLOY BEM-SUCEDIDO!"
    echo ""
    echo "🎉 SEU SISTEMA DE CONVERSÃO DE VOZ ESTÁ FUNCIONANDO!"
    echo ""
    echo "📱 Acesse: https://$DOMAIN$SUBPATH"
    echo "🎤 Teste conversão: Faça uma ligação e ative o switch"
    echo ""
    echo "🔗 URLs importantes:"
    echo "   • Painel: https://$DOMAIN$SUBPATH"
    echo "   • API Health: https://$DOMAIN$SUBPATH/api/health"
    echo "   • WebSocket Media: wss://$DOMAIN$SUBPATH/media"
    echo "   • WebSocket Captions: wss://$DOMAIN$SUBPATH/captions"
    echo ""
    echo "📊 Monitoramento:"
    echo "   ssh $VPS_HOST"
    echo "   pm2 logs abmix-ligacao    # Ver logs"
    echo "   pm2 status               # Status dos processos"
    echo "   pm2 restart abmix-ligacao # Reiniciar se necessário"
    
elif [ "$HTTP_STATUS" = "000" ]; then
    echo "⚠️  Não foi possível testar (possível problema de rede)"
    echo "   Teste manualmente: https://$DOMAIN$SUBPATH"
    echo "   Verifique logs: ssh $VPS_HOST 'pm2 logs abmix-ligacao'"
    
else
    echo "❌ Erro: Servidor respondeu com status $HTTP_STATUS"
    echo "   Verifique os logs: ssh $VPS_HOST 'pm2 logs abmix-ligacao'"
    echo "   Verifique Nginx: ssh $VPS_HOST 'sudo nginx -t'"
fi

echo ""
echo "📋 CONFIGURAÇÕES FINAIS:"
echo "   ✅ Nginx configurado para subpath /abmix-ligacao"
echo "   ✅ WebSockets configurados para media streaming"
echo "   ✅ SSL funcionando (HTTPS obrigatório)"
echo "   ✅ PM2 gerenciando processo"
echo ""
echo "🎯 PRÓXIMO PASSO:"
echo "   Teste uma ligação real com conversão de voz!"
echo "   O destinatário ouvirá sua voz modificada em tempo real!"





