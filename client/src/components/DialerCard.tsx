import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useCallStore } from '@/stores/useCallStore';
import { api } from '@/services/api';
import { connectCaptions, disconnectCaptions } from '@/services/captions';
import { validateE164, formatPhoneNumber, isDTMFTone } from '@/utils/validation';
import { VoiceConversionControl } from './VoiceConversionControl';

interface VoIPNumber {
  id: number;
  name: string;
  number: string;
  provider: string;
  is_default: boolean;
  status: string;
}

export function DialerCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { 
    phoneNumber, 
    setPhoneNumber, 
    appendToPhoneNumber,
    clearPhoneNumber,
    callState, 
    setCallState, 
    setCurrentCallId,
    currentCallId,
    voiceType,
    setVoiceType,
    selectedProvider 
  } = useCallStore();

  const [selectedVoice, setSelectedVoice] = useState<'masc' | 'fem'>(voiceType as 'masc' | 'fem');
  const [selectedVoIPNumberId, setSelectedVoIPNumberId] = useState<string>('');

  // Fetch VoIP numbers
  const { data: voipNumbers = [], isLoading: isLoadingNumbers } = useQuery<VoIPNumber[]>({
    queryKey: ['/api/voip-numbers'],
  });

  // Auto-select default number when numbers are loaded
  useEffect(() => {
    if (voipNumbers.length > 0 && !selectedVoIPNumberId) {
      const defaultNumber = voipNumbers.find(n => n.is_default);
      if (defaultNumber) {
        setSelectedVoIPNumberId(defaultNumber.id.toString());
      } else {
        setSelectedVoIPNumberId(voipNumbers[0].id.toString());
      }
    }
  }, [voipNumbers, selectedVoIPNumberId]);

  // Listen for favorite number selection
  useEffect(() => {
    const handleSetDialerNumber = (event: any) => {
      const { number } = event.detail;
      setPhoneNumber(number);
    };

    window.addEventListener('setDialerNumber', handleSetDialerNumber);
    return () => window.removeEventListener('setDialerNumber', handleSetDialerNumber);
  }, [setPhoneNumber]);

  // Setup caption service only when needed (during call)
  useEffect(() => {
    if (callState === 'CONNECTED') {
      (window as any).__CALL_ACTIVE__ = true;
      connectCaptions();
    } else {
      (window as any).__CALL_ACTIVE__ = false;
      disconnectCaptions();
    }

    return () => {
      if (callState !== 'CONNECTED') {
        (window as any).__CALL_ACTIVE__ = false;
        disconnectCaptions();
      }
    };
  }, [callState]);

  const startCallMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/call/dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phoneNumber,
          voiceType: selectedVoice,
          voipNumberId: selectedVoIPNumberId ? parseInt(selectedVoIPNumberId) : undefined
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || 'Falha ao iniciar chamada');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentCallId(data.callSid);
      setCallState('RINGING');
      setVoiceType(selectedVoice);
      
      // Connect captions when call starts
      (window as any).__CALL_ACTIVE__ = true;
      connectCaptions();
      
      const selectedNumber = voipNumbers.find(n => n.id.toString() === selectedVoIPNumberId);
      
      toast({
        title: "Chamada iniciada",
        description: `Discando para ${phoneNumber} via ${data.provider || selectedNumber?.provider || 'provedor padrão'}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao iniciar chamada",
        description: error instanceof Error ? error.message : "Falha na discagem",
        variant: "destructive",
      });
    }
  });

  const hangupMutation = useMutation({
    mutationFn: () => api.hangupCall(currentCallId!),
    onSuccess: () => {
      setCallState('ENDED');
      
      // Disconnect captions when call ends
      (window as any).__CALL_ACTIVE__ = false;
      disconnectCaptions();
      
      setTimeout(() => {
        setCallState('IDLE');
        setCurrentCallId(null);
      }, 1000);
      toast({
        title: "Chamada encerrada",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao encerrar chamada",
        description: error instanceof Error ? error.message : "Falha ao encerrar",
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

  const handleDial = () => {
    // Remove caracteres não numéricos
    const cleanNumber = phoneNumber.replace(/[^\d]/g, '');
    
    // Validar: deve ter 10 ou 11 dígitos (DDD + número)
    if (cleanNumber.length < 10 || cleanNumber.length > 11) {
      toast({
        title: "Número inválido",
        description: "Por favor, insira apenas DDD + número (ex: 11999999999)",
        variant: "destructive",
      });
      return;
    }

    setPhoneNumber(cleanNumber);
    startCallMutation.mutate();
  };

  const handleAnswer = () => {
    // For incoming calls - this would be implemented when handling inbound calls
    setCallState('CONNECTED');
    toast({
      title: "Chamada atendida",
    });
  };

  const handleHangup = () => {
    if (currentCallId) {
      hangupMutation.mutate();
    } else {
      setCallState('IDLE');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && callState === 'IDLE') {
      handleDial();
    }
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
  
  // Unified keypad handler - works for both dialing and DTMF
  const handleKeypadPress = (digit: string) => {
    if (callState === 'IDLE') {
      // During dialing - add digit to phone number
      if (digit === '*') {
        appendToPhoneNumber('+');
      } else if (digit === '#') {
        // # doesn't add anything during dialing
        return;
      } else {
        appendToPhoneNumber(digit);
      }
    } else if (callState === 'CONNECTED') {
      // During call - send DTMF tone
      sendDTMF(digit);
    } else {
      toast({
        title: "Teclado indisponível",
        description: "Use o teclado apenas durante discagem ou chamada conectada",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-card rounded-xl p-6 border border-border">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Discagem</h3>
      
      {/* VoIP Number Selection */}
      <div className="mb-4">
        <Label htmlFor="voip-select" className="block text-sm text-muted-foreground mb-2">
          <i className="fas fa-phone-alt mr-1"></i> Meu Número
        </Label>
        {isLoadingNumbers ? (
          <div className="w-full bg-background border border-border rounded-lg px-4 py-3 text-muted-foreground">
            Carregando números...
          </div>
        ) : voipNumbers.length === 0 ? (
          <div className="w-full bg-background border border-border rounded-lg px-4 py-3 text-destructive">
            Nenhum número cadastrado. Configure em "Meus Números".
          </div>
        ) : (
          <Select value={selectedVoIPNumberId} onValueChange={setSelectedVoIPNumberId}>
            <SelectTrigger 
              id="voip-select"
              className="w-full bg-background border border-border"
              data-testid="voip-number-select"
            >
              <SelectValue placeholder="Selecione um número" />
            </SelectTrigger>
            <SelectContent>
              {voipNumbers.map((voipNum) => (
                <SelectItem 
                  key={voipNum.id} 
                  value={voipNum.id.toString()}
                  data-testid={`voip-option-${voipNum.id}`}
                >
                  {voipNum.name} ({voipNum.number}) - {voipNum.provider}
                  {voipNum.is_default && ' ⭐'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      
      {/* Number Input */}
      <div className="mb-4">
        <Label htmlFor="phone-input" className="block text-sm text-muted-foreground mb-2">
          Número de Destino (DDD + Número)
        </Label>
        <Input
          id="phone-input"
          type="text"
          placeholder="11999999999"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-background border border-border rounded-lg px-4 py-3 focus:border-abmix-green focus:outline-none transition-colors font-mono"
          data-testid="phone-input"
        />
      </div>

      {/* Voice Selection */}
      <div className="mb-4">
        <Label className="block text-sm text-muted-foreground mb-2">Tipo de Voz</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => {
              setSelectedVoice('masc');
              toast({ title: "Voz selecionada", description: "Voz masculina ativada" });
            }}
            className={`py-2 px-3 rounded-lg transition-colors flex flex-col items-center justify-center text-xs gap-1 ${
              selectedVoice === 'masc' 
                ? 'bg-abmix-green text-black' 
                : 'bg-background border border-border text-foreground hover:bg-muted'
            }`}
            data-testid="male-voice-button"
          >
            <i className="fas fa-male text-sm"></i>
            Masculina
          </Button>
          
          <Button
            onClick={() => {
              setSelectedVoice('fem');
              toast({ title: "Voz selecionada", description: "Voz feminina ativada" });
            }}
            className={`py-2 px-3 rounded-lg transition-colors flex flex-col items-center justify-center text-xs gap-1 ${
              selectedVoice === 'fem' 
                ? 'bg-abmix-green text-black' 
                : 'bg-background border border-border text-foreground hover:bg-muted'
            }`}
            data-testid="female-voice-button"
          >
            <i className="fas fa-female text-sm"></i>
            Feminina
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          onClick={handleDial}
          disabled={callState !== 'IDLE' || startCallMutation.isPending || voipNumbers.length === 0}
          className="bg-abmix-green text-black font-medium py-2 px-2 rounded-lg hover:bg-abmix-green/90 transition-colors flex flex-col items-center justify-center text-xs gap-1 disabled:opacity-50"
          data-testid="dial-button"
        >
          <i className="fas fa-phone text-sm"></i>
          {startCallMutation.isPending ? 'Discando' : 'Discar'}
        </Button>
        
        <Button
          onClick={handleAnswer}
          disabled={callState !== 'RINGING'}
          className="bg-abmix-green text-black font-medium py-2 px-2 rounded-lg hover:bg-abmix-green/90 transition-colors flex flex-col items-center justify-center disabled:opacity-50 text-xs gap-1"
          data-testid="answer-button"
        >
          <i className="fas fa-phone text-sm"></i>
          Atender
        </Button>
        
        <Button
          onClick={handleHangup}
          disabled={callState === 'IDLE' || hangupMutation.isPending}
          className="bg-abmix-green text-black font-medium py-2 px-2 rounded-lg hover:bg-abmix-green/90 transition-colors flex flex-col items-center justify-center disabled:opacity-50 text-xs gap-1"
          data-testid="hangup-button"
        >
          <i className="fas fa-phone-slash text-sm"></i>
          {hangupMutation.isPending ? 'Encerrando' : 'Encerrar'}
        </Button>
      </div>

      {/* Unified Keypad - Works for both dialing and DTMF */}
      <div className="mt-6 pt-4 border-t border-border">
        <Label className="block text-sm text-muted-foreground mb-3">
          {callState === 'IDLE' ? 'Teclado Numérico - Discagem' : 'Teclado DTMF - Durante Chamada'}
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {dtmfTones.map((tone) => (
            <Button
              key={tone}
              onClick={() => handleKeypadPress(tone)}
              disabled={dtmfMutation.isPending}
              className={`py-3 rounded text-lg font-mono transition-colors ${
                callState === 'IDLE' 
                  ? 'bg-abmix-green text-black border border-abmix-green hover:bg-abmix-green/90' 
                  : callState === 'CONNECTED' 
                    ? 'bg-abmix-green text-black border border-abmix-green hover:bg-abmix-green/90' 
                    : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
              }`}
              data-testid={`keypad-${tone}`}
            >
              {tone}
            </Button>
          ))}
        </div>
        
        {/* Clear and Backspace buttons for dialing */}
        {callState === 'IDLE' && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button
              onClick={() => setPhoneNumber(phoneNumber.slice(0, -1))}
              disabled={phoneNumber.length === 0}
              className="bg-muted text-foreground hover:bg-muted/80 py-2 text-sm"
              data-testid="backspace-button"
            >
              ⌫ Apagar
            </Button>
            <Button
              onClick={() => setPhoneNumber('')}
              disabled={phoneNumber.length === 0}
              className="bg-muted text-foreground hover:bg-muted/80 py-2 text-sm"
              data-testid="clear-button"
            >
              🗑️ Limpar
            </Button>
          </div>
        )}
      </div>

      {/* Voice Conversion Control */}
      <div className="mt-6 pt-4 border-t border-border">
        <VoiceConversionControl 
          callSid={currentCallId || undefined}
          isInCall={callState === 'CONNECTED'}
          onVoiceConversionToggle={(enabled) => {
            toast({
              title: enabled ? "Conversão Ativada" : "Conversão Desativada",
              description: enabled 
                ? "Sua voz será modificada em tempo real" 
                : "Voltando à voz original",
            });
          }}
        />
      </div>
    </div>
  );
}
