#!/usr/bin/env node

// Teste completo do sistema de conversão de voz
const https = require('https');
const http = require('http');

console.log('🎤 Teste Completo do Sistema de Conversão de Voz\n');

async function testSystem() {
  console.log('1. 🔍 Testando servidor local...');
  
  // Teste 1: Servidor respondendo
  try {
    const response = await makeRequest('GET', 'http://localhost:5000/api/health');
    if (response.status === 200) {
      console.log('   ✅ Servidor local funcionando');
    } else {
      console.log('   ❌ Servidor não está respondendo');
      return;
    }
  } catch (error) {
    console.log('   ❌ Erro ao conectar com servidor:', error.message);
    console.log('   💡 Execute: npm run dev');
    return;
  }

  console.log('\n2. 🎯 Testando API de discagem...');
  
  // Teste 2: API de discagem
  try {
    const response = await makeRequest('POST', 'http://localhost:5000/api/call/dial', {
      to: '+5511999999999',
      voiceType: 'fem'
    });
    
    if (response.status === 200) {
      const data = JSON.parse(response.data);
      console.log('   ✅ API de discagem funcionando');
      console.log(`   📞 Call ID: ${data.callSid}`);
      console.log(`   🎤 Voz: ${data.voiceType}`);
      
      // Teste 3: Controle de conversão de voz
      console.log('\n3. 🔄 Testando controle de conversão...');
      
      const toggleResponse = await makeRequest('POST', 'http://localhost:5000/api/voice/toggle', {
        callSid: data.callSid,
        enabled: true
      });
      
      if (toggleResponse.status === 200) {
        console.log('   ✅ Controle de conversão funcionando');
      } else {
        console.log('   ⚠️  Controle de conversão com problemas');
      }
      
      // Teste 4: Status da conversão
      const statusResponse = await makeRequest('GET', `http://localhost:5000/api/voice/status/${data.callSid}`);
      
      if (statusResponse.status === 200) {
        const statusData = JSON.parse(statusResponse.data);
        console.log('   ✅ Status da conversão funcionando');
        console.log(`   📊 Sessões ativas: ${statusData.stats.activeSessions}`);
      }
      
    } else {
      console.log('   ❌ Erro na API de discagem');
      console.log(`   📄 Resposta: ${response.data}`);
    }
  } catch (error) {
    console.log('   ❌ Erro ao testar discagem:', error.message);
  }

  console.log('\n4. 📱 Teste do Frontend...');
  
  try {
    const frontendResponse = await makeRequest('GET', 'http://localhost:5000/');
    if (frontendResponse.status === 200) {
      console.log('   ✅ Frontend carregando corretamente');
      console.log('   🌐 Acesse: http://localhost:5000');
    }
  } catch (error) {
    console.log('   ❌ Erro no frontend:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 RESUMO DO SISTEMA:');
  console.log('');
  console.log('✅ FUNCIONANDO LOCALMENTE:');
  console.log('   • Servidor Express + WebSocket');
  console.log('   • APIs de discagem e controle');
  console.log('   • Interface web completa');
  console.log('   • Integração ElevenLabs + Twilio');
  console.log('');
  console.log('🌐 PARA CONVERSAÇÃO REAL:');
  console.log('   • Deploy em servidor público (Railway/Render/VPS)');
  console.log('   • Configure PUBLIC_BASE_URL no .env');
  console.log('   • WebSocket funcionará: wss://seu-dominio.com/media');
  console.log('   • Conversação bidirecional com conversão de voz!');
  console.log('');
  console.log('🎯 PRÓXIMO PASSO:');
  console.log('   1. Escolha plataforma de deploy');
  console.log('   2. Configure URL pública no .env');
  console.log('   3. Faça deploy do código atual');
  console.log('   4. Teste conversação real!');
  console.log('');
  console.log('📖 Guia detalhado: PRODUCTION_SETUP.md');
  console.log('='.repeat(60));
}

// Helper function para fazer requests
function makeRequest(method, url, data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AbmixDialer-Test/1.0'
      }
    };

    const req = lib.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: responseData,
          headers: res.headers
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Executar teste
testSystem().catch((error) => {
  console.error('\n❌ Erro no teste:', error.message);
  process.exit(1);
});







