import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Mic, MicOff, Volume2, VolumeX, Settings } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface VoiceConversionControlProps {
  callSid?: string;
  isInCall: boolean;
  onVoiceConversionToggle?: (enabled: boolean) => void;
}

export function VoiceConversionControl({ 
  callSid, 
  isInCall, 
  onVoiceConversionToggle 
}: VoiceConversionControlProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [conversionStats, setConversionStats] = useState<any>(null);
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const { toast } = useToast();

  // Fetch available voices for conversion
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const response = await fetch('/api/voice/conversion-voices');
        if (response.ok) {
          const voices = await response.json();
          setAvailableVoices(voices);
        }
      } catch (error) {
        console.error('Error fetching conversion voices:', error);
      }
    };

    fetchVoices();
  }, []);

  // Fetch conversion status when call is active
  useEffect(() => {
    if (callSid && isInCall) {
      const fetchStatus = async () => {
        try {
          const response = await fetch(`/api/voice/status/${callSid}`);
          if (response.ok) {
            const status = await response.json();
            setIsEnabled(status.enabled);
            setConversionStats(status.stats);
          }
        } catch (error) {
          console.error('Error fetching voice conversion status:', error);
        }
      };

      fetchStatus();
      
      // Poll status every 5 seconds during call
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [callSid, isInCall]);

  const handleToggleConversion = async () => {
    if (!callSid) {
      toast({
        title: "Erro",
        description: "Nenhuma chamada ativa encontrada",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/voice/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callSid,
          enabled: !isEnabled
        })
      });

      if (response.ok) {
        const result = await response.json();
        setIsEnabled(result.enabled);
        
        toast({
          title: result.enabled ? "Conversão de Voz Ativada" : "Conversão de Voz Desativada",
          description: result.enabled 
            ? "Sua voz será modificada durante a chamada" 
            : "Sua voz original será transmitida",
        });

        onVoiceConversionToggle?.(result.enabled);
      } else {
        throw new Error('Failed to toggle voice conversion');
      }
    } catch (error) {
      console.error('Error toggling voice conversion:', error);
      toast({
        title: "Erro",
        description: "Falha ao alterar conversão de voz",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full bg-dark-surface border-dark-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Settings className="h-4 w-4 text-abmix-green" />
            <CardTitle className="text-sm text-foreground">Conversão de Voz</CardTitle>
          </div>
          <Badge variant={isEnabled ? "default" : "secondary"} className={isEnabled ? "bg-abmix-green text-black" : ""}>
            {isEnabled ? "Ativo" : "Inativo"}
          </Badge>
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          Modifique sua voz em tempo real durante a chamada
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status da chamada */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isInCall ? (
              <>
                <Mic className="h-4 w-4 text-abmix-green" />
                <span className="text-sm text-abmix-green">Em chamada</span>
              </>
            ) : (
              <>
                <MicOff className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Sem chamada ativa</span>
              </>
            )}
          </div>
          
          {isInCall && callSid && (
            <div className="text-xs text-muted-foreground">
              ID: {callSid.substring(0, 8)}...
            </div>
          )}
        </div>

        {/* Controle de conversão */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isEnabled ? (
              <Volume2 className="h-4 w-4 text-abmix-green" />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm text-foreground">
              {isEnabled ? "Voz Modificada" : "Voz Original"}
            </span>
          </div>
          
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggleConversion}
            disabled={!isInCall || isLoading}
          />
        </div>

        {/* Estatísticas de conversão */}
        {conversionStats && isEnabled && (
          <div className="bg-dark-bg p-3 rounded-lg space-y-2 border border-dark-border">
            <div className="text-xs font-medium text-foreground">
              Estatísticas de Conversão
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Sessões Ativas:</span>
                <span className="ml-1 font-medium text-foreground">{conversionStats.activeSessions}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Latência Média:</span>
                <span className="ml-1 font-medium text-foreground">{conversionStats.averageLatency}ms</span>
              </div>
            </div>
          </div>
        )}

        {/* Instruções */}
        {!isInCall && (
          <div className="text-xs text-muted-foreground bg-dark-bg p-2 rounded border border-dark-border">
            💡 <strong className="text-foreground">Como usar:</strong> Inicie uma chamada para ativar a conversão de voz em tempo real
          </div>
        )}

        {isInCall && !isEnabled && (
          <div className="text-xs text-muted-foreground bg-dark-bg p-2 rounded border border-dark-border">
            🎤 <strong className="text-foreground">Dica:</strong> Ative a conversão para que o destinatário ouça sua voz modificada
          </div>
        )}

        {isInCall && isEnabled && (
          <div className="text-xs text-foreground bg-abmix-green/10 p-2 rounded border border-abmix-green/30">
            ✅ <strong className="text-abmix-green">Ativo:</strong> Sua voz está sendo modificada em tempo real
          </div>
        )}
      </CardContent>
    </Card>
  );
}


