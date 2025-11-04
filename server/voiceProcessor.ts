// Processador de voz em tempo real para reduzir som robótico
import { EventEmitter } from 'events';
import { queries } from './database';

interface VoiceProcessingOptions {
  removeRoboticTone: boolean;
  enhanceNaturalness: boolean;
  adjustTempo: boolean;
  addEmotionalVariation: boolean;
  humanizeBreathing: boolean;
}

export class VoiceProcessor extends EventEmitter {
  private processingOptions: VoiceProcessingOptions;

  constructor() {
    super();
    this.processingOptions = {
      removeRoboticTone: true,
      enhanceNaturalness: true,
      adjustTempo: true,
      addEmotionalVariation: true,
      humanizeBreathing: true
    };
  }

  // Configurações aprimoradas para ElevenLabs
  getOptimizedVoiceSettings(voiceType: 'masc' | 'fem'): any {
    const baseSettings = {
      stability: 0.35,        // Menos estável = mais natural
      similarity_boost: 0.95, // Máxima similaridade
      style: 0.15,           // Estilo sutil para naturalidade
      use_speaker_boost: true // Clareza máxima
    };

    // Ajustes específicos por tipo de voz
    if (voiceType === 'fem') {
      return {
        ...baseSettings,
        stability: 0.32,    // Mulheres tendem a ser mais expressivas
        style: 0.18        // Pouco mais de estilo para feminilidade
      };
    }

    return {
      ...baseSettings,
      stability: 0.38,      // Homens mais estáveis
      style: 0.12          // Menos estilo para masculinidade
    };
  }

  // Seleciona o melhor modelo baseado na qualidade desejada
  getBestModel(priority: 'speed' | 'quality' | 'natural'): string {
    switch (priority) {
      case 'speed':
        return 'eleven_flash_v2_5';
      case 'quality':
        return 'eleven_multilingual_v2';
      case 'natural':
        return 'eleven_turbo_v2_5'; // Novo modelo otimizado
      default:
        return 'eleven_multilingual_v2';
    }
  }

  // Vozes recomendadas menos robóticas do ElevenLabs
  getRecommendedVoices(): { masc: string[], fem: string[] } {
    return {
      masc: [
        'pNInz6obpgDQGcFmaJgB', // Adam - voz masculina natural
        'VR6AewLTigWG4xSOukaG', // Arnold - profundo e natural  
        'ErXwobaYiN019PkySvjV', // Antoni - caloroso
        'yoZ06aMxZJJ28mfd3POQ', // Sam - jovem e energético
        'jsCqWAovK2LkecY7zXl4'  // Matheus - português brasileiro
      ],
      fem: [
        'EXAVITQu4vr4xnSDxMaL', // Bella - feminina suave
        'AZnzlk1XvdvUeBnXmlld', // Domi - expressiva
        'TxGEqnHWrfWFTfGW9XjX', // Josh - versátil
        'pFZP5JQG7iQjIQuC4Bku', // Lily - jovem e clara
        'CwhRBWXzGAHq8TQ4Fs17'  // Serena - brasileira natural
      ]
    };
  }

  // Parâmetros avançados para reduzir robotização
  getAdvancedParameters(text: string): any {
    return {
      pronunciation_dictionary_locators: [],
      seed: Math.floor(Math.random() * 1000), // Variação aleatória
      previous_text: "",
      next_text: "",
      previous_request_ids: [],
      next_request_ids: [],
      
      // Configurações específicas para português brasileiro
      optimize_streaming_latency: 0, // Prioriza qualidade
      output_format: "mp3_44100_128", // Alta qualidade de áudio
      
      // Adiciona variação natural baseada no texto
      apply_text_normalization: "auto"
    };
  }

  // Processamento de áudio pós-geração
  async processAudioBuffer(audioBuffer: Buffer, options?: Partial<VoiceProcessingOptions>): Promise<Buffer> {
    const settings = { ...this.processingOptions, ...options };
    
    // Aqui adicionaríamos filtros de áudio para:
    // 1. Remover frequências robóticas
    // 2. Adicionar variações naturais de pitch
    // 3. Suavizar transições
    // 4. Adicionar micro-pausas humanas
    
    console.log('[VOICE_PROCESSOR] Processing audio with natural enhancement');
    
    // Por enquanto retorna o buffer original
    // Em implementação futura, aplicaria filtros DSP
    return audioBuffer;
  }

  // Configurações otimizadas por tipo de conteúdo
  getSettingsForContent(contentType: 'casual' | 'professional' | 'emotional'): any {
    const base = this.getOptimizedVoiceSettings('masc');
    
    switch (contentType) {
      case 'casual':
        return {
          ...base,
          stability: 0.25,  // Mais variação
          style: 0.20      // Mais personalidade
        };
      case 'professional':
        return {
          ...base,
          stability: 0.45,  // Mais consistente
          style: 0.10      // Mais neutro
        };
      case 'emotional':
        return {
          ...base,
          stability: 0.20,  // Muito expressivo
          style: 0.25      // Máxima personalidade
        };
      default:
        return base;
    }
  }
}

export const voiceProcessor = new VoiceProcessor();