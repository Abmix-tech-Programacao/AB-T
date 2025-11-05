#!/bin/bash

# Deploy corrigindo conflito de porta
VPS_HOST="root@juliocamara.dev"
VPS_PATH="/var/www/juliocamara.dev/abmix-ligacao"

echo "🚀 Deploy do Abmix Dialer - Resolvendo Conflito de Porta"
echo ""
echo "📋 CONFIGURAÇÃO:"
echo "   • Sistema existente (sistema-vendas): porta 3000 ✅"
echo "   • Novo sistema (abmix-ligacao): porta 5001 ✅"
echo "   • Nginx: /abmix-ligacao/ → localhost:5001"
echo ""

# 1. Build local
echo "📦 1. Fazendo build..."
npm run build

if [ ! -f "dist/index.js" ]; then
    echo "❌ Build falhou"
    exit 1
fi

# 2. Preparar .env de produção
echo "📝 2. Preparando configuração de produção..."
cp production.env .env.prod

# 3. Enviar arquivos
echo "📤 3. Enviando arquivos..."

ssh $VPS_HOST "mkdir -p $VPS_PATH"

rsync -avz --progress \
    --include='dist/' \
    --include='dist/**' \
    --include='package.json' \
    --include='package-lock.json' \
    --include='.env.prod' \
    --include='data/' \
    --include='data/**' \
    --include='shared/' \
    --include='shared/**' \
    --include='juliocamara.dev' \
    --exclude='*' \
    ./ $VPS_HOST:$VPS_PATH/

# 4. Configurar na VPS
echo "🔧 4. Configurando na VPS..."

ssh $VPS_HOST << EOF
cd $VPS_PATH

echo "📝 Configurando .env..."
mv .env.prod .env

echo "📋 Verificando portas em uso:"
echo "   Porta 3000: \$(ss -ltn | grep :3000 | wc -l) processo(s)"
echo "   Porta 5001: \$(ss -ltn | grep :5001 | wc -l) processo(s)"

echo ""
echo "📦 Instalando dependências..."
npm install --production --silent

echo "🛑 Parando processo anterior na porta 5001 (se existir)..."
pm2 stop abmix-ligacao 2>/dev/null || echo "   (Nenhum processo anterior)"

# Matar qualquer processo na porta 5001
fuser -k 5001/tcp 2>/dev/null || echo "   (Porta 5001 livre)"

echo ""
echo "🚀 Iniciando na porta 5001..."
PORT=5001 pm2 start dist/index.js --name "abmix-ligacao" --env production

echo "💾 Salvando configuração..."
pm2 save

echo ""
echo "📋 Atualizando Nginx..."
sudo cp juliocamara.dev /etc/nginx/sites-available/
sudo nginx -t
if [ \$? -eq 0 ]; then
    sudo systemctl reload nginx
    echo "✅ Nginx recarregado"
else
    echo "❌ Erro no Nginx"
    exit 1
fi

echo ""
echo "📊 Status final:"
pm2 status
echo ""
echo "🔍 Verificando portas:"
ss -ltnp | grep -E ":(3000|5001)" || echo "   Nenhum processo encontrado"

echo ""
echo "🧪 Teste local:"
sleep 3
curl -s http://localhost:5001/api/health | head -1 || echo "   ❌ Não responde na porta 5001"
EOF

# 5. Teste externo
echo ""
echo "🌐 5. Testando acesso externo..."
sleep 5

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://juliocamara.dev/abmix-ligacao/api/health" || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ DEPLOY BEM-SUCEDIDO!"
    echo ""
    echo "🎉 SISTEMA FUNCIONANDO SEM CONFLITOS!"
    echo ""
    echo "📱 URLs do seu sistema:"
    echo "   • Painel: https://juliocamara.dev/abmix-ligacao"
    echo "   • Health: https://juliocamara.dev/abmix-ligacao/api/health"
    echo ""
    echo "🎤 TESTE DE CONVERSÃO DE VOZ:"
    echo "   1. Acesse o painel"
    echo "   2. Faça uma ligação"
    echo "   3. Ative o switch 'Conversão de Voz'"
    echo "   4. Converse - sua voz será modificada!"
    echo ""
    echo "📊 Monitoramento:"
    echo "   ssh root@juliocamara.dev"
    echo "   pm2 logs abmix-ligacao"
    
elif [ "$HTTP_STATUS" = "000" ]; then
    echo "⚠️  Não foi possível testar (possível problema de rede)"
    echo "   Teste manualmente: https://juliocamara.dev/abmix-ligacao"
    
else
    echo "❌ Ainda com problemas (Status: $HTTP_STATUS)"
    echo ""
    echo "🔍 Debug:"
    echo "   ssh root@juliocamara.dev"
    echo "   pm2 logs abmix-ligacao"
    echo "   ss -ltnp | grep :5001"
    echo "   curl http://localhost:5001/api/health"
fi

echo ""
echo "📋 RESUMO DA CONFIGURAÇÃO:"
echo "   • Sistema existente: porta 3000 (mantido)"
echo "   • Abmix Ligação: porta 5001 (novo)"
echo "   • Nginx: /abmix-ligacao/ → localhost:5001"
echo "   • SSL: wss://juliocamara.dev/abmix-ligacao/media"





