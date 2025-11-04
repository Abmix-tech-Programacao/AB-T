#!/usr/bin/env node

// Script para debug das variáveis de ambiente no servidor
const fs = require('fs');
const path = require('path');

console.log('🔍 Debug das variáveis de ambiente do servidor...\n');

// 1. Verificar arquivo .env
const envPath = path.join(__dirname, '..', '.env');
console.log('📄 Verificando arquivo .env:');
console.log(`   Caminho: ${envPath}`);
console.log(`   Existe: ${fs.existsSync(envPath) ? '✅ Sim' : '❌ Não'}`);

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log(`   Tamanho: ${envContent.length} bytes\n`);
  
  console.log('📋 Conteúdo do .env:');
  const lines = envContent.split('\n');
  lines.forEach((line, index) => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=');
      
      if (key === 'TWILIO_NUMBER') {
        console.log(`   Linha ${index + 1}: ${key}=${value} ✅`);
      } else if (key.includes('TWILIO')) {
        console.log(`   Linha ${index + 1}: ${key}=***OCULTO*** ✅`);
      } else if (key === 'ELEVENLABS_API_KEY') {
        console.log(`   Linha ${index + 1}: ${key}=***OCULTO*** ✅`);
      } else {
        console.log(`   Linha ${index + 1}: ${line}`);
      }
    }
  });
}

// 2. Verificar variáveis do processo atual
console.log('\n🔧 Variáveis do processo Node.js:');
const requiredVars = [
  'ELEVENLABS_API_KEY',
  'TWILIO_ACCOUNT_SID', 
  'TWILIO_AUTH_TOKEN',
  'TWILIO_NUMBER'
];

requiredVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  const info = value ? `(${value.length} chars)` : '(não definida)';
  
  if (varName === 'TWILIO_NUMBER' && value) {
    console.log(`   ${status} ${varName}: ${value} ${info}`);
  } else {
    console.log(`   ${status} ${varName}: ***OCULTO*** ${info}`);
  }
});

// 3. Simular carregamento manual do .env
console.log('\n🧪 Teste de carregamento manual do .env:');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#') && line.includes('=')) {
      const [key, ...valueParts] = line.split('=');
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  console.log('   Variáveis encontradas:');
  Object.keys(envVars).forEach(key => {
    if (key === 'TWILIO_NUMBER') {
      console.log(`   ✅ ${key}: ${envVars[key]}`);
    } else if (key.includes('TWILIO') || key.includes('ELEVENLABS')) {
      console.log(`   ✅ ${key}: ***OCULTO***`);
    } else {
      console.log(`   ✅ ${key}: ${envVars[key]}`);
    }
  });
  
  // Verificar especificamente TWILIO_NUMBER
  if (envVars.TWILIO_NUMBER) {
    const twilioNumber = envVars.TWILIO_NUMBER;
    console.log(`\n🎯 Análise do TWILIO_NUMBER:`);
    console.log(`   Valor: "${twilioNumber}"`);
    console.log(`   Comprimento: ${twilioNumber.length}`);
    console.log(`   Começa com +: ${twilioNumber.startsWith('+') ? '✅' : '❌'}`);
    console.log(`   Contém espaços: ${twilioNumber.includes(' ') ? '❌ SIM' : '✅ NÃO'}`);
    console.log(`   Contém quebras: ${twilioNumber.includes('\n') || twilioNumber.includes('\r') ? '❌ SIM' : '✅ NÃO'}`);
  }
}

console.log('\n💡 Se TWILIO_NUMBER está no .env mas não no processo:');
console.log('   1. Reinicie o servidor: npm run dev');
console.log('   2. Verifique se não há espaços extras no .env');
console.log('   3. Confirme que o arquivo .env está na raiz do projeto');
console.log('   4. Verifique se não há caracteres especiais invisíveis');







