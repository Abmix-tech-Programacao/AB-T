#!/bin/bash

# Script para corrigir deploy do AbmixDialer
# Execute este script LOCALMENTE primeiro

echo "🚀 CORREÇÃO DE DEPLOY - AbmixDialer"
echo "==================================="

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}1. Fazendo build da aplicação...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro no build. Verifique os erros acima.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build concluído${NC}"

echo -e "${BLUE}2. Preparando arquivo .env para produção...${NC}"
if [ -f "production.env" ]; then
    cp production.env .env.production
    echo "PORT=5001" >> .env.production
    echo "NODE_ENV=production" >> .env.production
    echo -e "${GREEN}✅ Arquivo .env.production criado${NC}"
else
    echo -e "${YELLOW}⚠️ Arquivo production.env não encontrado. Criando básico...${NC}"
    cat > .env.production << EOF
PORT=5001
NODE_ENV=production
# Adicione suas chaves API aqui:
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_NUMBER=
# ELEVENLABS_API_KEY=
EOF
fi

echo -e "${BLUE}3. Enviando arquivos para o servidor...${NC}"
echo "Executando: scp -r dist/ package.json .env.production root@95.216.201.197:/var/www/juliocamara.dev/abmix-ligacao/"

# Criar diretório se não existir
ssh root@95.216.201.197 "mkdir -p /var/www/juliocamara.dev/abmix-ligacao"

# Enviar arquivos
scp -r dist/ package.json .env.production root@95.216.201.197:/var/www/juliocamara.dev/abmix-ligacao/

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Arquivos enviados com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao enviar arquivos${NC}"
    exit 1
fi

echo -e "${BLUE}4. Configurando servidor remoto...${NC}"
ssh root@95.216.201.197 << 'ENDSSH'
cd /var/www/juliocamara.dev/abmix-ligacao

# Renomear .env
mv .env.production .env

# Instalar dependências
npm install --production

# Parar processo existente
pm2 stop abmix-ligacao 2>/dev/null || true
pm2 delete abmix-ligacao 2>/dev/null || true

# Ajustar permissões
chown -R www-data:www-data /var/www/juliocamara.dev/abmix-ligacao/
chmod -R 755 /var/www/juliocamara.dev/abmix-ligacao/

# Iniciar aplicação na porta correta
PORT=5001 pm2 start dist/index.js --name "abmix-ligacao" --env production

# Recarregar nginx
systemctl reload nginx

echo "🎉 Configuração do servidor concluída!"
ENDSSH

echo -e "${GREEN}✅ Deploy corrigido com sucesso!${NC}"
echo ""
echo -e "${BLUE}Verificações finais:${NC}"
echo "1. Acesse: https://juliocamara.dev/abmix-ligacao/"
echo "2. WebSocket: wss://juliocamara.dev/abmix-ligacao/media"
echo ""
echo -e "${YELLOW}Se ainda houver problemas, execute no servidor:${NC}"
echo "bash /var/www/juliocamara.dev/abmix-ligacao/diagnose-and-fix.sh"




