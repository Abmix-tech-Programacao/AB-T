import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCallStore } from '@/stores/useCallStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';

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

export function Recordings() {
  const { toast } = useToast();
  const { isRecording, setIsRecording, currentCallId } = useCallStore();
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [currentRecordingId, setCurrentRecordingId] = useState<number | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const queryClient = useQueryClient();

  // Fetch recordings list
  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['/api/recordings/list'],
    queryFn: async () => {
      const response = await fetch('/api/recordings/list');
      if (!response.ok) throw new Error('Failed to fetch recordings');
      return response.json();
    },
    refetchInterval: isRecording ? 5000 : false, // Refresh while recording
  });

  // Start recording mutation
  const startRecordingMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const response = await fetch('/api/recordings/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callSid: currentCallId || `call-${Date.now()}`,
          phoneNumber: phoneNumber
        })
      });
      if (!response.ok) throw new Error('Failed to start recording');
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentRecordingId(data.id);
      setRecordingStartTime(Date.now());
      setIsRecording(true);
      queryClient.invalidateQueries({ queryKey: ['/api/recordings/list'] });
    }
  });

  // Stop recording mutation
  const stopRecordingMutation = useMutation({
    mutationFn: async () => {
      if (!currentRecordingId) throw new Error('No active recording');
      const response = await fetch(`/api/recordings/${currentRecordingId}/stop`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to stop recording');
      return response.json();
    },
    onSuccess: () => {
      setIsRecording(false);
      setRecordingStartTime(null);
      setCurrentRecordingId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/recordings/list'] });
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

  const handleStartRecording = async () => {
    try {
      if (currentCallId) {
        // Recording during a call - use Twilio recording
        const phoneNumber = "11999887766";
        startRecordingMutation.mutate(phoneNumber);
        toast({
          title: "Gravação de ligação iniciada",
          description: `Gravando chamada para ${phoneNumber}`,
        });
      } else {
        // Recording from microphone when not in call
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100
          } 
        });
        
        setAudioStream(stream);
        audioChunks.current = [];
        
        const recorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.current.push(event.data);
          }
        };
        
        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
          await uploadMicrophoneRecording(audioBlob);
        };
        
        recorder.start(1000); // Collect data every second
        setMediaRecorder(recorder);
        setIsRecording(true);
        setRecordingStartTime(Date.now());
        
        toast({
          title: "Gravação do microfone iniciada",
          description: "Gravando áudio do microfone",
        });
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Erro ao iniciar gravação",
        description: "Não foi possível acessar o microfone",
        variant: "destructive",
      });
    }
  };

  const pauseRecordingMutation = useMutation({
    mutationFn: async () => {
      if (!currentRecordingId) throw new Error('No active recording');
      const response = await fetch(`/api/recordings/${currentRecordingId}/pause`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to pause recording');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Gravação pausada",
        description: "Gravação pausada temporariamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao pausar",
        description: error instanceof Error ? error.message : "Falha na operação",
        variant: "destructive",
      });
    }
  });

  const resumeRecordingMutation = useMutation({
    mutationFn: async () => {
      if (!currentRecordingId) throw new Error('No active recording');
      const response = await fetch(`/api/recordings/${currentRecordingId}/resume`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to resume recording');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Gravação retomada",
        description: "Gravação retomada com sucesso",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao retomar",
        description: error instanceof Error ? error.message : "Falha na operação",
        variant: "destructive",
      });
    }
  });

  const handlePauseRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      // Pause microphone recording
      mediaRecorder.pause();
      toast({
        title: "Gravação pausada",
        description: "Microfone pausado temporariamente",
      });
    } else if (currentRecordingId) {
      // Pause Twilio call recording
      pauseRecordingMutation.mutate();
    } else {
      toast({
        title: "Nenhuma gravação ativa",
        variant: "destructive",
      });
    }
  };

  const handleResumeRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      // Resume microphone recording
      mediaRecorder.resume();
      toast({
        title: "Gravação retomada",
        description: "Microfone retomado",
      });
    } else if (currentRecordingId) {
      // Resume Twilio call recording
      resumeRecordingMutation.mutate();
    } else {
      toast({
        title: "Nenhuma gravação pausada",
        variant: "destructive",
      });
    }
  };

  const handleStopRecording = () => {
    if (currentRecordingId && currentCallId) {
      // Stop Twilio call recording
      stopRecordingMutation.mutate();
    } else if (mediaRecorder && mediaRecorder.state === 'recording') {
      // Stop microphone recording
      mediaRecorder.stop();
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
      }
      setMediaRecorder(null);
      setIsRecording(false);
      setRecordingStartTime(null);
      
      toast({
        title: "Gravação finalizada",
        description: "Processando áudio do microfone...",
      });
    }
  };
  
  const uploadMicrophoneRecording = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      const timestamp = Date.now();
      const filename = `microfone-${timestamp}.webm`;
      
      formData.append('audio', audioBlob, filename);
      formData.append('phoneNumber', 'Microfone');
      formData.append('callSid', `mic-${timestamp}`);
      
      const response = await fetch('/api/recordings/upload', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/recordings/list'] });
        toast({
          title: "Gravação salva",
          description: "Áudio do microfone salvo com sucesso",
        });
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Error uploading recording:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a gravação",
        variant: "destructive",
      });
    }
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
    <div className="bg-card rounded-xl p-6 border border-border h-fit">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Gravações</h3>
        <div className="flex items-center space-x-2">
          <div 
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400 opacity-30'
            }`}
            data-testid="recording-indicator"
          ></div>
          <span className="text-sm text-muted-foreground">
            {isRecording ? 'Gravando' : 'Inativo'}
          </span>
        </div>
      </div>
      
      <div className="space-y-4">
        {/* Control Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {!isRecording ? (
            <Button
              onClick={handleStartRecording}
              disabled={startRecordingMutation.isPending}
              className="bg-abmix-green text-black py-2 px-2 rounded-lg hover:bg-abmix-green/90 transition-colors text-xs font-medium disabled:opacity-50 flex flex-col items-center justify-center gap-1"
              data-testid="start-recording-button"
            >
              <i className="fas fa-record-vinyl text-sm"></i>
              {startRecordingMutation.isPending ? 'Iniciando...' : 'Iniciar'}
            </Button>
          ) : (
            <Button
              onClick={handlePauseRecording}
              disabled={stopRecordingMutation.isPending}
              className="bg-abmix-green text-black py-2 px-2 rounded-lg hover:bg-abmix-green/90 transition-colors text-xs font-medium disabled:opacity-50 flex flex-col items-center justify-center gap-1"
              data-testid="pause-recording-button"
            >
              <i className="fas fa-pause text-sm"></i>
              Pausar
            </Button>
          )}
          
          <Button
            onClick={handleStopRecording}
            disabled={!isRecording || stopRecordingMutation.isPending}
            className="bg-abmix-green text-black py-2 px-2 rounded-lg hover:bg-abmix-green/90 transition-colors text-xs font-medium disabled:opacity-50 flex flex-col items-center justify-center gap-1"
            data-testid="stop-recording-button"
          >
            <i className="fas fa-stop text-sm"></i>
            {stopRecordingMutation.isPending ? 'Parando...' : 'Parar'}
          </Button>
        </div>

        {/* Recordings List */}
        <div className="max-h-80 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Carregando gravações...
            </div>
          ) : recordings.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <i className="fas fa-microphone-slash mr-2"></i>
              Nenhuma gravação encontrada
            </div>
          ) : (
            recordings.map((recording: Recording) => (
              <div key={recording.id} className="bg-background rounded-lg p-3 border border-border">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">
                      {recording.phone_number || 'Número não informado'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDuration(recording.duration_sec)} • {formatFileSize(recording.size_bytes)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(recording.started_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      onClick={() => handleDownload(recording)}
                      size="sm"
                      variant="outline"
                      className="p-1 h-8 w-8 border-border text-foreground hover:bg-muted"
                      data-testid={`download-button-${recording.id}`}
                    >
                      <i className="fas fa-download text-xs"></i>
                    </Button>
                    <Button
                      onClick={() => handleDelete(recording)}
                      size="sm"
                      variant="outline"
                      disabled={deleteRecordingMutation.isPending}
                      className="p-1 h-8 w-8 border-abmix-green text-abmix-green hover:bg-abmix-green hover:text-black"
                      data-testid={`delete-button-${recording.id}`}
                    >
                      <i className="fas fa-trash text-xs"></i>
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
