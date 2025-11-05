#!/bin/bash

# Script para corrigir erro 404 - Arquivos estáticos não encontrados
# Execute LOCALMENTE primeiro, depois no servidor

echo "🔧 CORREÇÃO DE ERRO 404 - Arquivos Estáticos"
echo "============================================"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
log_error() { echo -e "${RED}[ERRO]${NC} $1"; }

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    log_error "Execute este script no diretório raiz do projeto (onde está o package.json)"
    exit 1
fi

log_info "=== PARTE 1: BUILD LOCAL ==="

# 1. Limpar build anterior
log_info "1. Limpando build anterior..."
rm -rf dist/
rm -rf client/dist/

# 2. Fazer build completo
log_info "2. Fazendo build da aplicação..."
npm run build

if [ $? -ne 0 ]; then
    log_error "Falha no build. Verifique os erros acima."
    exit 1
fi

log_success "Build concluído com sucesso"

# 3. Verificar estrutura do build
log_info "3. Verificando estrutura do build..."
echo "Conteúdo de dist/:"
ls -la dist/
echo ""
echo "Conteúdo de dist/public/ (se existir):"
ls -la dist/public/ 2>/dev/null || echo "Diretório dist/public/ não existe"
echo ""

# 4. Preparar .env para produção
log_info "4. Preparando arquivo .env para produção..."
if [ -f "production.env" ]; then
    cp production.env .env.production
    log_success "Arquivo production.env copiado para .env.production"
else
    log_warning "Arquivo production.env não encontrado. Criando básico..."
    cat > .env.production << 'EOF'
PORT=5001
NODE_ENV=production
PUBLIC_BASE_URL=https://juliocamara.dev/abmix-ligacao

# Configure suas chaves API:
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_NUMBER=
ELEVENLABS_API_KEY=
EOF
fi

# Garantir configurações essenciais
echo "PORT=5001" >> .env.production
echo "NODE_ENV=production" >> .env.production
echo "PUBLIC_BASE_URL=https://juliocamara.dev/abmix-ligacao" >> .env.production

log_info "=== PARTE 2: DEPLOY PARA SERVIDOR ==="

# 5. Enviar arquivos para o servidor
log_info "5. Enviando arquivos para o servidor..."

# Criar estrutura no servidor
ssh root@95.216.201.197 "mkdir -p /var/www/juliocamara.dev/abmix-ligacao"

# Enviar arquivos essenciais
scp -r dist/ package.json .env.production root@95.216.201.197:/var/www/juliocamara.dev/abmix-ligacao/

if [ $? -eq 0 ]; then
    log_success "Arquivos enviados com sucesso"
else
    log_error "Erro ao enviar arquivos para o servidor"
    exit 1
fi

log_info "=== PARTE 3: CONFIGURAÇÃO NO SERVIDOR ==="

# 6. Configurar no servidor
log_info "6. Configurando no servidor..."
ssh root@95.216.201.197 << 'ENDSSH'

echo "🔧 CONFIGURAÇÃO NO SERVIDOR"
cd /var/www/juliocamara.dev/abmix-ligacao

# Renomear .env
mv .env.production .env

# Verificar estrutura de arquivos
echo "📁 Estrutura de arquivos:"
ls -la
echo ""
echo "📁 Conteúdo de dist/:"
ls -la dist/
echo ""
echo "📁 Conteúdo de dist/public/ (se existir):"
ls -la dist/public/ 2>/dev/null || echo "dist/public/ não existe"
echo ""

# Se dist/public não existir, criar link simbólico
if [ ! -d "dist/public" ] && [ -f "dist/index.html" ]; then
    echo "🔗 Criando estrutura de arquivos estáticos..."
    # Mover arquivos para a estrutura correta
    mkdir -p dist/public
    # Mover todos os arquivos estáticos para public, exceto index.js
    find dist/ -maxdepth 1 -type f ! -name "index.js" -exec mv {} dist/public/ \;
    # Mover diretórios assets se existir
    [ -d "dist/assets" ] && mv dist/assets dist/public/
fi

# Verificar novamente
echo "📁 Nova estrutura de dist/:"
ls -la dist/
echo ""
echo "📁 Nova estrutura de dist/public/:"
ls -la dist/public/ 2>/dev/null || echo "dist/public/ ainda não existe"
echo ""

# Instalar dependências
echo "📦 Instalando dependências..."
npm install --production

# Parar processo existente
echo "🛑 Parando processo existente..."
pm2 stop abmix-ligacao 2>/dev/null || true
pm2 delete abmix-ligacao 2>/dev/null || true

# Ajustar permissões
echo "🔒 Ajustando permissões..."
chown -R www-data:www-data /var/www/juliocamara.dev/abmix-ligacao/
chmod -R 755 /var/www/juliocamara.dev/abmix-ligacao/

# Recarregar nginx
echo "🌐 Recarregando nginx..."
nginx -t && systemctl reload nginx

# Iniciar aplicação
echo "🚀 Iniciando aplicação..."
PORT=5001 pm2 start dist/index.js --name "abmix-ligacao" --env production

# Aguardar inicialização
sleep 5

# Verificar status
echo "📊 Status da aplicação:"
pm2 status

# Testar conectividade
echo "🧪 Testando conectividade..."
echo "Teste local:"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://127.0.0.1:5001/ || echo "Erro na conexão local"

echo "Teste API:"
curl -s -o /dev/null -w "Status: %{http_code}\n" http://127.0.0.1:5001/api/health || echo "API não responde"

# Mostrar logs recentes
echo "📋 Logs recentes:"
pm2 logs abmix-ligacao --lines 10

echo "✅ CONFIGURAÇÃO DO SERVIDOR CONCLUÍDA"

ENDSSH

log_info "=== PARTE 4: TESTE FINAL ==="

# 7. Teste final
log_info "7. Testando acesso externo..."
sleep 3

EXTERNAL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://juliocamara.dev/abmix-ligacao/ 2>/dev/null || echo "000")

if [ "$EXTERNAL_STATUS" = "200" ]; then
    log_success "✅ Site acessível! Status: $EXTERNAL_STATUS"
    echo ""
    echo "🎉 CORREÇÃO CONCLUÍDA COM SUCESSO!"
    echo "=================================="
    echo ""
    echo "✅ Acesse: https://juliocamara.dev/abmix-ligacao/"
    echo "✅ WebSocket: wss://juliocamara.dev/abmix-ligacao/media"
    echo ""
elif [ "$EXTERNAL_STATUS" = "404" ]; then
    log_error "❌ Ainda retornando 404. Verifique os logs no servidor:"
    echo "   ssh root@95.216.201.197"
    echo "   pm2 logs abmix-ligacao"
else
    log_warning "⚠️ Status: $EXTERNAL_STATUS"
    echo "Verifique os logs para mais detalhes"
fi

echo ""
log_info "📋 COMANDOS ÚTEIS PARA DEBUG:"
echo "   • ssh root@95.216.201.197"
echo "   • pm2 logs abmix-ligacao"
echo "   • pm2 restart abmix-ligacao"
echo "   • curl http://127.0.0.1:5001/"
echo ""



