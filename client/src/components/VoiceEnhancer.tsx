import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Volume2, Zap, Sparkles, Settings } from "lucide-react";

interface VoiceSettings {
  stability: number;
  similarity: number;
  style: number;
  speakerBoost: boolean;
  model: string;
  quality: string;
}

export function VoiceEnhancer() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<VoiceSettings>({
    stability: 35,
    similarity: 95,
    style: 15,
    speakerBoost: true,
    model: 'eleven_multilingual_v2',
    quality: 'natural'
  });
  
  const [recommendedVoices, setRecommendedVoices] = useState<{
    masc: string[];
    fem: string[];
  }>({ masc: [], fem: [] });
  
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchRecommendedVoices();
  }, []);

  const fetchRecommendedVoices = async () => {
    try {
      const response = await fetch('/api/voices/recommended');
      if (response.ok) {
        const data = await response.json();
        setRecommendedVoices(data.voices || { masc: [], fem: [] });
      } else {
        console.error('Failed to fetch recommended voices:', response.status);
        setRecommendedVoices({ masc: [], fem: [] });
      }
    } catch (error) {
      console.error('Failed to fetch recommended voices:', error);
      setRecommendedVoices({ masc: [], fem: [] });
    }
  };

  const testEnhancedVoice = async (voiceId: string, voiceType: 'masc' | 'fem') => {
    setIsLoading(true);
    try {
      const testText = voiceType === 'masc' 
        ? 'Olá, sou seu assistente virtual. Esta voz foi otimizada para soar mais natural e humana.'
        : 'Olá, sou sua assistente virtual. Esta configuração remove o tom robótico da voz artificial.';

      const response = await fetch('/api/voices/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId,
          text: testText,
          voiceType,
          quality: settings.quality
        })
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        await audio.play();

        toast({
          title: "🎯 Voz Aprimorada",
          description: `Reproduzindo voz ${voiceType} com configurações anti-robóticas`,
        });
      }
    } catch (error) {
      toast({
        title: "Erro no teste",
        description: "Não foi possível reproduzir a voz aprimorada",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applySettings = async () => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          VOICE_STABILITY: (settings.stability / 100).toString(),
          VOICE_SIMILARITY: (settings.similarity / 100).toString(),
          VOICE_STYLE: (settings.style / 100).toString(),
          VOICE_SPEAKER_BOOST: settings.speakerBoost.toString(),
          MODELO: settings.model,
          VOICE_PROCESSING: settings.quality
        })
      });

      if (response.ok) {
        toast({
          title: "✅ Configurações Salvas",
          description: "Voz otimizada para soar mais natural",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao salvar configurações",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <Sparkles className="h-5 w-5" />
            Otimizador de Voz Anti-Robótica
          </CardTitle>
          <CardDescription>
            Configure parâmetros avançados para vozes mais naturais e humanas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Modelo de IA */}
          <div className="space-y-2">
            <Label>Modelo de IA</Label>
            <Select value={settings.model} onValueChange={(value) => 
              setSettings(prev => ({ ...prev, model: value }))
            }>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eleven_multilingual_v2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Recomendado</Badge>
                    Multilingual V2 (Natural)
                  </div>
                </SelectItem>
                <SelectItem value="eleven_turbo_v2_5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Novo</Badge>
                    Turbo V2.5 (Ultra Natural)
                  </div>
                </SelectItem>
                <SelectItem value="eleven_flash_v2_5">
                  Flash V2.5 (Rápido)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Qualidade */}
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select value={settings.quality} onValueChange={(value) => 
              setSettings(prev => ({ ...prev, quality: value }))
            }>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="natural">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Melhor</Badge>
                    Naturalidade Máxima
                  </div>
                </SelectItem>
                <SelectItem value="quality">Qualidade Alta</SelectItem>
                <SelectItem value="speed">Velocidade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Configurações Avançadas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estabilidade: {settings.stability}%</Label>
              <Slider
                value={[settings.stability]}
                onValueChange={([value]) => 
                  setSettings(prev => ({ ...prev, stability: value }))
                }
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Menos = mais emotivo, Mais = mais consistente
              </p>
            </div>

            <div className="space-y-2">
              <Label>Similaridade: {settings.similarity}%</Label>
              <Slider
                value={[settings.similarity]}
                onValueChange={([value]) => 
                  setSettings(prev => ({ ...prev, similarity: value }))
                }
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Maior = mais fiel à voz original
              </p>
            </div>

            <div className="space-y-2">
              <Label>Estilo: {settings.style}%</Label>
              <Slider
                value={[settings.style]}
                onValueChange={([value]) => 
                  setSettings(prev => ({ ...prev, style: value }))
                }
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Personalidade da voz original
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="speaker-boost">Amplificação de Clareza</Label>
              <Switch
                id="speaker-boost"
                checked={settings.speakerBoost}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, speakerBoost: checked }))
                }
              />
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-2">
            <Button 
              onClick={applySettings}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Settings className="h-4 w-4 mr-2" />
              Aplicar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Vozes Recomendadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Vozes Menos Robóticas
          </CardTitle>
          <CardDescription>
            Seleção de vozes otimizadas para soar mais humanas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vozes Masculinas */}
            <div className="space-y-2">
              <h3 className="font-semibold text-blue-700 dark:text-blue-300">Masculinas</h3>
              <div className="space-y-2">
                {recommendedVoices?.masc?.slice(0, 3).map((voiceId, index) => (
                  <Button
                    key={voiceId}
                    variant="outline"
                    size="sm"
                    onClick={() => testEnhancedVoice(voiceId, 'masc')}
                    disabled={isLoading}
                    className="w-full justify-start"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Testar Voz {index + 1}
                  </Button>
                )) || (
                  <div className="text-sm text-muted-foreground">
                    Carregando vozes recomendadas...
                  </div>
                )}
              </div>
            </div>

            {/* Vozes Femininas */}
            <div className="space-y-2">
              <h3 className="font-semibold text-pink-700 dark:text-pink-300">Femininas</h3>
              <div className="space-y-2">
                {recommendedVoices?.fem?.slice(0, 3).map((voiceId, index) => (
                  <Button
                    key={voiceId}
                    variant="outline"
                    size="sm"
                    onClick={() => testEnhancedVoice(voiceId, 'fem')}
                    disabled={isLoading}
                    className="w-full justify-start"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Testar Voz {index + 1}
                  </Button>
                )) || (
                  <div className="text-sm text-muted-foreground">
                    Carregando vozes recomendadas...
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dicas */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2 text-blue-700 dark:text-blue-300">
            💡 Dicas para Voz Mais Natural
          </h3>
          <ul className="text-sm space-y-1 text-blue-600 dark:text-blue-400">
            <li>• Estabilidade baixa (30-40%) = mais expressiva</li>
            <li>• Similaridade alta (90-95%) = menos robótica</li>
            <li>• Modelo Multilingual V2 = melhor qualidade</li>
            <li>• Textos longos = maior variação natural</li>
            <li>• Evite frases muito técnicas ou repetitivas</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}