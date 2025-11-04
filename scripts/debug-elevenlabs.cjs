#!/usr/bin/env node

// Script detalhado para debug da chave ElevenLabs
const https = require('https');
const fs = require('fs');
const path = require('path');

console.log('🔍 Debug detalhado da chave ElevenLabs...\n');

// Lê o arquivo .env
const envPath = path.join(__dirname, '..', '.env');
let ELEVENLABS_API_KEY = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('📄 Conteúdo do arquivo .env:');
  
  const lines = envContent.split('\n');
  lines.forEach((line, index) => {
    if (line.startsWith('ELEVENLABS_API_KEY=')) {
      ELEVENLABS_API_KEY = line.split('=')[1].trim();
      console.log(`   Linha ${index + 1}: ELEVENLABS_API_KEY=sk_***[OCULTA]***`);
    } else if (line.trim() && !line.startsWith('#')) {
      console.log(`   Linha ${index + 1}: ${line}`);
    }
  });
} else {
  console.log('❌ Arquivo .env não encontrado!');
  process.exit(1);
}

if (!ELEVENLABS_API_KEY) {
  console.log('❌ Chave ElevenLabs não encontrada no .env');
  process.exit(1);
}

console.log('\n🔍 Análise da chave:');
console.log(`   Comprimento total: ${ELEVENLABS_API_KEY.length}`);
console.log(`   Primeiros 10 chars: ${ELEVENLABS_API_KEY.substring(0, 10)}`);
console.log(`   Últimos 5 chars: ${ELEVENLABS_API_KEY.substring(ELEVENLABS_API_KEY.length - 5)}`);

// Verificações de formato
const issues = [];
if (!ELEVENLABS_API_KEY.startsWith('sk_')) {
  issues.push('❌ Não começa com "sk_"');
}
if (ELEVENLABS_API_KEY.length < 30) {
  issues.push('❌ Muito curta (deve ter 40+ caracteres)');
}
if (ELEVENLABS_API_KEY.includes(' ')) {
  issues.push('❌ Contém espaços');
}
if (ELEVENLABS_API_KEY.includes('\n') || ELEVENLABS_API_KEY.includes('\r')) {
  issues.push('❌ Contém quebras de linha');
}

if (issues.length > 0) {
  console.log('\n⚠️  PROBLEMAS DETECTADOS:');
  issues.forEach(issue => console.log(`   ${issue}`));
} else {
  console.log('\n✅ Formato da chave parece correto');
}

console.log('\n🔗 Testando diferentes endpoints ElevenLabs...');

// Teste 1: Endpoint /v1/user (informações da conta)
function testUserEndpoint() {
  return new Promise((resolve) => {
    console.log('\n📡 Teste 1: /v1/user (informações da conta)');
    
    const options = {
      hostname: 'api.elevenlabs.io',
      path: '/v1/user',
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'User-Agent': 'AbmixDialer/1.0',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        if (res.statusCode === 200) {
          try {
            const user = JSON.parse(data);
            console.log('   ✅ SUCESSO!');
            console.log(`   Usuário: ${user.subscription?.tier || 'Free'}`);
            console.log(`   Caracteres restantes: ${user.subscription?.character_count || 0}/${user.subscription?.character_limit || 10000}`);
          } catch (e) {
            console.log('   ✅ Conectado, mas erro no JSON');
          }
        } else {
          console.log(`   ❌ Erro: ${data.substring(0, 200)}`);
        }
        resolve(res.statusCode === 200);
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ Erro de rede: ${error.message}`);
      resolve(false);
    });

    req.setTimeout(5000, () => {
      console.log('   ❌ Timeout');
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Teste 2: Endpoint /v1/voices (listar vozes)
function testVoicesEndpoint() {
  return new Promise((resolve) => {
    console.log('\n📡 Teste 2: /v1/voices (listar vozes)');
    
    const options = {
      hostname: 'api.elevenlabs.io',
      path: '/v1/voices',
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'User-Agent': 'AbmixDialer/1.0',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            console.log('   ✅ SUCESSO!');
            console.log(`   Vozes disponíveis: ${response.voices?.length || 0}`);
            if (response.voices && response.voices.length > 0) {
              console.log(`   Primeira voz: ${response.voices[0].name}`);
            }
          } catch (e) {
            console.log('   ✅ Conectado, mas erro no JSON');
          }
        } else {
          console.log(`   ❌ Erro: ${data.substring(0, 200)}`);
        }
        resolve(res.statusCode === 200);
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ Erro de rede: ${error.message}`);
      resolve(false);
    });

    req.setTimeout(5000, () => {
      console.log('   ❌ Timeout');
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Executar testes
async function runTests() {
  const userTest = await testUserEndpoint();
  const voicesTest = await testVoicesEndpoint();
  
  console.log('\n📋 RESUMO DOS TESTES:');
  console.log(`   /v1/user: ${userTest ? '✅ OK' : '❌ FALHOU'}`);
  console.log(`   /v1/voices: ${voicesTest ? '✅ OK' : '❌ FALHOU'}`);
  
  if (userTest && voicesTest) {
    console.log('\n🎉 CHAVE VÁLIDA! O problema pode estar no frontend.');
    console.log('   Verifique se o modal está usando a chave correta.');
  } else {
    console.log('\n❌ PROBLEMA DE PERMISSÕES NA CHAVE!');
    console.log('\n🔧 SOLUÇÃO RÁPIDA:');
    console.log('   1. Acesse: https://elevenlabs.io');
    console.log('   2. Login → Perfil → "API Key"');
    console.log('   3. Clique "Create API Key" ou "Generate New Key"');
    console.log('   4. ✅ MARQUE TODAS as permissões disponíveis:');
    console.log('      - voices_read (listar vozes)');
    console.log('      - user_read (info da conta)');
    console.log('      - speech_to_speech (conversão)');
    console.log('      - text_to_speech (síntese)');
    console.log('   5. Copie a nova chave COMPLETA');
    console.log('   6. Substitua no arquivo .env');
    console.log('   7. Reinicie: npm run dev');
    console.log('\n📖 Guia detalhado: ELEVENLABS_FIX.md');
  }
}

runTests();
