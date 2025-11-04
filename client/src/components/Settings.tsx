import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useCallStore } from '@/stores/useCallStore';
import { useTheme } from '@/contexts/ThemeContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function Settings() {
  const { toast } = useToast();
  const { selectedProvider, setSelectedProvider } = useCallStore();
  const { theme, setTheme } = useTheme();
  
  const [settings, setSettings] = useState({
    autoRecord: false,
    defaultCountryCode: '+55',
    voiceProvider: 'vapi',
    aiModel: 'gpt-4',
    language: 'pt-BR',
    notifications: true,
    volume: 80,
    mascVoiceId: 'pNInz6obpgDQGcFmaJgB', // Default male voice
    femVoiceId: '21m00Tcm4TlvDq8ikWAM', // Default female voice
  });

  // Fetch available voices from ElevenLabs
  const { data: voices, isLoading: voicesLoading } = useQuery({
    queryKey: ['/api/voices'],
    queryFn: async () => {
      const response = await fetch('/api/voices');
      if (!response.ok) throw new Error('Failed to fetch voices');
      return response.json();
    }
  });

  // Voice categorization
  const maleVoices = ['Roger', 'Clyde', 'Thomas', 'Charlie'];
  const femaleVoices = ['Sarah', 'Rachel', 'Laura', 'Aria'];

  // Filter voices by category
  const masculineVoices = voices?.filter((voice: any) => 
    maleVoices.some(name => voice.name.includes(name))
  ) || [];
  
  const feminineVoices = voices?.filter((voice: any) => 
    femaleVoices.some(name => voice.name.includes(name))
  ) || [];

  // Fetch current settings
  const { data: serverSettings } = useQuery({
    queryKey: ['/api/settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    }
  });

  // Update settings mutation
  const queryClient = useQueryClient();
  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Configurações salvas",
        description: "Configurações de voz atualizadas com sucesso",
      });
    }
  });

  // Update local settings when server settings load
  useEffect(() => {
    if (serverSettings) {
      setSettings(prev => ({
        ...prev,
        mascVoiceId: serverSettings.VOZ_MASC_ID || prev.mascVoiceId,
        femVoiceId: serverSettings.VOZ_FEM_ID || prev.femVoiceId,
      }));
    }
  }, [serverSettings]);

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    
    toast({
      title: "Configuração salva",
      description: `${key} atualizada`,
    });
  };

  const handleProviderChange = (provider: string) => {
    setSelectedProvider(provider as any);
    handleSettingChange('voiceProvider', provider);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    toast({
      title: "Tema alterado",
      description: `Modo ${newTheme === 'dark' ? 'escuro' : 'claro'} ativado`,
    });
  };

  const resetSettings = () => {
    setSettings({
      autoRecord: false,
      defaultCountryCode: '+55',
      voiceProvider: 'vapi',
      aiModel: 'gpt-4',
      language: 'pt-BR',
      notifications: true,
      volume: 80,
      mascVoiceId: 'pNInz6obpgDQGcFmaJgB',
      femVoiceId: '21m00Tcm4TlvDq8ikWAM',
    });
    setTheme('dark');
    
    toast({
      title: "Configurações resetadas",
      description: "Todas as configurações foram restauradas para o padrão",
    });
  };

  return (
    <div className="bg-card rounded-xl p-6 border border-border">
      <h3 className="text-lg font-semibold mb-6 text-foreground">Configurações</h3>
      
      <div className="space-y-6">
        {/* Provedor de Voz */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Provedor de Voz</Label>
          <div className="bg-background border border-border rounded-lg px-3 py-2">
            <span className="text-foreground capitalize">{selectedProvider}</span>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              onClick={() => handleProviderChange('vapi')}
              variant={selectedProvider === 'vapi' ? 'default' : 'outline'}
              size="sm"
              className={selectedProvider === 'vapi' ? 'bg-abmix-green text-black' : 'border-border text-foreground'}
            >
              Vapi
            </Button>
            <Button
              onClick={() => handleProviderChange('retell')}
              variant={selectedProvider === 'retell' ? 'default' : 'outline'}
              size="sm"
              className={selectedProvider === 'retell' ? 'bg-abmix-green text-black' : 'border-border text-foreground'}
            >
              Retell AI
            </Button>
            <Button
              onClick={() => handleProviderChange('twilio')}
              variant={selectedProvider === 'twilio' ? 'default' : 'outline'}
              size="sm"
              className={selectedProvider === 'twilio' ? 'bg-abmix-green text-black' : 'border-border text-foreground'}
            >
              Twilio
            </Button>
          </div>
        </div>

        {/* Modelo de IA */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Modelo de IA</Label>
          <div className="bg-background border border-border rounded-lg px-3 py-2">
            <span className="text-foreground">{settings.aiModel}</span>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              onClick={() => handleSettingChange('aiModel', 'gpt-4')}
              variant={settings.aiModel === 'gpt-4' ? 'default' : 'outline'}
              size="sm"
              className={settings.aiModel === 'gpt-4' ? 'bg-abmix-green text-black' : 'border-border text-foreground'}
            >
              GPT-4
            </Button>
            <Button
              onClick={() => handleSettingChange('aiModel', 'gpt-3.5-turbo')}
              variant={settings.aiModel === 'gpt-3.5-turbo' ? 'default' : 'outline'}
              size="sm"
              className={settings.aiModel === 'gpt-3.5-turbo' ? 'bg-abmix-green text-black' : 'border-border text-foreground'}
            >
              GPT-3.5
            </Button>
          </div>
        </div>

        {/* Configuração de Vozes ElevenLabs */}
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-center gap-2 mb-3">
            <i className="fas fa-microphone text-abmix-green"></i>
            <Label className="text-sm font-medium">Configuração de Vozes ElevenLabs</Label>
          </div>
          
          {/* Voz Masculina */}
          <div>
            <Label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <i className="fas fa-male text-blue-500"></i>
              Voz Masculina
            </Label>
            <div className="bg-background border border-border rounded-lg px-3 py-2">
              <span className="text-foreground text-sm">
                {voicesLoading ? 'Carregando vozes...' : 
                 voices?.find((v: any) => v.voice_id === settings.mascVoiceId)?.name || 'Não selecionada'}
              </span>
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {masculineVoices.map((voice: any) => (
                <Button
                  key={voice.voice_id}
                  onClick={() => {
                    handleSettingChange('mascVoiceId', voice.voice_id);
                    updateSettingsMutation.mutate({ VOZ_MASC_ID: voice.voice_id });
                  }}
                  variant={settings.mascVoiceId === voice.voice_id ? 'default' : 'outline'}
                  size="sm"
                  className={settings.mascVoiceId === voice.voice_id ? 'bg-abmix-green text-black' : 'border-border text-foreground text-xs'}
                >
                  {voice.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Voz Feminina */}
          <div>
            <Label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <i className="fas fa-female text-pink-500"></i>
              Voz Feminina
            </Label>
            <div className="bg-background border border-border rounded-lg px-3 py-2">
              <span className="text-foreground text-sm">
                {voicesLoading ? 'Carregando vozes...' : 
                 voices?.find((v: any) => v.voice_id === settings.femVoiceId)?.name || 'Não selecionada'}
              </span>
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {feminineVoices.map((voice: any) => (
                <Button
                  key={voice.voice_id}
                  onClick={() => {
                    handleSettingChange('femVoiceId', voice.voice_id);
                    updateSettingsMutation.mutate({ VOZ_FEM_ID: voice.voice_id });
                  }}
                  variant={settings.femVoiceId === voice.voice_id ? 'default' : 'outline'}
                  size="sm"
                  className={settings.femVoiceId === voice.voice_id ? 'bg-abmix-green text-black' : 'border-border text-foreground text-xs'}
                >
                  {voice.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Informações das Vozes Selecionadas */}
          <div className="bg-background/50 rounded-lg p-3 text-xs text-muted-foreground">
            <div className="flex justify-between items-center">
              <span>Vozes configuradas para o discador:</span>
              <div className="flex gap-2">
                <span className="text-blue-500">♂ {voices?.find((v: any) => v.voice_id === settings.mascVoiceId)?.name || 'Padrão'}</span>
                <span className="text-pink-500">♀ {voices?.find((v: any) => v.voice_id === settings.femVoiceId)?.name || 'Padrão'}</span>
              </div>
            </div>
          </div>

          {/* Teste de Vozes */}
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-border text-foreground hover:bg-muted"
              onClick={async () => {
                const selectedVoice = voices?.find((v: any) => v.voice_id === settings.mascVoiceId);
                if (!selectedVoice) {
                  toast({
                    title: "Erro",
                    description: "Nenhuma voz masculina selecionada",
                  });
                  return;
                }
                
                try {
                  const response = await fetch('/api/voices/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      voiceId: settings.mascVoiceId,
                      text: 'Olá, bem-vindo à Disck Mix. Seu painel inteligente de ligações.'
                    })
                  });
                  
                  if (response.ok) {
                    const audioBlob = await response.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    await audio.play();
                    
                    toast({
                      title: "Teste de voz masculina",
                      description: `Reproduzindo: ${selectedVoice.name}`,
                    });
                  } else {
                    throw new Error('Erro no teste de voz');
                  }
                } catch (error) {
                  toast({
                    title: "Erro no teste",
                    description: "Não foi possível reproduzir a voz masculina",
                  });
                }
              }}
            >
              <i className="fas fa-play mr-2"></i>
              Testar Masc
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-border text-foreground hover:bg-muted"
              onClick={async () => {
                const selectedVoice = voices?.find((v: any) => v.voice_id === settings.femVoiceId);
                if (!selectedVoice) {
                  toast({
                    title: "Erro",
                    description: "Nenhuma voz feminina selecionada",
                  });
                  return;
                }
                
                try {
                  const response = await fetch('/api/voices/test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      voiceId: settings.femVoiceId,
                      text: 'Olá, bem-vindo à Disck Mix. Seu painel inteligente de ligações.'
                    })
                  });
                  
                  if (response.ok) {
                    const audioBlob = await response.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    await audio.play();
                    
                    toast({
                      title: "Teste de voz feminina",
                      description: `Reproduzindo: ${selectedVoice.name}`,
                    });
                  } else {
                    throw new Error('Erro no teste de voz');
                  }
                } catch (error) {
                  toast({
                    title: "Erro no teste",
                    description: "Não foi possível reproduzir a voz feminina",
                  });
                }
              }}
            >
              <i className="fas fa-play mr-2"></i>
              Testar Fem
            </Button>
          </div>
        </div>

        {/* Idioma */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Idioma</Label>
          <div className="bg-background border border-border rounded-lg px-3 py-2">
            <span className="text-foreground">
              {settings.language === 'pt-BR' ? 'Português (Brasil)' : 
               settings.language === 'en-US' ? 'English (US)' : 'Español'}
            </span>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              onClick={() => handleSettingChange('language', 'pt-BR')}
              variant={settings.language === 'pt-BR' ? 'default' : 'outline'}
              size="sm"
              className={settings.language === 'pt-BR' ? 'bg-abmix-green text-black' : 'border-border text-foreground'}
            >
              PT-BR
            </Button>
            <Button
              onClick={() => handleSettingChange('language', 'en-US')}
              variant={settings.language === 'en-US' ? 'default' : 'outline'}
              size="sm"
              className={settings.language === 'en-US' ? 'bg-abmix-green text-black' : 'border-border text-foreground'}
            >
              EN-US
            </Button>
          </div>
        </div>

        {/* Código do País Padrão */}
        <div>
          <Label htmlFor="country-code" className="text-sm font-medium mb-2 block">
            Código do País Padrão
          </Label>
          <Input
            id="country-code"
            value={settings.defaultCountryCode}
            onChange={(e) => handleSettingChange('defaultCountryCode', e.target.value)}
            placeholder="+55"
            className="bg-background border-border"
          />
        </div>

        {/* Volume */}
        <div>
          <Label htmlFor="volume" className="text-sm font-medium mb-2 block">
            Volume ({settings.volume}%)
          </Label>
          <Input
            id="volume"
            type="range"
            min="0"
            max="100"
            value={settings.volume}
            onChange={(e) => handleSettingChange('volume', parseInt(e.target.value))}
            className="bg-background border-border"
          />
        </div>

        {/* Switches */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-record" className="text-sm font-medium">
              Gravação Automática
            </Label>
            <Switch
              id="auto-record"
              checked={settings.autoRecord}
              onCheckedChange={(checked) => handleSettingChange('autoRecord', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="notifications" className="text-sm font-medium">
              Notificações
            </Label>
            <Switch
              id="notifications"
              checked={settings.notifications}
              onCheckedChange={(checked) => handleSettingChange('notifications', checked)}
            />
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Tema</Label>
            <div className="bg-card border border-border rounded-lg px-3 py-2">
              <span className="text-foreground capitalize">
                {theme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}
              </span>
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                onClick={() => handleThemeChange('light')}
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                className={theme === 'light' ? 'bg-abmix-green text-black' : 'border-border text-foreground'}
                data-testid="light-mode-button"
              >
                <i className="fas fa-sun text-sm mr-1"></i>
                Claro
              </Button>
              <Button
                onClick={() => handleThemeChange('dark')}
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                className={theme === 'dark' ? 'bg-abmix-green text-black' : 'border-border text-foreground'}
                data-testid="dark-mode-button"
              >
                <i className="fas fa-moon text-sm mr-1"></i>
                Escuro
              </Button>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <Button
            onClick={resetSettings}
            variant="outline"
            className="flex-1 border-border text-foreground hover:bg-muted"
          >
            <i className="fas fa-undo mr-2"></i>
            Resetar
          </Button>
          
          <Button
            onClick={() => {
              const settingsToSave = {
                VOZ_MASC_ID: settings.mascVoiceId,
                VOZ_FEM_ID: settings.femVoiceId,
                IDIOMA: settings.language,
                VOLUME: settings.volume.toString(),
                AUTO_RECORD: settings.autoRecord.toString(),
                NOTIFICATIONS: settings.notifications.toString()
              };
              updateSettingsMutation.mutate(settingsToSave);
            }}
            className="flex-1 bg-abmix-green text-black hover:bg-abmix-green/90"
            disabled={updateSettingsMutation.isPending}
          >
            <i className="fas fa-save mr-2"></i>
            {updateSettingsMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  );
}