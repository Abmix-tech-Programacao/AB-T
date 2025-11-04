import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';

export function VoiceCloning() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetVoiceId, setTargetVoiceId] = useState('');

  const cloneVoiceMutation = useMutation({
    mutationFn: async (data: { file: File; targetVoiceId: string }) => {
      // Implementation will be added when endpoint is ready
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Clonagem iniciada",
        description: "Processando conversão de voz...",
      });
      setSelectedFile(null);
      setTargetVoiceId('');
    },
    onError: (error) => {
      toast({
        title: "Erro na clonagem",
        description: error instanceof Error ? error.message : "Falha na operação",
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

  const handleClone = () => {
    if (!selectedFile || !targetVoiceId) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um arquivo e uma voz de destino",
        variant: "destructive",
      });
      return;
    }

    cloneVoiceMutation.mutate({ file: selectedFile, targetVoiceId });
  };

  return (
    <div className="bg-dark-surface rounded-xl p-6 border border-dark-border">
      <h3 className="text-lg font-semibold mb-4">Clonagem & Conversão de Voz</h3>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="voice-file" className="text-sm font-medium text-foreground">
            Arquivo de Áudio
          </Label>
          <Input
            id="voice-file"
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="mt-1"
            data-testid="voice-file-input"
          />
          {selectedFile && (
            <p className="text-xs text-gray-400 mt-1">
              Arquivo: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="target-voice" className="text-sm font-medium text-foreground">
            ID da Voz de Destino
          </Label>
          <Input
            id="target-voice"
            type="text"
            placeholder="Ex: 21m00Tcm4TlvDq8ikWAM"
            value={targetVoiceId}
            onChange={(e) => setTargetVoiceId(e.target.value)}
            className="mt-1"
            data-testid="target-voice-input"
          />
        </div>

        <Button
          onClick={handleClone}
          disabled={!selectedFile || !targetVoiceId || cloneVoiceMutation.isPending}
          className="w-full bg-abmix-green text-black hover:bg-abmix-green/80"
          data-testid="clone-voice-button"
        >
          {cloneVoiceMutation.isPending ? 'Processando...' : 'Iniciar Clonagem'}
        </Button>

        <div className="mt-4 p-3 bg-dark-bg rounded-lg border border-dark-border">
          <p className="text-xs text-gray-400">
            <strong>Funcionalidade:</strong> Clone e converta vozes usando IA avançada.
            Faça upload de um arquivo de áudio e selecione uma voz de destino para conversão.
          </p>
        </div>
      </div>
    </div>
  );
}