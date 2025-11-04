#!/usr/bin/env node

// Script para verificar se as variáveis de ambiente estão configuradas corretamente
const { existsSync } = require('fs');
const path = require('path');

// Carrega as variáveis do .env se o arquivo existir
const envPath = path.join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  console.log('⚠️  Arquivo .env não encontrado na raiz do projeto');
  console.log('   Crie o arquivo .env com suas chaves de API\n');
}

console.log('🔍 Verificando configurações do .env para teste de conversão de voz...\n');

const requiredVars = [
  { name: 'ELEVENLABS_API_KEY', required: true, description: 'Chave da API ElevenLabs (conversão de voz)' },
  { name: 'TWILIO_ACCOUNT_SID', required: true, description: 'SID da conta Twilio (chamadas)' },
  { name: 'TWILIO_AUTH_TOKEN', required: true, description: 'Token de autenticação Twilio' },
  { name: 'TWILIO_NUMBER', required: true, description: 'Número Twilio para chamadas' },
  { name: 'DEEPGRAM_API_KEY', required: false, description: 'Chave Deepgram (transcrição - opcional)' },
  { name: 'NODE_ENV', required: false, description: 'Ambiente de execução' },
  { name: 'PORT', required: false, description: 'Porta do servidor' }
];

let allGood = true;
let missingRequired = [];

console.log('📋 Status das variáveis de ambiente:\n');

for (const envVar of requiredVars) {
  const value = process.env[envVar.name];
  const isPresent = !!value;
  const isRequired = envVar.required;
  
  let status = '❌';
  let info = 'Não configurada';
  
  if (isPresent) {
    status = '✅';
    
    // Validações específicas
    if (envVar.name === 'ELEVENLABS_API_KEY') {
      if (value.startsWith('sk_') && value.length > 30) {
        info = `Formato correto (${value.length} caracteres)`;
      } else {
        info = `⚠️  Formato suspeito (deve começar com 'sk_')`;
        status = '⚠️ ';
      }
    } else if (envVar.name === 'TWILIO_ACCOUNT_SID') {
      if (value.startsWith('AC') && value.length === 34) {
        info = 'Formato correto (34 caracteres)';
      } else {
        info = `⚠️  Formato suspeito (deve começar com 'AC' e ter 34 caracteres)`;
        status = '⚠️ ';
      }
    } else if (envVar.name === 'TWILIO_AUTH_TOKEN') {
      if (value.length === 32) {
        info = 'Formato correto (32 caracteres)';
      } else {
        info = `⚠️  Formato suspeito (deve ter 32 caracteres, tem ${value.length})`;
        status = '⚠️ ';
      }
    } else if (envVar.name === 'TWILIO_NUMBER') {
      if (value.startsWith('+') && value.length >= 10) {
        info = `Formato correto (${value})`;
      } else {
        info = `⚠️  Formato suspeito (deve começar com '+')`;
        status = '⚠️ ';
      }
    } else {
      info = `Configurada (${value})`;
    }
  } else {
    if (isRequired) {
      allGood = false;
      missingRequired.push(envVar.name);
    }
  }
  
  const requiredText = isRequired ? '(OBRIGATÓRIA)' : '(opcional)';
  console.log(`${status} ${envVar.name} ${requiredText}`);
  console.log(`   ${info}`);
  console.log(`   Descrição: ${envVar.description}\n`);
}

// Resumo
console.log('=' .repeat(60));
if (allGood) {
  console.log('🎉 TODAS as variáveis obrigatórias estão configuradas!');
  console.log('✅ Seu sistema está pronto para teste de conversão de voz');
  
  console.log('\n🚀 Para testar:');
  console.log('1. Execute: npm run dev');
  console.log('2. Acesse: http://localhost:5000');
  console.log('3. Digite seu número e clique "Discar"');
  console.log('4. Atenda a ligação');
  console.log('5. Ative o switch "Conversão de Voz"');
  console.log('6. Fale e ouça sua voz modificada! 🎤✨');
} else {
  console.log('❌ FALTAM variáveis obrigatórias:');
  console.log(`   ${missingRequired.join(', ')}`);
  console.log('\n📝 Crie/edite o arquivo .env na raiz do projeto com:');
  console.log('   ELEVENLABS_API_KEY=sk_sua_chave_aqui');
  console.log('   TWILIO_ACCOUNT_SID=AC_seu_sid_aqui');
  console.log('   TWILIO_AUTH_TOKEN=seu_token_aqui');
  console.log('   TWILIO_NUMBER=+5511999999999');
}

console.log('\n💡 Dica: Execute este script sempre que alterar o .env');
console.log('   node scripts/check-env.js');

// Teste de conectividade (se as chaves estão presentes)
async function testConnectivity() {
  if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY.startsWith('sk_')) {
    console.log('\n🔗 Testando conectividade com ElevenLabs...');
    
    try {
      const https = require('https');
      const options = {
        hostname: 'api.elevenlabs.io',
        path: '/v1/voices',
        method: 'GET',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY
        }
      };
      
      const req = https.request(options, (res) => {
        if (res.statusCode === 200) {
          console.log('✅ ElevenLabs: Conectado! Chave API válida');
        } else {
          console.log(`❌ ElevenLabs: Erro ${res.statusCode} - Verifique sua chave API`);
        }
      });
      
      req.on('error', (error) => {
        console.log(`❌ ElevenLabs: Erro de conexão - ${error.message}`);
      });
      
      req.end();
    } catch (error) {
      console.log(`❌ ElevenLabs: Erro - ${error.message}`);
    }
  }

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    console.log('\n🔗 Testando conectividade com Twilio...');
    
    try {
      const https = require('https');
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      
      const options = {
        hostname: 'api.twilio.com',
        path: `/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}.json`,
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`
        }
      };
      
      const req = https.request(options, (res) => {
        if (res.statusCode === 200) {
          console.log('✅ Twilio: Conectado! Credenciais válidas');
        } else {
          console.log(`❌ Twilio: Erro ${res.statusCode} - Verifique suas credenciais`);
        }
      });
      
      req.on('error', (error) => {
        console.log(`❌ Twilio: Erro de conexão - ${error.message}`);
      });
      
      req.end();
    } catch (error) {
      console.log(`❌ Twilio: Erro - ${error.message}`);
    }
  }
}

// Executar teste de conectividade
if (allGood) {
  testConnectivity();
}

console.log('\n' + '='.repeat(60));
