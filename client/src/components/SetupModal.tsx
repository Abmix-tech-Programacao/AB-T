import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface SetupModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function SetupModal({ isOpen, onComplete }: SetupModalProps) {
  const [step, setStep] = useState(1);
  const [isValidating, setIsValidating] = useState(false);
  const [formData, setFormData] = useState({
    ELEVENLABS_API_KEY: '',
    TWILIO_ACCOUNT_SID: '',
    TWILIO_AUTH_TOKEN: '',
    TWILIO_NUMBER: ''
  });

  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateKeys = async () => {
    setIsValidating(true);

    try {
      const response = await apiRequest('POST', '/api/setup/keys', formData);
      const result = await response.json();

      if (result.success) {
        localStorage.setItem('abmix_setup_complete', 'true');
        toast({
          title: "Configuração Concluída",
          description: "Todas as chaves foram validadas com sucesso!",
        });
        onComplete();
      } else {
        toast({
          title: "Erro na Validação",
          description: result.message || "Falha na validação das chaves",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro de Conexão",
        description: "Erro ao validar as chaves da API",
        variant: "destructive"
      });
    } finally {
      setIsValidating(false);
    }
  };

  const isFormValid = Object.values(formData).every(value => value.trim() !== '');

  return (
    <Dialog open={isOpen} onOpenChange={() => {}} modal>
      <DialogContent className="max-w-2xl" data-testid="setup-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="w-8 h-8 bg-[#10B981] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            Configuração Inicial - Abmix
          </DialogTitle>
          <DialogDescription>
            Configure suas chaves de API para ativar todas as funcionalidades do sistema de discagem inteligente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step >= 1 ? 'bg-[#10B981] text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > 1 ? <CheckCircle className="w-4 h-4" /> : '1'}
            </div>
            <div className={`h-px w-12 ${step > 1 ? 'bg-[#10B981]' : 'bg-gray-200'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step >= 2 ? 'bg-[#10B981] text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > 2 ? <CheckCircle className="w-4 h-4" /> : '2'}
            </div>
          </div>

          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-[#10B981]" />
                  Chaves de API Necessárias
                </CardTitle>
                <CardDescription>
                  Para utilizar o Abmix, você precisa das seguintes chaves de API:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="elevenlabs" className="text-sm font-medium">
                      ElevenLabs API Key
                    </Label>
                    <Input
                      id="elevenlabs"
                      type="text"
                      placeholder="Cole sua chave ElevenLabs aqui..."
                      value={formData.ELEVENLABS_API_KEY}
                      onChange={(e) => handleInputChange('ELEVENLABS_API_KEY', e.target.value)}
                      data-testid="input-elevenlabs-key"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Necessária para síntese de voz e transcrição em tempo real
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="twilio-sid" className="text-sm font-medium">
                      Twilio Account SID
                    </Label>
                    <Input
                      id="twilio-sid"
                      type="text"
                      placeholder="AC..."
                      value={formData.TWILIO_ACCOUNT_SID}
                      onChange={(e) => handleInputChange('TWILIO_ACCOUNT_SID', e.target.value)}
                      data-testid="input-twilio-sid"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Account SID do Twilio para serviços de telefonia
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="twilio-token" className="text-sm font-medium">
                      Twilio Auth Token
                    </Label>
                    <Input
                      id="twilio-token"
                      type="password"
                      placeholder="Token de autenticação..."
                      value={formData.TWILIO_AUTH_TOKEN}
                      onChange={(e) => handleInputChange('TWILIO_AUTH_TOKEN', e.target.value)}
                      data-testid="input-twilio-token"
                    />
                    <p className="text-xs text-muted-foreground">
                      Token de autenticação do Twilio
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="twilio-number" className="text-sm font-medium">
                      Número Twilio
                    </Label>
                    <Input
                      id="twilio-number"
                      type="text"
                      placeholder="+55..."
                      value={formData.TWILIO_NUMBER}
                      onChange={(e) => handleInputChange('TWILIO_NUMBER', e.target.value)}
                      data-testid="input-twilio-number"
                    />
                    <p className="text-xs text-muted-foreground">
                      Número de telefone Twilio no formato E.164 (+5511...)
                    </p>
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button
                    onClick={() => {
                      localStorage.setItem('abmix_setup_skipped', 'true');
                      toast({
                        title: "Configuração Pulada",
                        description: "Você pode configurar as chaves depois em Configurações",
                      });
                      onComplete();
                    }}
                    variant="outline"
                    data-testid="button-skip-setup"
                  >
                    Pular por Enquanto
                  </Button>
                  <Button
                    onClick={validateKeys}
                    disabled={!isFormValid || isValidating}
                    className="bg-[#10B981] hover:bg-[#059669] text-white"
                    data-testid="button-validate-keys"
                  >
                    {isValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isValidating ? 'Validando...' : 'Validar e Continuar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}