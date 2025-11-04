#!/bin/bash

echo "🧪 TESTE COMPLETO DO DEPLOY"
echo "=========================="

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOMAIN="https://juliocamara.dev/abmix-ligacao"

echo -e "${BLUE}1. Testando conectividade básica...${NC}"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/")
if [ "$HTTP_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✅ Site principal acessível (200)${NC}"
elif [ "$HTTP_STATUS" -eq 403 ]; then
    echo -e "${RED}❌ Erro 403 Forbidden - problema de permissões ou nginx${NC}"
elif [ "$HTTP_STATUS" -eq 502 ]; then
    echo -e "${RED}❌ Erro 502 Bad Gateway - aplicação não está rodando${NC}"
else
    echo -e "${YELLOW}⚠️ Status HTTP: $HTTP_STATUS${NC}"
fi

echo -e "${BLUE}2. Testando API de saúde...${NC}"
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DOMAIN/api/health")
if [ "$API_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✅ API funcionando (200)${NC}"
else
    echo -e "${RED}❌ API com problema. Status: $API_STATUS${NC}"
fi

echo -e "${BLUE}3. Testando WebSocket...${NC}"
# Teste básico de WebSocket usando wscat se disponível
if command -v wscat &> /dev/null; then
    echo "Testando wss://juliocamara.dev/abmix-ligacao/media..."
    timeout 5s wscat -c "wss://juliocamara.dev/abmix-ligacao/media" &
    WS_PID=$!
    sleep 2
    if kill -0 $WS_PID 2>/dev/null; then
        echo -e "${GREEN}✅ WebSocket conectou com sucesso${NC}"
        kill $WS_PID 2>/dev/null
    else
        echo -e "${RED}❌ WebSocket falhou ao conectar${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ wscat não disponível para teste de WebSocket${NC}"
fi

echo -e "${BLUE}4. Verificando headers de resposta...${NC}"
curl -s -I "$DOMAIN/" | head -10

echo ""
echo -e "${BLUE}5. Diagnóstico de problemas comuns:${NC}"

if [ "$HTTP_STATUS" -eq 403 ]; then
    echo -e "${YELLOW}💡 Soluções para erro 403:${NC}"
    echo "   1. Verificar permissões: chmod -R 755 /var/www/juliocamara.dev/abmix-ligacao/"
    echo "   2. Verificar owner: chown -R www-data:www-data /var/www/juliocamara.dev/abmix-ligacao/"
    echo "   3. Verificar se aplicação está rodando: pm2 status"
    echo "   4. Verificar logs: pm2 logs abmix-ligacao"
fi

if [ "$HTTP_STATUS" -eq 502 ]; then
    echo -e "${YELLOW}💡 Soluções para erro 502:${NC}"
    echo "   1. Verificar se aplicação está rodando na porta 5001: ss -ltnp | grep :5001"
    echo "   2. Iniciar aplicação: PORT=5001 pm2 start dist/index.js --name abmix-ligacao"
    echo "   3. Verificar logs: pm2 logs abmix-ligacao"
fi

echo ""
echo -e "${GREEN}🎯 COMANDOS ÚTEIS PARA DEBUG:${NC}"
echo "   • Ver logs: pm2 logs abmix-ligacao"
echo "   • Status: pm2 status"
echo "   • Reiniciar: pm2 restart abmix-ligacao"
echo "   • Ver portas: ss -ltnp | grep node"
echo "   • Testar local: curl http://127.0.0.1:5001/api/health"
echo ""




