#!/bin/bash

# Script para corrigir a porta na VPS
VPS_HOST="root@juliocamara.dev"
VPS_PATH="/var/www/juliocamara.dev/abmix-ligacao"

echo "🔧 Corrigindo configuração de porta na VPS..."
echo "📡 Conectando: $VPS_HOST"
echo "📁 Diretório: $VPS_PATH"
echo ""

# Comandos na VPS
ssh $VPS_HOST << EOF
cd $VPS_PATH

echo "📝 1. Atualizando .env para porta 3000..."
sed -i 's/PORT=5000/PORT=3000/g' .env
echo "   ✅ .env atualizado"

echo ""
echo "📋 2. Verificando configuração atual:"
echo "   Porta no .env: \$(grep PORT .env)"
echo "   Processo rodando: \$(ss -ltnp | grep node | head -1)"

echo ""
echo "🔄 3. Reiniciando aplicação..."
pm2 restart abmix-ligacao || pm2 start dist/index.js --name "abmix-ligacao" --env production

echo ""
echo "📊 4. Status após reinicialização:"
pm2 status abmix-ligacao

echo ""
echo "🔍 5. Verificando se está na porta correta:"
sleep 3
ss -ltnp | grep :3000 || echo "   ⚠️  Processo não encontrado na porta 3000"

echo ""
echo "🧪 6. Testando endpoint local:"
curl -s http://localhost:3000/api/health | head -1 || echo "   ❌ Endpoint não responde"

echo ""
echo "📋 7. Últimas linhas do log:"
pm2 logs abmix-ligacao --lines 5 --nostream
EOF

echo ""
echo "🧪 Testando acesso externo..."
sleep 5

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://juliocamara.dev/abmix-ligacao/api/health" || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ CORREÇÃO BEM-SUCEDIDA!"
    echo ""
    echo "🎉 SISTEMA FUNCIONANDO!"
    echo "📱 Acesse: https://juliocamara.dev/abmix-ligacao"
    echo "🎤 Teste conversão de voz agora!"
    
elif [ "$HTTP_STATUS" = "000" ]; then
    echo "⚠️  Não foi possível testar externamente"
    echo "   Teste manualmente: https://juliocamara.dev/abmix-ligacao"
    
else
    echo "❌ Ainda com problemas (Status: $HTTP_STATUS)"
    echo "   Verifique: ssh $VPS_HOST 'pm2 logs abmix-ligacao'"
fi

echo ""
echo "💡 Se ainda não funcionar:"
echo "   1. Verifique se Nginx foi recarregado: sudo systemctl reload nginx"
echo "   2. Veja logs: pm2 logs abmix-ligacao"
echo "   3. Teste local: curl http://localhost:3000/api/health"





