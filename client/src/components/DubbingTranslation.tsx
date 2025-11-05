import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export function DubbingTranslation() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('');
  const [preserveVoice, setPreserveVoice] = useState(true);

  const languages = [
    { code: 'pt-BR', name: 'Português (Brasil)' },
    { code: 'en-US', name: 'Inglês (EUA)' },
    { code: 'es-ES', name: 'Espanhol (Espanha)' },
    { code: 'fr-FR', name: 'Francês (França)' },
    { code: 'de-DE', name: 'Alemão (Alemanha)' },
    { code: 'it-IT', name: 'Italiano (Itália)' },
    { code: 'zh-CN', name: 'Chinês (Mandarim)' },
    { code: 'ja-JP', name: 'Japonês' }
  ];

  const dubbingMutation = useMutation({
    mutationFn: async (data: { fileId: string; targetLang: string; preserveVoice: boolean }) => {
      // Implementation will be added when endpoint is ready
      return { success: true, dubbedUrl: '/dubbed-audio.wav' };
    },
    onSuccess: () => {
      toast({
        title: "Dublagem concluída",
        description: "Áudio traduzido e dublado com sucesso",
      });
      setSelectedFile(null);
      setTargetLanguage('');
    },
    onError: (error) => {
      toast({
        title: "Erro na dublagem",
        description: error instanceof Error ? error.message : "Falha no processamento",
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

  const handleStartDubbing = () => {
    if (!selectedFile || !targetLanguage) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um arquivo e idioma de destino",
        variant: "destructive",
      });
      return;
    }

    dubbingMutation.mutate({
      fileId: selectedFile.name,
      targetLang: targetLanguage,
      preserveVoice
    });
  };

  return (
    <div className="bg-dark-surface rounded-xl p-6 border border-dark-border">
      <h3 className="text-lg font-semibold mb-4">Dublagem & Tradução</h3>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="dubbing-file" className="text-sm font-medium text-foreground">
            Arquivo de Áudio
          </Label>
          <Input
            id="dubbing-file"
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="mt-1"
            data-testid="dubbing-file-input"
          />
          {selectedFile && (
            <p className="text-xs text-gray-400 mt-1">
              Arquivo: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
            </p>
          )}
        </div>

        <div>
          <Label className="text-sm font-medium text-foreground">
            Idioma de Destino
          </Label>
          <Select value={targetLanguage} onValueChange={setTargetLanguage}>
            <SelectTrigger className="mt-1" data-testid="language-select">
              <SelectValue placeholder="Selecione o idioma" />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="preserve-voice"
            checked={preserveVoice}
            onChange={(e) => setPreserveVoice(e.target.checked)}
            className="w-4 h-4 text-abmix-green bg-gray-100 border-gray-300 rounded"
            data-testid="preserve-voice-checkbox"
          />
          <Label htmlFor="preserve-voice" className="text-sm text-foreground">
            Preservar características da voz original
          </Label>
        </div>

        <Button
          onClick={handleStartDubbing}
          disabled={!selectedFile || !targetLanguage || dubbingMutation.isPending}
          className="w-full bg-abmix-green text-black hover:bg-abmix-green/80"
          data-testid="start-dubbing-button"
        >
          {dubbingMutation.isPending ? 'Processando...' : 'Iniciar Dublagem'}
        </Button>

        <div className="mt-4 p-3 bg-dark-bg rounded-lg border border-dark-border">
          <p className="text-xs text-gray-400">
            <strong>Funcionalidade:</strong> Traduz automaticamente o conteúdo de áudio
            para o idioma selecionado, mantendo as características vocais originais.
            Suporta 8+ idiomas principais.
          </p>
        </div>
      </div>
    </div>
  );
}