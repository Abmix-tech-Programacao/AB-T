import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCallStore } from '@/stores/useCallStore';
import { api } from '@/services/api';

export function DTMFKeypad() {
  const { toast } = useToast();
  const { currentCallId, callState } = useCallStore();

  const sendDTMFMutation = useMutation({
    mutationFn: (digits: string) => api.sendDTMF(currentCallId!, digits),
    onSuccess: (data, digits) => {
      toast({
        title: "DTMF enviado",
        description: `Tom "${digits}" transmitido`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao enviar DTMF",
        description: error instanceof Error ? error.message : "Falha na transmissão",
        variant: "destructive",
      });
    }
  });

  const handleKeyPress = (digit: string) => {
    if (!currentCallId) {
      toast({
        title: "Nenhuma chamada ativa",
        description: "Inicie uma chamada para usar o teclado",
        variant: "destructive",
      });
      return;
    }

    if (callState !== 'CONNECTED') {
      toast({
        title: "Chamada não conectada",
        description: "Aguarde a conexão para usar o teclado",
        variant: "destructive",
      });
      return;
    }

    sendDTMFMutation.mutate(digit);
  };

  const keypadLayout = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#']
  ];

  const isDisabled = !currentCallId || callState !== 'CONNECTED' || sendDTMFMutation.isPending;

  return (
    <div className="bg-dark-surface rounded-xl p-6 border border-dark-border">
      <h3 className="text-lg font-semibold mb-4">Teclado DTMF</h3>
      
      <div className="grid grid-cols-3 gap-3">
        {keypadLayout.flat().map((digit) => (
          <Button
            key={digit}
            variant="outline"
            onClick={() => handleKeyPress(digit)}
            disabled={isDisabled}
            className="h-12 text-lg font-semibold bg-dark-bg hover:bg-abmix-green hover:text-black border-dark-border disabled:opacity-50"
            data-testid={`dtmf-${digit}`}
          >
            {digit}
          </Button>
        ))}
      </div>
      
      {isDisabled && (
        <p className="text-sm text-gray-400 mt-3 text-center">
          {!currentCallId ? 'Inicie uma chamada para usar o teclado' : 
           callState !== 'CONNECTED' ? 'Aguarde a conexão' : 
           'Enviando...'}
        </p>
      )}
    </div>
  );
}