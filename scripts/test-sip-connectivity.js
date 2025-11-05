#!/usr/bin/env node

/**
 * Script para testar conectividade SIP com o servidor FaleVono
 */

import { createRequire } from 'module';
import { exec } from 'child_process';
import { promisify } from 'util';
import net from 'net';

const require = createRequire(import.meta.url);
const execAsync = promisify(exec);

const SIP_SERVER = 'vono2.me';
const SIP_PORT = 5060;

console.log('🔍 Testando conectividade SIP...\n');

// Teste 1: Resolução DNS
async function testDNS() {
  console.log('1️⃣ Testando resolução DNS...');
  try {
    const { stdout } = await execAsync(`nslookup ${SIP_SERVER}`);
    console.log(`✅ DNS OK: ${SIP_SERVER} resolvido`);
    console.log(stdout.split('\n').slice(0, 4).join('\n'));
  } catch (error) {
    console.log(`❌ DNS FALHOU: ${error.message}`);
    return false;
  }
  return true;
}

// Teste 2: Conectividade TCP
async function testTCP() {
  console.log('\n2️⃣ Testando conectividade TCP...');
  return new Promise((resolve) => {
    const socket = net.createConnection(SIP_PORT, SIP_SERVER);
    
    socket.setTimeout(5001);
    
    socket.on('connect', () => {
      console.log(`✅ TCP OK: Conectado a ${SIP_SERVER}:${SIP_PORT}`);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('error', (error) => {
      console.log(`❌ TCP FALHOU: ${error.message}`);
      resolve(false);
    });
    
    socket.on('timeout', () => {
      console.log(`❌ TCP TIMEOUT: Não foi possível conectar em 5 segundos`);
      socket.destroy();
      resolve(false);
    });
  });
}

// Teste 3: Ping
async function testPing() {
  console.log('\n3️⃣ Testando ping...');
  try {
    const { stdout } = await execAsync(`ping -c 4 ${SIP_SERVER}`);
    console.log(`✅ PING OK: ${SIP_SERVER} está acessível`);
    
    // Extrair tempo médio de ping
    const avgMatch = stdout.match(/avg = ([\d.]+)/);
    if (avgMatch) {
      console.log(`📊 Latência média: ${avgMatch[1]}ms`);
    }
  } catch (error) {
    console.log(`❌ PING FALHOU: ${error.message}`);
    return false;
  }
  return true;
}

// Teste 4: Verificar variáveis de ambiente
function testEnvironment() {
  console.log('\n4️⃣ Verificando variáveis de ambiente...');
  
  const requiredVars = [
    'FALEVONO_PASSWORD',
    'NODE_ENV'
  ];
  
  const optionalVars = [
    'SIP_USE_TCP',
    'FALEVONO_SIP_PORT'
  ];
  
  let allGood = true;
  
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (!value) {
      console.log(`❌ ${varName}: NÃO DEFINIDA`);
      allGood = false;
    } else {
      const displayValue = varName.includes('PASSWORD') 
        ? `${value.substring(0, 3)}***` 
        : value;
      console.log(`✅ ${varName}: ${displayValue}`);
    }
  });
  
  optionalVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${value}`);
    } else {
      console.log(`⚪ ${varName}: não definida (usando padrão)`);
    }
  });
  
  return allGood;
}

// Teste 5: Verificar portas locais
async function testLocalPorts() {
  console.log('\n5️⃣ Verificando portas locais...');
  try {
    const { stdout } = await execAsync('netstat -tulpn 2>/dev/null | grep -E ":(5001|5001|7060|7060)" || echo "Nenhuma porta SIP em uso"');
    console.log('📊 Portas em uso:');
    console.log(stdout || 'Nenhuma porta SIP detectada');
  } catch (error) {
    console.log('⚠️ Não foi possível verificar portas locais');
  }
}

// Executar todos os testes
async function runAllTests() {
  console.log(`🎯 Testando conectividade com ${SIP_SERVER}:${SIP_PORT}\n`);
  
  const dnsOk = await testDNS();
  const tcpOk = await testTCP();
  const pingOk = await testPing();
  const envOk = testEnvironment();
  await testLocalPorts();
  
  console.log('\n📋 RESUMO DOS TESTES:');
  console.log(`DNS: ${dnsOk ? '✅' : '❌'}`);
  console.log(`TCP: ${tcpOk ? '✅' : '❌'}`);
  console.log(`PING: ${pingOk ? '✅' : '❌'}`);
  console.log(`ENV: ${envOk ? '✅' : '❌'}`);
  
  if (dnsOk && tcpOk && pingOk && envOk) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM! A conectividade SIP deve funcionar.');
  } else {
    console.log('\n⚠️ ALGUNS TESTES FALHARAM. Verifique a conectividade de rede.');
    
    if (!dnsOk) console.log('   • Problema de DNS - verifique resolução de nomes');
    if (!tcpOk) console.log('   • Problema de conectividade TCP - firewall ou rede');
    if (!pingOk) console.log('   • Problema de conectividade geral');
    if (!envOk) console.log('   • Variáveis de ambiente não configuradas');
  }
  
  console.log('\n💡 Para testar SIP com TCP, configure: SIP_USE_TCP=true');
  console.log('💡 Para usar porta SIP alternativa, configure: FALEVONO_SIP_PORT=8060');
}

runAllTests().catch(console.error);
