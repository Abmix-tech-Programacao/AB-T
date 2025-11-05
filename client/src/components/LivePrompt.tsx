import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCallStore } from '@/stores/useCallStore';
import { api } from '@/services/api';

export function LivePrompt() {
  const { toast } = useToast();
  const { livePrompt, setLivePrompt, currentCallId } = useCallStore();

  const applyPromptMutation = useMutation({
    mutationFn: () => api.injectPrompt(currentCallId!, livePrompt),
    onSuccess: () => {
      toast({
        title: "Prompt aplicado",
        description: "Instruções enviadas para a IA",
      });
      setLivePrompt('');
    },
    onError: (error) => {
      toast({
        title: "Erro ao aplicar prompt",
        description: error instanceof Error ? error.message : "Falha na operação",
        variant: "destructive",
      });
    }
  });

  const handleApplyPrompt = () => {
    if (!currentCallId) {
      toast({
        title: "Nenhuma chamada ativa",
        description: "Inicie uma chamada para aplicar prompts",
        variant: "destructive",
      });
      return;
    }

    if (!livePrompt.trim()) {
      toast({
        title: "Prompt vazio",
        description: "Digite instruções para aplicar",
        variant: "destructive",
      });
      return;
    }

    applyPromptMutation.mutate();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleApplyPrompt();
    }
  };

  return (
    <div className="bg-dark-surface rounded-xl p-6 border border-dark-border flex flex-col h-full">
      <h3 className="text-lg font-semibold mb-4">Prompt Ao Vivo</h3>
      
      <div className="flex flex-col flex-1 space-y-4">
        <div className="flex-1">
          <Label htmlFor="live-prompt" className="sr-only">Prompt ao vivo</Label>
          <Textarea
            id="live-prompt"
            placeholder="Digite instruções para a IA (ex: Mude o tom para mais formal, mencione a promoção especial...)"
            value={livePrompt}
            onChange={(e) => setLivePrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 resize-none focus:border-abmix-green focus:outline-none transition-colors min-h-[120px]"
            data-testid="live-prompt-textarea"
          />
        </div>
        
        <div className="space-y-3">
          <Button
            onClick={handleApplyPrompt}
            disabled={!currentCallId || !livePrompt.trim() || applyPromptMutation.isPending}
            className="w-full bg-abmix-green text-black font-semibold py-3 rounded-lg hover:bg-abmix-green/90 transition-colors"
            data-testid="apply-prompt-button"
          >
            <i className="fas fa-magic mr-2"></i>
            {applyPromptMutation.isPending ? 'Aplicando...' : 'Aplicar Prompt'}
          </Button>
          
          <p className="text-xs text-gray-500 text-center">
            Dica: Use Ctrl+Enter para aplicar rapidamente
          </p>
        </div>
      </div>
    </div>
  );
}
