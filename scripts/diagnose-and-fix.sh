#!/bin/bash

echo "🔍 DIAGNÓSTICO COMPLETO - AbmixDialer"
echo "=================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}1. Verificando processos Node.js...${NC}"
ps aux | grep node | grep -v grep
echo ""

echo -e "${BLUE}2. Verificando porta 5001...${NC}"
ss -ltnp | grep :5001
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Porta 5001 está em uso${NC}"
else
    echo -e "${RED}❌ Porta 5001 não está em uso${NC}"
fi
echo ""

echo -e "${BLUE}3. Verificando PM2...${NC}"
pm2 status
echo ""

echo -e "${BLUE}4. Verificando diretório da aplicação...${NC}"
ls -la /var/www/juliocamara.dev/abmix-ligacao/
echo ""

echo -e "${BLUE}5. Verificando arquivo .env...${NC}"
if [ -f "/var/www/juliocamara.dev/abmix-ligacao/.env" ]; then
    echo -e "${GREEN}✅ Arquivo .env existe${NC}"
    echo "Conteúdo (sem valores sensíveis):"
    grep -E "^[A-Z_]+" /var/www/juliocamara.dev/abmix-ligacao/.env | sed 's/=.*/=***/'
else
    echo -e "${RED}❌ Arquivo .env não encontrado${NC}"
fi
echo ""

echo -e "${BLUE}6. Verificando configuração nginx...${NC}"
nginx -t
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Configuração nginx válida${NC}"
else
    echo -e "${RED}❌ Erro na configuração nginx${NC}"
fi
echo ""

echo -e "${BLUE}7. Testando conectividade local...${NC}"
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5001/api/health
echo ""

echo -e "${YELLOW}🔧 INICIANDO CORREÇÕES...${NC}"
echo "=================================="

# Navegar para o diretório
cd /var/www/juliocamara.dev/abmix-ligacao/

echo -e "${BLUE}1. Parando processo existente...${NC}"
pm2 stop abmix-ligacao 2>/dev/null || echo "Processo não estava rodando"
pm2 delete abmix-ligacao 2>/dev/null || echo "Processo não existia"

echo -e "${BLUE}2. Verificando dependências...${NC}"
if [ ! -d "node_modules" ]; then
    echo "Instalando dependências..."
    npm install --production
fi

echo -e "${BLUE}3. Configurando variáveis de ambiente...${NC}"
if [ ! -f ".env" ]; then
    echo "PORT=5001" > .env
    echo "NODE_ENV=production" >> .env
    echo -e "${YELLOW}⚠️ Configure suas chaves API no arquivo .env${NC}"
else
    # Garantir que a porta esteja correta
    if ! grep -q "PORT=5001" .env; then
        echo "PORT=5001" >> .env
    fi
fi

echo -e "${BLUE}4. Ajustando permissões...${NC}"
chown -R www-data:www-data /var/www/juliocamara.dev/abmix-ligacao/
chmod -R 755 /var/www/juliocamara.dev/abmix-ligacao/

echo -e "${BLUE}5. Iniciando aplicação...${NC}"
PORT=5001 pm2 start dist/index.js --name "abmix-ligacao" --env production

echo -e "${BLUE}6. Recarregando nginx...${NC}"
systemctl reload nginx

echo ""
echo -e "${GREEN}🎉 CORREÇÕES APLICADAS!${NC}"
echo "=================================="

echo -e "${BLUE}Verificação final:${NC}"
sleep 3
pm2 status
echo ""

echo -e "${BLUE}Teste de conectividade:${NC}"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://127.0.0.1:5001/api/health

echo ""
echo -e "${GREEN}✅ Acesse: https://juliocamara.dev/abmix-ligacao/${NC}"
echo -e "${YELLOW}📋 Para WebSocket use: wss://juliocamara.dev/abmix-ligacao/media${NC}"
echo ""




