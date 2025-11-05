import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

interface Recording {
  id: number;
  call_sid: string;
  phone_number: string;
  filename: string;
  duration_sec: number;
  started_at: string;
  ended_at: string;
  size_bytes: number;
}

export function RecordingsTab() {
  const { toast } = useToast();
  const [playingId, setPlayingId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Fetch recordings list
  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['/api/recordings/list'],
    queryFn: async () => {
      const response = await fetch('/api/recordings/list');
      if (!response.ok) throw new Error('Failed to fetch recordings');
      return response.json();
    }
  });

  // Format duration helper
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format file size helper
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handlePlay = async (recordingId: number) => {
    if (playingId === recordingId) {
      // Stop current playback
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
      });
      setPlayingId(null);
      toast({
        title: "Reprodução pausada",
        description: "Áudio pausado",
      });
    } else {
      try {
        // Stop any other playing audio first
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach(audio => {
          audio.pause();
          audio.currentTime = 0;
        });

        // Create and configure new audio
        const audio = new Audio(`/api/recordings/${recordingId}/play`);
        audio.crossOrigin = "anonymous";
        audio.preload = "auto";
        
        setPlayingId(recordingId);
        
        audio.onended = () => {
          setPlayingId(null);
          toast({
            title: "Reprodução finalizada",
            description: "Áudio reproduzido completamente",
          });
        };
        
        audio.onerror = (e) => {
          console.error('Audio playback error:', e);
          setPlayingId(null);
          toast({
            title: "Erro na reprodução",
            description: "Não foi possível carregar o áudio",
            variant: "destructive",
          });
        };

        audio.onloadstart = () => {
          console.log('Audio loading started for recording:', recordingId);
        };

        audio.oncanplay = () => {
          console.log('Audio can start playing for recording:', recordingId);
        };
        
        // Start loading and playing
        await audio.play();
        toast({
          title: "Reproduzindo áudio",
          description: "Tocando gravação da ligação",
        });
      } catch (error) {
        console.error('Play error:', error);
        setPlayingId(null);
        toast({
          title: "Erro na reprodução", 
          description: "Não foi possível reproduzir o áudio",
          variant: "destructive",
        });
      }
    }
  };

  const handleStop = (recordingId: number) => {
    // Stop all audio elements
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
    setPlayingId(null);
    toast({
      title: "Reprodução parada",
      description: "Áudio parado",
    });
  };

  const handleDownload = async (recording: Recording) => {
    try {
      const response = await fetch(`/api/recordings/${recording.id}/download`);
      if (!response.ok) throw new Error('Failed to download');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = recording.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download iniciado",
        description: `Baixando ${recording.filename}`,
      });
    } catch (error) {
      toast({
        title: "Erro no download",
        description: "Não foi possível baixar a gravação",
      });
    }
  };

  // Delete recording mutation
  const deleteRecordingMutation = useMutation({
    mutationFn: async (recordingId: number) => {
      const response = await fetch(`/api/recordings/${recordingId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete recording');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recordings/list'] });
      toast({
        title: "Gravação excluída",
        description: "Arquivo removido com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a gravação",
        variant: "destructive",
      });
    }
  });

  const handleDelete = async (recording: Recording) => {
    deleteRecordingMutation.mutate(recording.id);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Gravações</h2>
        <div className="text-sm text-muted-foreground">
          {recordings.length} arquivo{recordings.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            <i className="fas fa-spinner fa-spin mr-2"></i>
            Carregando gravações...
          </div>
        ) : recordings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <i className="fas fa-microphone-slash text-3xl mb-3"></i>
            <p>Nenhuma gravação encontrada</p>
            <p className="text-sm">Inicie uma gravação no painel principal</p>
          </div>
        ) : (
          recordings.map((recording: Recording) => (
            <div key={recording.id} className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-abmix-green/20 rounded-full flex items-center justify-center">
                      <i className="fas fa-phone text-abmix-green"></i>
                    </div>
                    <div>
                      <div className="text-lg font-medium text-foreground">
                        {recording.phone_number || 'Número não informado'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDuration(recording.duration_sec)} • {formatFileSize(recording.size_bytes)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(recording.started_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  <Button
                    onClick={() => handlePlay(recording.id)}
                    size="sm"
                    variant="outline"
                    className="p-2 h-9 w-9 border-border text-foreground hover:bg-muted"
                    data-testid={`play-button-${recording.id}`}
                  >
                    <i className={`fas ${playingId === recording.id ? 'fa-pause' : 'fa-play'} text-sm`}></i>
                  </Button>
                  
                  <Button
                    onClick={() => handleStop(recording.id)}
                    size="sm"
                    variant="outline"
                    disabled={playingId !== recording.id}
                    className="p-2 h-9 w-9 border-border text-foreground hover:bg-muted disabled:opacity-50"
                    data-testid={`stop-button-${recording.id}`}
                  >
                    <i className="fas fa-stop text-sm"></i>
                  </Button>
                  
                  <Button
                    onClick={() => handleDownload(recording)}
                    size="sm"
                    variant="outline"
                    className="p-2 h-9 w-9 border-border text-foreground hover:bg-muted"
                    data-testid={`download-button-${recording.id}`}
                  >
                    <i className="fas fa-download text-sm"></i>
                  </Button>
                  
                  <Button
                    onClick={() => handleDelete(recording)}
                    size="sm"
                    variant="outline"
                    disabled={deleteRecordingMutation.isPending}
                    className="p-2 h-9 w-9 border-abmix-green text-abmix-green hover:bg-abmix-green hover:text-black"
                    data-testid={`delete-button-${recording.id}`}
                  >
                    <i className="fas fa-trash text-sm"></i>
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}