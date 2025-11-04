import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useCallStore } from '@/stores/useCallStore';

export function CallManager() {
  const { toast } = useToast();
  const { currentCallId, callState } = useCallStore();
  const [searchCallId, setSearchCallId] = useState('');

  // Mock data for call management - will be replaced with actual API calls
  const callHistory = [
    {
      id: 'CA123456789',
      to: '+5511999999999',
      status: 'completed',
      duration: '2m 35s',
      startTime: '2025-08-15 10:30:00'
    },
    {
      id: 'CA987654321',
      to: '+5511888888888',
      status: 'busy',
      duration: '0s',
      startTime: '2025-08-15 10:25:00'
    }
  ];

  const handleSearchCall = () => {
    if (!searchCallId.trim()) {
      toast({
        title: "Campo vazio",
        description: "Digite um Call SID para pesquisar",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Pesquisando chamada",
      description: `Buscando informações para: ${searchCallId}`,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'busy': return 'text-yellow-400';
      case 'failed': return 'text-red-400';
      case 'in-progress': return 'text-abmix-green';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluída';
      case 'busy': return 'Ocupado';
      case 'failed': return 'Falhou';
      case 'in-progress': return 'Em andamento';
      default: return status;
    }
  };

  return (
    <div className="bg-dark-surface rounded-xl p-6 border border-dark-border">
      <h3 className="text-lg font-semibold mb-4">Controle de Chamadas</h3>
      
      <div className="space-y-6">
        {/* Current Call Status */}
        {currentCallId && (
          <div className="p-4 bg-dark-bg rounded-lg border border-dark-border">
            <h4 className="text-sm font-medium text-foreground mb-2">Chamada Ativa</h4>
            <div className="space-y-2">
              <p className="text-sm text-gray-400">
                <span className="font-medium">Call SID:</span> {currentCallId}
              </p>
              <p className="text-sm text-gray-400">
                <span className="font-medium">Status:</span> 
                <span className={`ml-1 ${getStatusColor(callState.toLowerCase())}`}>
                  {getStatusText(callState.toLowerCase())}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Call Search */}
        <div className="space-y-3">
          <Label htmlFor="call-search" className="text-sm font-medium text-foreground">
            Consultar Chamada
          </Label>
          <div className="flex space-x-2">
            <Input
              id="call-search"
              type="text"
              placeholder="Digite o Call SID (ex: CA1234567890abcdef)"
              value={searchCallId}
              onChange={(e) => setSearchCallId(e.target.value)}
              className="flex-1"
              data-testid="call-search-input"
            />
            <Button
              onClick={handleSearchCall}
              className="bg-abmix-green text-black hover:bg-abmix-green/80"
              data-testid="search-call-button"
            >
              Buscar
            </Button>
          </div>
        </div>

        {/* Recent Calls */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Chamadas Recentes</h4>
          <div className="space-y-2">
            {callHistory.map((call) => (
              <div key={call.id} className="p-3 bg-dark-bg rounded-lg border border-dark-border">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{call.to}</p>
                    <p className="text-xs text-gray-400">
                      {call.id} • {call.startTime}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm ${getStatusColor(call.status)}`}>
                      {getStatusText(call.status)}
                    </p>
                    <p className="text-xs text-gray-400">{call.duration}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 p-3 bg-dark-bg rounded-lg border border-dark-border">
          <p className="text-xs text-gray-400">
            <strong>Funcionalidade:</strong> Consulte e controle chamadas via API Twilio.
            Visualize histórico, status em tempo real e detalhes de cada chamada.
          </p>
        </div>
      </div>
    </div>
  );
}