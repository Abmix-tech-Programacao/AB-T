import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Dot, 
  Square, 
  Play, 
  Pause, 
  Download, 
  Trash2, 
  Clock, 
  Phone,
  FileAudio,
  Volume2
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";

interface Recording {
  id: string;
  filename: string;
  status: 'recording' | 'paused' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  duration?: number;
  fileSize?: number;
  transcription?: string;
  callId?: string;
  toNumber?: string;
  fromNumber?: string;
}

interface CallRecordingProps {
  callSid?: string;
  phoneNumber?: string;
  isCallActive: boolean;
}

export function CallRecording({ callSid, phoneNumber, isCallActive }: CallRecordingProps) {
  const { toast } = useToast();
  const [currentRecording, setCurrentRecording] = useState<Recording | null>(null);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  // Fetch all recordings
  const { data: recordings = [], refetch: refetchRecordings } = useQuery<Recording[]>({
    queryKey: ['/api/recordings/list'],
    refetchInterval: currentRecording?.status === 'recording' ? 2000 : false,
  });

  // Start recording mutation
  const startRecordingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/recordings/start', {
        callSid,
        phoneNumber
      });
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentRecording(data);
      toast({
        title: "🔴 Gravação Iniciada",
        description: `Gravando chamada para ${phoneNumber}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/recordings/list'] });
    },
    onError: (error) => {
      toast({
        title: "Erro na Gravação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Pause recording mutation
  const pauseRecordingMutation = useMutation({
    mutationFn: async (recordingId: string) => {
      const response = await apiRequest('POST', `/api/recordings/${recordingId}/pause`);
      return response.json();
    },
    onSuccess: () => {
      setCurrentRecording(prev => prev ? { ...prev, status: 'paused' } : null);
      toast({
        title: "⏸️ Gravação Pausada",
        description: "A gravação foi pausada",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/recordings/list'] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Resume recording mutation
  const resumeRecordingMutation = useMutation({
    mutationFn: async (recordingId: string) => {
      const response = await apiRequest('POST', `/api/recordings/${recordingId}/resume`);
      return response.json();
    },
    onSuccess: () => {
      setCurrentRecording(prev => prev ? { ...prev, status: 'recording' } : null);
      toast({
        title: "▶️ Gravação Retomada",
        description: "A gravação foi retomada",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/recordings/list'] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Stop recording mutation
  const stopRecordingMutation = useMutation({
    mutationFn: async (recordingId: string) => {
      const response = await apiRequest('POST', `/api/recordings/${recordingId}/stop`);
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentRecording(null);
      setRecordingProgress(0);
      toast({
        title: "⏹️ Gravação Finalizada",
        description: `Arquivo salvo: ${data.filename}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/recordings/list'] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete recording mutation
  const deleteRecordingMutation = useMutation({
    mutationFn: async (recordingId: string) => {
      const response = await apiRequest('DELETE', `/api/recordings/${recordingId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "🗑️ Gravação Removida",
        description: "A gravação foi removida com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/recordings/list'] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update recording progress
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (currentRecording?.status === 'recording') {
      interval = setInterval(() => {
        setRecordingProgress(prev => Math.min(prev + 1, 100));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentRecording?.status]);

  // Play audio function
  const playAudio = async (recordingId: string, filename: string) => {
    try {
      if (playingAudio === recordingId) {
        setPlayingAudio(null);
        return;
      }

      setPlayingAudio(recordingId);
      
      const response = await fetch(`/api/recordings/${recordingId}/download`);
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        setPlayingAudio(null);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setPlayingAudio(null);
        URL.revokeObjectURL(audioUrl);
        toast({
          title: "Erro na Reprodução",
          description: "Não foi possível reproduzir a gravação",
          variant: "destructive",
        });
      };

      await audio.play();
    } catch (error) {
      setPlayingAudio(null);
      toast({
        title: "Erro na Reprodução",
        description: "Falha ao reproduzir áudio",
        variant: "destructive",
      });
    }
  };

  const downloadRecording = (recordingId: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `/api/recordings/${recordingId}/download`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "0 B";
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'recording': return 'bg-red-500';
      case 'paused': return 'bg-yellow-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'recording': return 'Gravando';
      case 'paused': return 'Pausada';
      case 'completed': return 'Concluída';
      case 'failed': return 'Falhou';
      default: return 'Desconhecido';
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Recording Controls */}
      {isCallActive && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <Dot className="h-5 w-5" />
              Controles de Gravação
            </CardTitle>
            <CardDescription>
              Gerencie a gravação da chamada atual para {phoneNumber}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!currentRecording ? (
              <Button 
                onClick={() => startRecordingMutation.mutate()}
                disabled={startRecordingMutation.isPending}
                className="w-full bg-red-600 hover:bg-red-700"
                data-testid="button-start-recording"
              >
                <Dot className="h-4 w-4 mr-2" />
                Iniciar Gravação
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(currentRecording.status)} data-testid="badge-recording-status">
                    {getStatusText(currentRecording.status)}
                  </Badge>
                  <span className="text-sm font-mono" data-testid="text-recording-duration">
                    {Math.floor(recordingProgress / 60).toString().padStart(2, '0')}:
                    {(recordingProgress % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                
                {currentRecording.status === 'recording' && (
                  <Progress value={recordingProgress} className="w-full" />
                )}

                <div className="flex gap-2">
                  {currentRecording.status === 'recording' ? (
                    <Button
                      onClick={() => pauseRecordingMutation.mutate(currentRecording.id)}
                      disabled={pauseRecordingMutation.isPending}
                      variant="outline"
                      data-testid="button-pause-recording"
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Pausar
                    </Button>
                  ) : currentRecording.status === 'paused' ? (
                    <Button
                      onClick={() => resumeRecordingMutation.mutate(currentRecording.id)}
                      disabled={resumeRecordingMutation.isPending}
                      variant="outline"
                      data-testid="button-resume-recording"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Continuar
                    </Button>
                  ) : null}
                  
                  <Button
                    onClick={() => stopRecordingMutation.mutate(currentRecording.id)}
                    disabled={stopRecordingMutation.isPending}
                    variant="destructive"
                    data-testid="button-stop-recording"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Finalizar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recordings List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileAudio className="h-5 w-5" />
            Gravações Salvas
          </CardTitle>
          <CardDescription>
            Histórico de gravações de chamadas com reprodução e download
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recordings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-recordings">
              <FileAudio className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma gravação disponível</p>
              <p className="text-sm">As gravações aparecerão aqui após serem finalizadas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recordings.map((recording) => (
                <div 
                  key={recording.id} 
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-testid={`recording-item-${recording.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center">
                      <Badge className={getStatusColor(recording.status)} data-testid={`badge-status-${recording.id}`}>
                        {getStatusText(recording.status)}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {formatDuration(recording.duration)}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="font-medium" data-testid={`text-filename-${recording.id}`}>
                        {recording.filename}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        {recording.toNumber && (
                          <span data-testid={`text-number-${recording.id}`}>
                            Para: {recording.toNumber}
                          </span>
                        )}
                        {recording.fromNumber && (
                          <span>De: {recording.fromNumber}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(recording.startTime).toLocaleString('pt-BR')}
                        {recording.fileSize && ` • ${formatFileSize(recording.fileSize)}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {recording.status === 'completed' && (
                      <>
                        <Button
                          onClick={() => playAudio(recording.id, recording.filename)}
                          variant="outline"
                          size="sm"
                          disabled={!!playingAudio && playingAudio !== recording.id}
                          data-testid={`button-play-${recording.id}`}
                        >
                          {playingAudio === recording.id ? (
                            <>
                              <Volume2 className="h-4 w-4 mr-2" />
                              Tocando...
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Reproduzir
                            </>
                          )}
                        </Button>

                        <Button
                          onClick={() => downloadRecording(recording.id, recording.filename)}
                          variant="outline"
                          size="sm"
                          data-testid={`button-download-${recording.id}`}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </>
                    )}

                    <Button
                      onClick={() => deleteRecordingMutation.mutate(recording.id)}
                      disabled={deleteRecordingMutation.isPending}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      data-testid={`button-delete-${recording.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}