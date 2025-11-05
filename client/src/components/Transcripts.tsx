import { useEffect, useRef } from 'react';
import { useCallStore } from '@/stores/useCallStore';
import { format } from 'date-fns';

export function Transcripts() {
  const { transcripts, callState } = useCallStore();
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new transcripts arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcripts]);

  const getSpeakerConfig = (speaker: string) => {
    const configs = {
      'AI': {
        bgColor: 'bg-abmix-green',
        textColor: 'text-abmix-green',
        icon: 'fas fa-robot',
        iconColor: 'text-black',
      },
      'Human': {
        bgColor: 'bg-orange-600',
        textColor: 'text-orange-400',
        icon: 'fas fa-user',
        iconColor: 'text-white',
      },
      'Remote': {
        bgColor: 'bg-blue-600',
        textColor: 'text-blue-400',
        icon: 'fas fa-user',
        iconColor: 'text-white',
      },
    };
    return configs[speaker as keyof typeof configs] || configs.Remote;
  };

  const formatTimestamp = (timestamp: Date) => {
    return format(timestamp, 'HH:mm:ss');
  };

  return (
    <div className="bg-dark-surface rounded-xl p-6 border border-dark-border h-fit flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Legendas (PT-BR)</h3>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${callState === 'CONNECTED' ? 'bg-green-500' : 'bg-gray-500'}`}></div>
          <span className="text-sm text-gray-400">
            {callState === 'CONNECTED' ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 space-y-4 overflow-y-auto max-h-96"
        data-testid="transcripts-container"
      >
        {transcripts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <i className="fas fa-comments text-4xl mb-3 opacity-50"></i>
            <p className="text-center">
              {callState === 'CONNECTED' 
                ? 'Aguardando transcrições...' 
                : 'Inicie uma chamada para ver as transcrições'
              }
            </p>
          </div>
        ) : (
          transcripts.map((transcript, index) => {
            const speakerConfig = getSpeakerConfig(transcript.speaker);
            
            return (
              <div 
                key={`${transcript.id}-${index}`}
                className="flex items-start space-x-3"
                data-testid={`transcript-${transcript.id}`}
              >
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full ${speakerConfig.bgColor} flex items-center justify-center`}>
                    <i className={`${speakerConfig.icon} text-xs ${speakerConfig.iconColor}`}></i>
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className={`text-sm font-medium ${speakerConfig.textColor}`}>
                      {transcript.speaker === 'Remote' ? 'Cliente' : transcript.speaker}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(transcript.timestamp ? new Date(transcript.timestamp) : new Date())}
                    </span>
                    {!transcript.isFinal && (
                      <span className="text-xs text-gray-400 italic">
                        (parcial)
                      </span>
                    )}
                  </div>
                  
                  <p className={`text-sm ${!transcript.isFinal ? 'italic opacity-75' : ''}`}>
                    {transcript.text}
                  </p>
                  
                  {transcript.confidence && (
                    <div className="mt-1">
                      <span className="text-xs text-gray-500">
                        Confiança: {Math.round(transcript.confidence)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
