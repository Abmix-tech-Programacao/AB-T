#!/usr/bin/env node

// Script simples para testar a chave ElevenLabs
const https = require('https');
const fs = require('fs');
const path = require('path');

console.log('🔍 Testando chave ElevenLabs...\n');

// Lê o arquivo .env manualmente
const envPath = path.join(__dirname, '..', '.env');
let ELEVENLABS_API_KEY = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('ELEVENLABS_API_KEY=')) {
      ELEVENLABS_API_KEY = line.split('=')[1].trim();
      break;
    }
  }
}

if (!ELEVENLABS_API_KEY) {
  console.log('❌ Chave ElevenLabs não encontrada no arquivo .env');
  console.log('   Verifique se o arquivo .env existe e contém:');
  console.log('   ELEVENLABS_API_KEY=sk_sua_chave_aqui');
  process.exit(1);
}

console.log('📋 Informações da chave:');
console.log(`   Comprimento: ${ELEVENLABS_API_KEY.length} caracteres`);
console.log(`   Começa com: ${ELEVENLABS_API_KEY.substring(0, 3)}...`);
console.log(`   Termina com: ...${ELEVENLABS_API_KEY.substring(ELEVENLABS_API_KEY.length - 3)}`);

if (!ELEVENLABS_API_KEY.startsWith('sk_')) {
  console.log('⚠️  ATENÇÃO: A chave não começa com "sk_"');
  console.log('   Chaves ElevenLabs devem começar com "sk_"');
  console.log('   Verifique se você copiou a chave correta');
}

console.log('\n🔗 Testando conectividade com ElevenLabs API...');

const options = {
  hostname: 'api.elevenlabs.io',
  path: '/v1/voices',
  method: 'GET',
  headers: {
    'xi-api-key': ELEVENLABS_API_KEY,
    'User-Agent': 'AbmixDialer/1.0'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`\n📡 Resposta da API: Status ${res.statusCode}`);
    
    if (res.statusCode === 200) {
      try {
        const response = JSON.parse(data);
        console.log('✅ SUCESSO! Chave ElevenLabs é válida');
        console.log(`   Vozes disponíveis: ${response.voices ? response.voices.length : 0}`);
        
        if (response.voices && response.voices.length > 0) {
          console.log('\n🎤 Primeiras 3 vozes disponíveis:');
          response.voices.slice(0, 3).forEach((voice, index) => {
            console.log(`   ${index + 1}. ${voice.name} (${voice.voice_id})`);
          });
        }
        
        console.log('\n🎉 Sua configuração está PERFEITA para testes!');
        console.log('   Agora você pode usar o sistema de conversão de voz');
        
      } catch (error) {
        console.log('✅ Conexão OK, mas erro ao processar resposta');
        console.log(`   Dados recebidos: ${data.substring(0, 100)}...`);
      }
    } else if (res.statusCode === 401) {
      console.log('❌ ERRO 401: Chave de API inválida ou expirada');
      console.log('\n🔧 Soluções:');
      console.log('   1. Verifique se copiou a chave completa');
      console.log('   2. Confirme que a chave começa com "sk_"');
      console.log('   3. Acesse elevenlabs.io → Profile → API Keys');
      console.log('   4. Gere uma nova chave se necessário');
      
    } else if (res.statusCode === 403) {
      console.log('❌ ERRO 403: Acesso negado');
      console.log('   Sua conta pode estar suspensa ou com limites excedidos');
      
    } else if (res.statusCode === 429) {
      console.log('❌ ERRO 429: Muitas requisições');
      console.log('   Aguarde alguns minutos e tente novamente');
      
    } else {
      console.log(`❌ ERRO ${res.statusCode}: Resposta inesperada`);
      console.log(`   Dados: ${data.substring(0, 200)}...`);
    }
    
    console.log('\n📋 Headers de resposta:');
    Object.entries(res.headers).forEach(([key, value]) => {
      if (key.toLowerCase().includes('rate') || key.toLowerCase().includes('limit')) {
        console.log(`   ${key}: ${value}`);
      }
    });
  });
});

req.on('error', (error) => {
  console.log('❌ ERRO de conexão:');
  console.log(`   ${error.message}`);
  console.log('\n🔧 Possíveis causas:');
  console.log('   1. Sem conexão com a internet');
  console.log('   2. Firewall bloqueando a conexão');
  console.log('   3. Proxy corporativo');
});

req.setTimeout(10000, () => {
  console.log('❌ TIMEOUT: Conexão demorou mais de 10 segundos');
  req.destroy();
});

req.end();







