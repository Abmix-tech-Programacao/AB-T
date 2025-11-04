import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';

export function VoiceTester() {
  const { toast } = useToast();
  const [selectedMascVoice, setSelectedMascVoice] = useState<string>('');
  const [selectedFemVoice, setSelectedFemVoice] = useState<string>('');
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  const testPhrase = "Olá, bem-vindo à Disck Mix. Seu painel inteligente de ligações.";

  // Get available voices
  const { data: voices = [] } = useQuery({
    queryKey: ['/api/voices'],
    queryFn: () => api.getVoices(),
  });

  const testVoiceMutation = useMutation({
    mutationFn: ({ voiceId }: { voiceId: string }) => api.testVoice(voiceId, testPhrase),
    onSuccess: async (response, variables) => {
      try {
        // Stop any currently playing audio
        if (currentAudio) {
          currentAudio.pause();
          setCurrentAudio(null);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        setCurrentAudio(audio);
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setCurrentAudio(null);
        };

        await audio.play();

        toast({
          title: "Voz testada",
          description: "Reproduzindo amostra da voz selecionada",
        });
      } catch (error) {
        console.error('Error playing voice test:', error);
        toast({
          title: "Erro no teste",
          description: "Não foi possível reproduzir a voz",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Erro no teste de voz",
        description: error instanceof Error ? error.message : "Falha na operação",
        variant: "destructive",
      });
    }
  });

  const handleTestVoice = (voiceId: string, type: 'masc' | 'fem') => {
    if (!voiceId) {
      toast({
        title: "Nenhuma voz selecionada",
        description: `Selecione uma voz ${type === 'masc' ? 'masculina' : 'feminina'} para testar`,
        variant: "destructive",
      });
      return;
    }

    testVoiceMutation.mutate({ voiceId });
  };

  return (
    <div className="bg-dark-surface rounded-xl p-6 border border-dark-border">
      <h3 className="text-lg font-semibold mb-4">Configurar Vozes</h3>
      
      <div className="space-y-4">
        {/* Masculine Voice */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Voz Masculina
          </label>
          <div className="flex space-x-2">
            <Select value={selectedMascVoice} onValueChange={setSelectedMascVoice}>
              <SelectTrigger className="flex-1" data-testid="select-masculine-voice">
                <SelectValue placeholder="Selecione voz masculina" />
              </SelectTrigger>
              <SelectContent>
                {voices.map((voice: any) => (
                  <SelectItem key={voice.voice_id} value={voice.voice_id}>
                    {voice.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => handleTestVoice(selectedMascVoice, 'masc')}
              disabled={testVoiceMutation.isPending || !selectedMascVoice}
              className="bg-abmix-green text-black hover:bg-abmix-green/80 border-abmix-green"
              data-testid="test-masculine-voice"
            >
              {testVoiceMutation.isPending ? 'Testando...' : 'Testar'}
            </Button>
          </div>
        </div>

        {/* Feminine Voice */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Voz Feminina
          </label>
          <div className="flex space-x-2">
            <Select value={selectedFemVoice} onValueChange={setSelectedFemVoice}>
              <SelectTrigger className="flex-1" data-testid="select-feminine-voice">
                <SelectValue placeholder="Selecione voz feminina" />
              </SelectTrigger>
              <SelectContent>
                {voices.map((voice: any) => (
                  <SelectItem key={voice.voice_id} value={voice.voice_id}>
                    {voice.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => handleTestVoice(selectedFemVoice, 'fem')}
              disabled={testVoiceMutation.isPending || !selectedFemVoice}
              className="bg-abmix-green text-black hover:bg-abmix-green/80 border-abmix-green"
              data-testid="test-feminine-voice"
            >
              {testVoiceMutation.isPending ? 'Testando...' : 'Testar'}
            </Button>
          </div>
        </div>

        {/* Test phrase display */}
        <div className="mt-4 p-3 bg-dark-bg rounded-lg border border-dark-border">
          <p className="text-sm text-gray-400 mb-1">Frase de teste:</p>
          <p className="text-sm italic">"{testPhrase}"</p>
        </div>
      </div>
    </div>
  );
}