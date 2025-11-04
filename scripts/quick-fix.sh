#!/bin/bash

# Script de correção rápida para executar no servidor VPS
# Execute como: bash quick-fix.sh

echo "🔧 CORREÇÃO RÁPIDA - AbmixDialer"
echo "==============================="

# Navegar para o diretório
cd /var/www/juliocamara.dev/abmix-ligacao || {
    echo "❌ Diretório não encontrado. Criando..."
    mkdir -p /var/www/juliocamara.dev/abmix-ligacao
    cd /var/www/juliocamara.dev/abmix-ligacao
}

# Parar processo existente
echo "🛑 Parando processos existentes..."
pm2 stop abmix-ligacao 2>/dev/null || true
pm2 delete abmix-ligacao 2>/dev/null || true

# Verificar se os arquivos existem
if [ ! -f "dist/index.js" ]; then
    echo "❌ Arquivo dist/index.js não encontrado!"
    echo "Execute o deploy primeiro com: npm run deploy:fix"
    exit 1
fi

# Configurar .env se não existir
if [ ! -f ".env" ]; then
    echo "📝 Criando arquivo .env..."
    cat > .env << 'EOF'
PORT=5001
NODE_ENV=production

# Configure suas chaves API:
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token  
TWILIO_NUMBER=your_twilio_number
ELEVENLABS_API_KEY=your_elevenlabs_key

# URLs públicas
PUBLIC_BASE_URL=https://juliocamara.dev/abmix-ligacao
EOF
    echo "⚠️  IMPORTANTE: Configure suas chaves API no arquivo .env"
fi

# Garantir que PORT=5001 esteja no .env
if ! grep -q "PORT=5001" .env; then
    echo "PORT=5001" >> .env
fi

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install --production
fi

# Ajustar permissões
echo "🔒 Ajustando permissões..."
chown -R www-data:www-data /var/www/juliocamara.dev/abmix-ligacao/
chmod -R 755 /var/www/juliocamara.dev/abmix-ligacao/

# Verificar configuração do nginx
echo "🌐 Verificando nginx..."
nginx -t
if [ $? -eq 0 ]; then
    echo "✅ Nginx configuração OK"
    systemctl reload nginx
else
    echo "❌ Erro na configuração do nginx"
fi

# Iniciar aplicação
echo "🚀 Iniciando aplicação na porta 5001..."
PORT=5001 pm2 start dist/index.js --name "abmix-ligacao" --env production

# Aguardar um pouco
sleep 3

# Verificar status
echo "📊 Status da aplicação:"
pm2 status

# Testar conectividade
echo "🧪 Testando conectividade local..."
LOCAL_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5001/api/health 2>/dev/null || echo "000")
if [ "$LOCAL_TEST" = "200" ]; then
    echo "✅ Aplicação respondendo localmente"
else
    echo "❌ Aplicação não responde localmente (Status: $LOCAL_TEST)"
    echo "📋 Verifique os logs: pm2 logs abmix-ligacao"
fi

# Testar acesso externo
echo "🌍 Testando acesso externo..."
EXTERNAL_TEST=$(curl -s -o /dev/null -w "%{http_code}" https://juliocamara.dev/abmix-ligacao/ 2>/dev/null || echo "000")
if [ "$EXTERNAL_TEST" = "200" ]; then
    echo "✅ Site acessível externamente"
elif [ "$EXTERNAL_TEST" = "403" ]; then
    echo "❌ Erro 403 - problema de permissões ou nginx"
elif [ "$EXTERNAL_TEST" = "502" ]; then
    echo "❌ Erro 502 - aplicação não está respondendo"
else
    echo "⚠️  Status externo: $EXTERNAL_TEST"
fi

echo ""
echo "🎉 CORREÇÃO CONCLUÍDA!"
echo "======================"
echo ""
echo "📋 PRÓXIMOS PASSOS:"
echo "1. Configure suas chaves API no arquivo .env"
echo "2. Acesse: https://juliocamara.dev/abmix-ligacao/"
echo "3. Se ainda houver problemas, verifique os logs: pm2 logs abmix-ligacao"
echo ""
echo "🔍 COMANDOS ÚTEIS:"
echo "• Ver logs: pm2 logs abmix-ligacao"
echo "• Reiniciar: pm2 restart abmix-ligacao"
echo "• Status: pm2 status"
echo "• Teste local: curl http://127.0.0.1:5001/api/health"
echo ""




