import { queries } from '../database';
import { TwilioProvider } from './twilioProvider';
import { SobreIPProvider } from './sobreipProvider';

export interface VoIPNumberRecord {
  id: number;
  name: string;
  number: string;
  provider: string;
  sip_username: string | null;
  sip_password: string | null;
  sip_server: string | null;
  is_default: boolean;
  status: string;
}

export class ProviderFactory {
  static createProvider(voipNumber: VoIPNumberRecord) {
    console.log(`[PROVIDER_FACTORY] Creating provider for ${voipNumber.name} (${voipNumber.provider})`);
    
    switch (voipNumber.provider.toLowerCase()) {
      case 'twilio':
        return new TwilioProvider();
        
      case 'sobreip':
        if (!voipNumber.sip_username || !voipNumber.sip_server) {
          throw new Error('Configuração SIP incompleta: faltam username ou servidor');
        }
        
        // SECURITY: Password must come from environment variable
        if (!process.env.SOBREIP_PASSWORD) {
          throw new Error('SOBREIP_PASSWORD environment variable not configured');
        }
        
        return new SobreIPProvider(
          voipNumber.sip_username,
          '', // Password will be read from env var inside provider
          voipNumber.sip_server,
          voipNumber.number
        );
        
      case 'falevono':
        if (!voipNumber.sip_username || !voipNumber.sip_server) {
          throw new Error('Configuração SIP incompleta: faltam username ou servidor');
        }
        
        // SECURITY: Password must come from environment variable
        if (!process.env.FALEVONO_PASSWORD) {
          throw new Error('FALEVONO_PASSWORD environment variable not configured');
        }
        
        return new SobreIPProvider(
          voipNumber.sip_username,
          '', // Password will be read from env var inside provider
          voipNumber.sip_server,
          voipNumber.number,
          'FALEVONO' // Specify which env var to use
        );
        
      default:
        throw new Error(`Provedor desconhecido: ${voipNumber.provider}`);
    }
  }

  static getDefaultNumber(): VoIPNumberRecord | null {
    try {
      const defaultNumber = queries.getDefaultVoipNumber.get() as VoIPNumberRecord | undefined;
      return defaultNumber || null;
    } catch (error) {
      console.error('[PROVIDER_FACTORY] Error getting default number:', error);
      return null;
    }
  }

  static getNumberById(id: number): VoIPNumberRecord | null {
    try {
      const number = queries.getVoipNumberById.get(id) as VoIPNumberRecord | undefined;
      return number || null;
    } catch (error) {
      console.error('[PROVIDER_FACTORY] Error getting number by id:', error);
      return null;
    }
  }

  static getNumberByNumber(phoneNumber: string): VoIPNumberRecord | null {
    try {
      const number = queries.getVoipNumberByNumber.get(phoneNumber) as VoIPNumberRecord | undefined;
      return number || null;
    } catch (error) {
      console.error('[PROVIDER_FACTORY] Error getting number by phone:', error);
      return null;
    }
  }

  static getProviderForCall(numberId?: number): { provider: any; voipNumber: VoIPNumberRecord } {
    let voipNumber: VoIPNumberRecord | null = null;

    if (numberId) {
      voipNumber = this.getNumberById(numberId);
    }

    if (!voipNumber) {
      voipNumber = this.getDefaultNumber();
    }

    if (!voipNumber) {
      throw new Error('Nenhum número VoIP configurado. Por favor, cadastre um número primeiro.');
    }

    if (voipNumber.status !== 'active') {
      throw new Error(`O número ${voipNumber.name} está inativo`);
    }

    const provider = this.createProvider(voipNumber);
    
    return { provider, voipNumber };
  }
}
