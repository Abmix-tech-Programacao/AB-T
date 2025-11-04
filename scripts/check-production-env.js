#!/usr/bin/env node

/**
 * Script para verificar se todas as variáveis de ambiente necessárias
 * estão configuradas para produção no EasyPanel
 */

const requiredEnvVars = [
  'FALEVONO_PASSWORD',
  'ELEVENLABS_API_KEY',
  'DEEPGRAM_API_KEY',
  'NODE_ENV'
];

const optionalEnvVars = [
  'SIP_USE_TCP',
  'FALEVONO_SIP_PORT',
  'PORT'
];

console.log('🔍 Verificando configuração de ambiente para produção...\n');

let hasErrors = false;

// Verificar variáveis obrigatórias
console.log('📋 Variáveis obrigatórias:');
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    console.log(`❌ ${varName}: NÃO DEFINIDA`);
    hasErrors = true;
  } else {
    // Mascarar valores sensíveis
    const displayValue = varName.includes('KEY') || varName.includes('PASSWORD') 
      ? `${value.substring(0, 8)}...` 
      : value;
    console.log(`✅ ${varName}: ${displayValue}`);
  }
});

console.log('\n📋 Variáveis opcionais:');
optionalEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value}`);
  } else {
    console.log(`⚪ ${varName}: não definida (usando padrão)`);
  }
});

console.log('\n🔧 Configurações específicas para produção:');

// Verificar configuração SIP para produção
const isProduction = process.env.NODE_ENV === 'production';
const useTCP = process.env.SIP_USE_TCP === 'true';

if (isProduction) {
  console.log('✅ NODE_ENV: production');
  
  if (useTCP) {
    console.log('⚠️  SIP_USE_TCP: true (TCP pode ter limitações com alguns provedores)');
  } else {
    console.log('✅ SIP_USE_TCP: false (UDP recomendado para produção)');
  }
} else {
  console.log('⚠️  NODE_ENV não é "production"');
}

const sipPort = process.env.FALEVONO_SIP_PORT || '6060';
console.log(`✅ FALEVONO_SIP_PORT: ${sipPort}`);

const serverPort = process.env.PORT || '5000';
console.log(`✅ PORT: ${serverPort}`);

console.log('\n📝 Recomendações para EasyPanel:');
console.log('1. Defina NODE_ENV=production');
console.log('2. Configure FALEVONO_PASSWORD com a senha do seu provedor SIP');
console.log('3. Configure ELEVENLABS_API_KEY para síntese de voz');
console.log('4. Configure DEEPGRAM_API_KEY para reconhecimento de voz');
console.log('5. Para produção, deixe SIP_USE_TCP=false (UDP é mais estável)');
console.log('6. Use PORT=5000 ou a porta configurada no EasyPanel');

if (hasErrors) {
  console.log('\n❌ Configuração incompleta! Defina as variáveis obrigatórias antes de fazer deploy.');
  process.exit(1);
} else {
  console.log('\n✅ Configuração de ambiente OK para produção!');
  process.exit(0);
}
