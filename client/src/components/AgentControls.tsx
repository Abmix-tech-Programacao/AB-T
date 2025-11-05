import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useCallStore } from '@/stores/useCallStore';
import { api } from '@/services/api';

export function AgentControls() {
  const { toast } = useToast();
  const { aiActive, setAiActive, currentCallId } = useCallStore();

  const pauseAIMutation = useMutation({
    mutationFn: () => fetch('/api/agent/disable', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callSid: currentCallId })
    }).then(res => res.json()),
    onSuccess: () => {
      setAiActive(false);
      toast({
        title: "IA pausada",
        description: "Controle assumido pelo humano",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao pausar IA",
        description: error instanceof Error ? error.message : "Falha na operação",
        variant: "destructive",
      });
    }
  });

  const resumeAIMutation = useMutation({
    mutationFn: () => fetch('/api/agent/enable', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callSid: currentCallId })
    }).then(res => res.json()),
    onSuccess: () => {
      setAiActive(true);
      toast({
        title: "IA retomada",
        description: "IA assumiu o controle da chamada",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao retomar IA",
        description: error instanceof Error ? error.message : "Falha na operação",
        variant: "destructive",
      });
    }
  });

  const handleAIToggle = (checked: boolean) => {
    if (!currentCallId) {
      toast({
        title: "Nenhuma chamada ativa",
        description: "Inicie uma chamada para controlar a IA",
        variant: "destructive",
      });
      return;
    }

    if (checked) {
      resumeAIMutation.mutate();
    } else {
      pauseAIMutation.mutate();
    }
  };

  const handleTakeControl = () => {
    if (!currentCallId) {
      toast({
        title: "Nenhuma chamada ativa",
        variant: "destructive",
      });
      return;
    }
    pauseAIMutation.mutate();
  };

  const handleResumeAI = () => {
    if (!currentCallId) {
      toast({
        title: "Nenhuma chamada ativa",
        variant: "destructive",
      });
      return;
    }
    resumeAIMutation.mutate();
  };

  const pauseSpeechMutation = useMutation({
    mutationFn: () => fetch('/api/agent/pause-speech', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callSid: currentCallId })
    }).then(res => res.json()),
    onSuccess: () => {
      toast({
        title: "Fala pausada",
        description: "TTS pausado temporariamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao pausar fala",
        description: error instanceof Error ? error.message : "Falha na operação",
        variant: "destructive",
      });
    }
  });

  const resumeSpeechMutation = useMutation({
    mutationFn: () => fetch('/api/agent/resume-speech', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callSid: currentCallId })
    }).then(res => res.json()),
    onSuccess: () => {
      toast({
        title: "Fala retomada",
        description: "TTS retomado",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao retomar fala",
        description: error instanceof Error ? error.message : "Falha na operação",
        variant: "destructive",
      });
    }
  });

  const handlePauseSpeech = () => {
    if (!currentCallId) {
      toast({
        title: "Nenhuma chamada ativa",
        variant: "destructive",
      });
      return;
    }
    pauseSpeechMutation.mutate();
  };

  const handleResumeSpeech = () => {
    if (!currentCallId) {
      toast({
        title: "Nenhuma chamada ativa",
        variant: "destructive",
      });
      return;
    }
    resumeSpeechMutation.mutate();
  };

  return (
    <div className="bg-dark-surface rounded-xl p-6 border border-dark-border h-fit">
      <h3 className="text-lg font-semibold mb-4">Controle de IA</h3>
      
      <div className="space-y-4">
        {/* AI Toggle */}
        <div className="flex items-center justify-between">
          <span className="font-medium">IA Ativa</span>
          <div className="flex items-center space-x-2">
            <Switch
              checked={aiActive}
              onCheckedChange={handleAIToggle}
              disabled={!currentCallId}
              data-testid="ai-toggle"
            />
          </div>
        </div>

        {/* Control Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleTakeControl}
            disabled={!currentCallId || pauseAIMutation.isPending}
            className="bg-abmix-green text-black py-2 px-2 rounded-lg hover:bg-abmix-green/90 transition-colors text-xs font-medium disabled:opacity-50 flex flex-col items-center justify-center gap-1"
            data-testid="take-control-button"
          >
            <i className="fas fa-user text-sm"></i>
            Assumir
          </Button>
          
          <Button
            onClick={handleResumeAI}
            disabled={!currentCallId || resumeAIMutation.isPending}
            className="bg-abmix-green text-black py-2 px-2 rounded-lg hover:bg-abmix-green/90 transition-colors text-xs font-medium disabled:opacity-50 flex flex-col items-center justify-center gap-1"
            data-testid="resume-ai-button"
          >
            <i className="fas fa-robot text-sm"></i>
            Retomar IA
          </Button>
          
          <Button
            onClick={handlePauseSpeech}
            disabled={!currentCallId || pauseSpeechMutation.isPending}
            className="bg-abmix-green text-black py-2 px-2 rounded-lg hover:bg-abmix-green/90 transition-colors text-xs font-medium disabled:opacity-50 flex flex-col items-center justify-center gap-1"
            data-testid="pause-speech-button"
          >
            <i className="fas fa-pause text-sm"></i>
            {pauseSpeechMutation.isPending ? 'Pausando...' : 'Pausar'}
          </Button>
          
          <Button
            onClick={handleResumeSpeech}
            disabled={!currentCallId || resumeSpeechMutation.isPending}
            className="bg-abmix-green text-black py-2 px-2 rounded-lg hover:bg-abmix-green/90 transition-colors text-xs font-medium disabled:opacity-50 flex flex-col items-center justify-center gap-1"
            data-testid="resume-speech-button"
          >
            <i className="fas fa-play text-sm"></i>
            {resumeSpeechMutation.isPending ? 'Retomando...' : 'Retomar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
