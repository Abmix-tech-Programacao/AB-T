#!/bin/bash

# Script de deploy automatizado para VPS
# Uso: ./scripts/deploy.sh usuario@seu-dominio.com

if [ "$#" -ne 1 ]; then
    echo "❌ Uso: $0 usuario@seu-dominio.com"
    exit 1
fi

VPS_HOST=$1
VPS_PATH="/var/www/abmix"

echo "🚀 Deploy do Abmix para VPS..."
echo "📡 Destino: $VPS_HOST:$VPS_PATH"
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
    echo "   Verifique se a chave SSH está configurada"
    exit 1
fi
echo "✅ Conexão SSH funcionando"

# 3. Criar diretório na VPS se não existir
echo ""
echo "📁 3. Preparando diretório na VPS..."
ssh $VPS_HOST "mkdir -p $VPS_PATH"

# 4. Sync arquivos
echo ""
echo "📤 4. Enviando arquivos..."
echo "   Arquivos incluídos: dist/, package.json, package-lock.json, .env, data/, recordings/, shared/"
echo "   Arquivos excluídos: node_modules/, server/, client/src/, scripts/, attached_assets/"

rsync -avz --progress \
    --include='dist/' \
    --include='dist/**' \
    --include='package.json' \
    --include='package-lock.json' \
    --include='.env' \
    --include='data/' \
    --include='data/**' \
    --include='recordings/' \
    --include='recordings/**' \
    --include='shared/' \
    --include='shared/**' \
    --exclude='*' \
    ./ $VPS_HOST:$VPS_PATH/

if [ $? -ne 0 ]; then
    echo "❌ Erro no envio de arquivos"
    exit 1
fi

echo "✅ Arquivos enviados com sucesso"

# 5. Instalar dependências e iniciar na VPS
echo ""
echo "🔧 5. Configurando na VPS..."

ssh $VPS_HOST << EOF
cd $VPS_PATH

echo "📦 Instalando dependências..."
npm install --production --silent

echo "🛑 Parando processo anterior (se existir)..."
pm2 stop abmix 2>/dev/null || echo "   (Nenhum processo anterior encontrado)"

echo "🚀 Iniciando novo processo..."
pm2 start dist/index.js --name "abmix" --env production

echo "💾 Salvando configuração PM2..."
pm2 save

echo ""
echo "📊 Status do processo:"
pm2 status abmix

echo ""
echo "🔍 Últimas linhas do log:"
pm2 logs abmix --lines 10 --nostream
EOF

# 6. Verificar se está funcionando
echo ""
echo "🧪 6. Testando deploy..."

# Extrair domínio do host SSH
DOMAIN=$(echo $VPS_HOST | cut -d'@' -f2)

echo "   Testando: https://$DOMAIN/api/health"

# Aguardar um pouco para o servidor inicializar
sleep 5

# Testar endpoint de health
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/api/health" || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Deploy bem-sucedido!"
    echo ""
    echo "🎉 SEU SISTEMA ESTÁ FUNCIONANDO!"
    echo "📱 Acesse: https://$DOMAIN"
    echo "🎤 Teste conversão de voz: Faça uma ligação e ative o switch"
    echo ""
    echo "📊 Monitoramento:"
    echo "   pm2 logs abmix     # Ver logs"
    echo "   pm2 status         # Status do processo"
    echo "   pm2 restart abmix  # Reiniciar se necessário"
    
elif [ "$HTTP_STATUS" = "000" ]; then
    echo "⚠️  Não foi possível testar (possível problema de rede/SSL)"
    echo "   Teste manualmente: https://$DOMAIN"
    
else
    echo "❌ Erro: Servidor respondeu com status $HTTP_STATUS"
    echo "   Verifique os logs: ssh $VPS_HOST 'pm2 logs abmix'"
fi

echo ""
echo "📋 CONFIGURAÇÕES IMPORTANTES PARA CONVERSÃO DE VOZ:"
echo "   ✅ Certifique-se que .env contém:"
echo "      PUBLIC_BASE_URL=https://$DOMAIN"
echo "   ✅ SSL configurado (HTTPS obrigatório para WebSocket)"
echo "   ✅ Nginx configurado para proxy WebSocket"
echo ""
echo "📖 Guia detalhado: DEPLOY_VPS.md"






