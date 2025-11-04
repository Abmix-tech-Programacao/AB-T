#!/usr/bin/env node

// Script para reiniciar o servidor e verificar se tudo está funcionando
const { spawn, exec } = require('child_process');
const https = require('https');

console.log('🔄 Reiniciando servidor AbmixDialer...\n');

// Função para matar processos na porta 5000
function killPort5000() {
  return new Promise((resolve) => {
    exec('netstat -ano | findstr :5000', (error, stdout) => {
      if (error) {
        resolve();
        return;
      }
      
      const lines = stdout.split('\n');
      const pids = new Set();
      
      lines.forEach(line => {
        if (line.includes('LISTENING') || line.includes('ESTABLISHED')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            pids.add(pid);
          }
        }
      });
      
      if (pids.size > 0) {
        console.log(`🔪 Matando processos na porta 5000: ${Array.from(pids).join(', ')}`);
        pids.forEach(pid => {
          exec(`taskkill /F /PID ${pid}`, (err) => {
            if (err) console.log(`   ⚠️  Erro ao matar PID ${pid}: ${err.message}`);
          });
        });
        
        setTimeout(resolve, 2000); // Aguarda 2 segundos
      } else {
        resolve();
      }
    });
  });
}

// Função para testar se o servidor está respondendo
function testServer() {
  return new Promise((resolve) => {
    console.log('🧪 Testando servidor...');
    
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/call/dial',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    const req = require('http').request(options, (res) => {
      if (res.statusCode === 400) {
        console.log('✅ Servidor respondendo corretamente!');
        console.log('   API está funcionando (erro 400 esperado sem parâmetros)');
        resolve(true);
      } else {
        console.log(`⚠️  Resposta inesperada: ${res.statusCode}`);
        resolve(false);
      }
    });
    
    req.on('error', (error) => {
      console.log(`❌ Servidor não está respondendo: ${error.message}`);
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      console.log('❌ Timeout ao testar servidor');
      req.destroy();
      resolve(false);
    });
    
    req.write(JSON.stringify({}));
    req.end();
  });
}

// Função principal
async function main() {
  try {
    // 1. Matar processos existentes
    await killPort5000();
    
    // 2. Aguardar um pouco
    console.log('⏳ Aguardando limpeza da porta...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. Iniciar novo servidor
    console.log('🚀 Iniciando novo servidor...');
    const serverProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'pipe',
      shell: true
    });
    
    // Capturar saída do servidor
    let serverReady = false;
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[SERVER] ${output.trim()}`);
      
      if (output.includes('HTTP/WS on')) {
        serverReady = true;
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.log(`[ERROR] ${data.toString().trim()}`);
    });
    
    // 4. Aguardar servidor estar pronto
    console.log('⏳ Aguardando servidor inicializar...');
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (serverReady) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500);
      
      // Timeout após 30 segundos
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 30000);
    });
    
    // 5. Aguardar mais um pouco para garantir
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 6. Testar servidor
    const isWorking = await testServer();
    
    if (isWorking) {
      console.log('\n🎉 SERVIDOR PRONTO!');
      console.log('   📱 Acesse: http://localhost:5000');
      console.log('   🔧 Configure suas chaves no modal');
      console.log('   📞 Teste uma ligação com conversão de voz!');
      console.log('\n💡 Para parar o servidor: Ctrl+C no terminal onde está rodando');
    } else {
      console.log('\n❌ Servidor iniciou mas não está respondendo corretamente');
      console.log('   Verifique os logs acima para identificar o problema');
    }
    
  } catch (error) {
    console.error('❌ Erro ao reiniciar servidor:', error.message);
  }
}

main();







