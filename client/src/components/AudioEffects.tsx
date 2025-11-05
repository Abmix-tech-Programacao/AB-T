import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export function AudioEffects() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedEffect, setSelectedEffect] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const effects = [
    { id: 'denoise', name: 'Redução de Ruído', description: 'Remove ruídos de fundo' },
    { id: 'equalize', name: 'Equalização', description: 'Melhora a qualidade do áudio' },
    { id: 'amplify', name: 'Amplificação', description: 'Aumenta o volume' },
    { id: 'normalize', name: 'Normalização', description: 'Ajusta níveis de áudio' }
  ];

  const processEffectMutation = useMutation({
    mutationFn: async (data: { fileId: string; effect: string }) => {
      // Implementation will be added when endpoint is ready
      setIsProcessing(true);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate processing
      setIsProcessing(false);
      return { success: true, processedUrl: '/processed-audio.wav' };
    },
    onSuccess: () => {
      toast({
        title: "Efeito aplicado",
        description: "Processamento de áudio concluído",
      });
      setSelectedFile(null);
      setSelectedEffect('');
    },
    onError: (error) => {
      setIsProcessing(false);
      toast({
        title: "Erro no processamento",
        description: error instanceof Error ? error.message : "Falha na aplicação do efeito",
        variant: "destructive",
      });
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('audio/')) {
        setSelectedFile(file);
      } else {
        toast({
          title: "Arquivo inválido",
          description: "Selecione um arquivo de áudio",
          variant: "destructive",
        });
      }
    }
  };

  const handleApplyEffect = () => {
    if (!selectedFile || !selectedEffect) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um arquivo e um efeito",
        variant: "destructive",
      });
      return;
    }

    processEffectMutation.mutate({ fileId: selectedFile.name, effect: selectedEffect });
  };

  return (
    <div className="bg-dark-surface rounded-xl p-6 border border-dark-border">
      <h3 className="text-lg font-semibold mb-4">Efeitos de Áudio</h3>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="audio-file" className="text-sm font-medium text-foreground">
            Arquivo de Áudio
          </Label>
          <Input
            id="audio-file"
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="mt-1"
            data-testid="audio-file-input"
          />
          {selectedFile && (
            <p className="text-xs text-gray-400 mt-1">
              Arquivo: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
            </p>
          )}
        </div>

        <div>
          <Label className="text-sm font-medium text-foreground">
            Efeito de Áudio
          </Label>
          <Select value={selectedEffect} onValueChange={setSelectedEffect}>
            <SelectTrigger className="mt-1" data-testid="effect-select">
              <SelectValue placeholder="Selecione um efeito" />
            </SelectTrigger>
            <SelectContent>
              {effects.map((effect) => (
                <SelectItem key={effect.id} value={effect.id}>
                  <div className="flex flex-col">
                    <span>{effect.name}</span>
                    <span className="text-xs text-gray-400">{effect.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleApplyEffect}
          disabled={!selectedFile || !selectedEffect || isProcessing}
          className="w-full bg-abmix-green text-black hover:bg-abmix-green/80"
          data-testid="apply-effect-button"
        >
          {isProcessing ? 'Processando...' : 'Aplicar Efeito'}
        </Button>

        {isProcessing && (
          <div className="mt-4 p-3 bg-dark-bg rounded-lg border border-dark-border">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-abmix-green border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-gray-400">Processando efeito de áudio...</span>
            </div>
          </div>
        )}

        <div className="mt-4 p-3 bg-dark-bg rounded-lg border border-dark-border">
          <p className="text-xs text-gray-400">
            <strong>Efeitos disponíveis:</strong> Redução de ruído, equalização automática,
            amplificação e normalização de áudio para melhorar a qualidade das gravações.
          </p>
        </div>
      </div>
    </div>
  );
}