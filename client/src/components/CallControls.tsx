import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useCallStore } from '@/stores/useCallStore';
import { api } from '@/services/api';
import { validateE164, isDTMFTone } from '@/utils/validation';

export function CallControls() {
  const { toast } = useToast();
  const { currentCallId } = useCallStore();
  const [transferTarget, setTransferTarget] = useState('');
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);

  const transferMutation = useMutation({
    mutationFn: (target: string) => api.transferCall(currentCallId!, target),
    onSuccess: () => {
      toast({
        title: "Transferência iniciada",
        description: `Transferindo para ${transferTarget}`,
      });
      setIsTransferDialogOpen(false);
      setTransferTarget('');
    },
    onError: (error) => {
      toast({
        title: "Erro na transferência",
        description: error instanceof Error ? error.message : "Falha na transferência",
        variant: "destructive",
      });
    }
  });

  const holdMutation = useMutation({
    mutationFn: () => api.holdCall(currentCallId!),
    onSuccess: () => {
      toast({
        title: "Chamada em espera",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao colocar em espera",
        description: error instanceof Error ? error.message : "Falha na operação",
        variant: "destructive",
      });
    }
  });

  const dtmfMutation = useMutation({
    mutationFn: (tone: string) => api.sendDTMF(currentCallId!, tone),
    onSuccess: (_, tone) => {
      toast({
        title: `DTMF enviado: ${tone}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar DTMF",
        description: error instanceof Error ? error.message : "Falha no envio",
        variant: "destructive",
      });
    }
  });

  const handleTransfer = () => {
    if (!validateE164(transferTarget)) {
      toast({
        title: "Número inválido",
        description: "Por favor, insira um número no formato E.164",
        variant: "destructive",
      });
      return;
    }
    transferMutation.mutate(transferTarget);
  };

  const handleHold = () => {
    if (!currentCallId) {
      toast({
        title: "Nenhuma chamada ativa",
        variant: "destructive",
      });
      return;
    }
    holdMutation.mutate();
  };

  const sendDTMF = (tone: string) => {
    if (!currentCallId) {
      toast({
        title: "Nenhuma chamada ativa",
        variant: "destructive",
      });
      return;
    }

    if (!isDTMFTone(tone)) {
      toast({
        title: "Tom DTMF inválido",
        variant: "destructive",
      });
      return;
    }

    dtmfMutation.mutate(tone);
  };

  const dtmfTones = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

  return (
    <div className="bg-dark-surface rounded-xl p-6 border border-dark-border">
      <h3 className="text-lg font-semibold mb-4">Controles Avançados</h3>
      
      <div className="space-y-4">
        {/* Transfer & Hold */}
        <div className="grid grid-cols-2 gap-2">
          <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
            <DialogTrigger asChild>
              <Button
                disabled={!currentCallId}
                className="bg-abmix-green text-black py-2 px-2 rounded-lg hover:bg-abmix-green/90 transition-colors text-xs font-medium disabled:opacity-50 flex flex-col items-center justify-center gap-1"
                data-testid="transfer-button"
              >
                <i className="fas fa-exchange-alt text-sm"></i>
                Transferir
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-dark-surface border-dark-border text-white">
              <DialogHeader>
                <DialogTitle>Transferir Chamada</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="transfer-target">Número de destino</Label>
                  <Input
                    id="transfer-target"
                    placeholder="+5511999999999"
                    value={transferTarget}
                    onChange={(e) => setTransferTarget(e.target.value)}
                    className="bg-dark-bg border-dark-border"
                    data-testid="transfer-input"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsTransferDialogOpen(false)}
                    className="border-dark-border text-white"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleTransfer}
                    disabled={transferMutation.isPending}
                    className="bg-abmix-green text-black hover:bg-abmix-green/90"
                    data-testid="confirm-transfer-button"
                  >
                    {transferMutation.isPending ? 'Transferindo...' : 'Transferir'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            onClick={handleHold}
            disabled={!currentCallId || holdMutation.isPending}
            className="bg-abmix-green text-black py-2 px-2 rounded-lg hover:bg-abmix-green/90 transition-colors text-xs font-medium disabled:opacity-50 flex flex-col items-center justify-center gap-1"
            data-testid="hold-button"
          >
            <i className="fas fa-pause-circle text-sm"></i>
            Hold
          </Button>
        </div>

        {/* DTMF Pad */}
        <div>
          <Label className="block text-sm text-gray-400 mb-2">DTMF</Label>
          <div className="grid grid-cols-3 gap-2">
            {dtmfTones.map((tone) => (
              <Button
                key={tone}
                onClick={() => sendDTMF(tone)}
                disabled={!currentCallId || dtmfMutation.isPending}
                className="bg-abmix-green text-black border border-abmix-green hover:bg-abmix-green/90 transition-colors py-2 rounded text-sm font-mono disabled:opacity-50"
                data-testid={`dtmf-${tone}`}
              >
                {tone}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
