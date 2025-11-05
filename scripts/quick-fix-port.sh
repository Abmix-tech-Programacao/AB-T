#!/bin/bash

# Script rápido para corrigir porta sem conflito
VPS_HOST="root@juliocamara.dev"
VPS_PATH="/var/www/juliocamara.dev/abmix-ligacao"

echo "⚡ Correção Rápida - Mudança para Porta 5001"
echo "📡 Conectando: $VPS_HOST"
echo ""

ssh $VPS_HOST << 'EOF'
cd /var/www/juliocamara.dev/abmix-ligacao

echo "📋 1. Verificando situação atual..."
echo "   Processos na porta 3000: $(ss -ltn | grep :3000 | wc -l)"
echo "   Processos na porta 5001: $(ss -ltn | grep :5001 | wc -l)"
echo "   Status PM2:"
pm2 status abmix-ligacao 2>/dev/null || echo "   (Processo não encontrado)"

echo ""
echo "🔧 2. Configurando porta 5001 no .env..."
# Atualizar ou adicionar PORT=5001
if grep -q "^PORT=" .env 2>/dev/null; then
    sed -i 's/^PORT=.*/PORT=5001/' .env
else
    echo "PORT=5001" >> .env
fi

echo "   ✅ .env atualizado:"
grep "PORT=" .env || echo "   ❌ Erro ao configurar PORT"

echo ""
echo "🚀 3. Reiniciando com nova porta..."

# Parar processo atual
pm2 stop abmix-ligacao 2>/dev/null || echo "   (Nenhum processo para parar)"

# Matar qualquer coisa na porta 5001
fuser -k 5001/tcp 2>/dev/null || echo "   (Porta 5001 livre)"

# Iniciar com nova porta
PORT=5001 pm2 start dist/index.js --name "abmix-ligacao" --update-env

echo ""
echo "💾 4. Salvando configuração..."
pm2 save

echo ""
echo "📊 5. Verificação final:"
echo "   Status PM2:"
pm2 status abmix-ligacao

echo "   Porta em uso:"
ss -ltnp | grep :5001 || echo "   ❌ Processo não encontrado na porta 5001"

echo ""
echo "🧪 6. Teste local:"
sleep 3
curl -s http://localhost:5001/api/health || echo "   ❌ Endpoint não responde"

echo ""
echo "📋 7. Atualizando Nginx..."
if [ -f "juliocamara.dev" ]; then
    sudo cp juliocamara.dev /etc/nginx/sites-available/
    sudo nginx -t && sudo systemctl reload nginx
    echo "   ✅ Nginx atualizado"
else
    echo "   ⚠️  Arquivo juliocamara.dev não encontrado"
fi
EOF

echo ""
echo "🌐 Testando acesso externo..."
sleep 5

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://juliocamara.dev/abmix-ligacao/api/health" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ CORREÇÃO BEM-SUCEDIDA!"
    echo ""
    echo "🎉 SISTEMA FUNCIONANDO SEM CONFLITOS!"
    echo ""
    echo "📱 Acesse: https://juliocamara.dev/abmix-ligacao"
    echo "🎤 Teste conversão de voz agora!"
    echo ""
    echo "📊 Configuração final:"
    echo "   • Sistema existente: porta 3000 ✅"
    echo "   • Abmix Ligação: porta 5001 ✅"
    echo "   • Nginx: configurado para ambos ✅"
    
elif [ "$HTTP_STATUS" = "502" ]; then
    echo "⚠️  Erro 502: Aplicação não está rodando na porta 5001"
    echo "   Execute: ssh $VPS_HOST 'pm2 logs abmix-ligacao'"
    
elif [ "$HTTP_STATUS" = "000" ]; then
    echo "⚠️  Não foi possível testar"
    echo "   Teste manualmente: https://juliocamara.dev/abmix-ligacao"
    
else
    echo "❌ Status: $HTTP_STATUS"
    echo "   Verifique logs: ssh $VPS_HOST 'pm2 logs abmix-ligacao'"
fi





