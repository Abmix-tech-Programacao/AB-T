import { db, queries } from './database';

console.log('[SEED] Limpando números VoIP antigos e inserindo FaleVono...');

try {
  // LIMPAR TODOS OS NÚMEROS ANTIGOS
  db.exec('DELETE FROM voip_numbers');
  console.log('[SEED] ✅ Números antigos removidos');
  
  // INSERIR NÚMERO FALEVONO
  db.exec(`
    INSERT INTO voip_numbers (
      name, number, provider, sip_username, sip_password, 
      sip_server, sip_port, sip_ips, is_default, status
    ) VALUES (
      'FaleVono - SP',
      '+5511920838833',
      'falevono',
      'Felipe_Manieri',
      NULL,
      'vono2.me',
      5060,
      '190.89.248.47,190.89.248.48',
      1,
      'active'
    )
  `);
  
  console.log('[SEED] ✅ Número FaleVono adicionado com sucesso!');
  console.log('[SEED] 📞 Número: +55 11 92083-8833');
  console.log('[SEED] 👤 Usuário SIP: Felipe_Manieri');
  console.log('[SEED] 🌐 Domínio: vono2.me');
  console.log('[SEED] 🔌 Porta: 5060');
  console.log('[SEED] 📡 IPs: 190.89.248.47, 190.89.248.48');
  console.log('[SEED] ⚠️  IMPORTANTE: Configure FALEVONO_PASSWORD=Fe120784! como secret');
  
  const numbers = queries.getAllVoipNumbers.all();
  console.log('[SEED] ℹ️  Total de números cadastrados:', numbers.length);
  numbers.forEach((num: any) => {
    console.log(`  ⭐ ${num.name} (${num.number}) - ${num.provider}`);
  });
} catch (error) {
  console.error('[SEED] ❌ Erro ao configurar números VoIP:', error);
}
