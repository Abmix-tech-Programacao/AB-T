import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { Phone, Plus, Trash2, Star, CheckCircle } from 'lucide-react';

interface VoIPNumber {
  id: number;
  name: string;
  number: string;
  provider: string;
  sip_username: string | null;
  sip_server: string | null;
  is_default: boolean;
  status: string;
  created_at: string;
  // sip_password is NOT included - handled securely on server via environment variables
}

export function VoIPNumbers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    number: '',
    provider: 'sobreip',
    sipUsername: '',
    sipServer: 'voz.sobreip.com.br',
    isDefault: false
    // sipPassword removed - must be configured as environment variable on server
  });

  const { data: numbers = [], isLoading } = useQuery({
    queryKey: ['/api/voip-numbers'],
    queryFn: () => api.getVoipNumbers(),
  });

  const addMutation = useMutation({
    mutationFn: (data: typeof formData) => api.addVoipNumber(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voip-numbers'] });
      toast({
        title: "Número adicionado",
        description: "Número VoIP cadastrado com sucesso!",
      });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Erro ao adicionar número",
        description: error instanceof Error ? error.message : "Falha na operação",
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteVoipNumber(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voip-numbers'] });
      toast({
        title: "Número removido",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover número",
        description: error instanceof Error ? error.message : "Falha na operação",
        variant: "destructive",
      });
    }
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: number) => api.setDefaultVoipNumber(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/voip-numbers'] });
      toast({
        title: "Número padrão definido",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao definir padrão",
        description: error instanceof Error ? error.message : "Falha na operação",
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      number: '',
      provider: 'sobreip',
      sipUsername: '',
      sipServer: 'voz.sobreip.com.br',
      isDefault: false
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate(formData);
  };

  const handleDelete = (number: VoIPNumber) => {
    if (window.confirm(`Deseja realmente remover o número ${number.name}?`)) {
      deleteMutation.mutate(number.id);
    }
  };

  const handleSetDefault = (number: VoIPNumber) => {
    setDefaultMutation.mutate(number.id);
  };

  if (isLoading) {
    return (
      <div className="bg-dark-surface rounded-xl p-6 border border-dark-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Meus Números VoIP
          </h3>
        </div>
        <div className="text-center text-gray-400">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="bg-dark-surface rounded-xl p-6 border border-dark-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Phone className="w-5 h-5 text-abmix-green" />
          Meus Números VoIP
        </h3>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="bg-abmix-green text-black hover:bg-abmix-green/90"
          size="sm"
          data-testid="button-add-voip-number"
        >
          <Plus className="w-4 h-4 mr-1" />
          Adicionar Número
        </Button>
      </div>

      <div className="space-y-3">
        {numbers.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <Phone className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum número VoIP cadastrado</p>
            <p className="text-sm mt-1">Adicione seu primeiro número para começar</p>
          </div>
        ) : (
          numbers.map((number: VoIPNumber) => (
            <div
              key={number.id}
              className={`bg-dark-bg rounded-lg p-4 border ${
                number.is_default ? 'border-abmix-green' : 'border-dark-border'
              }`}
              data-testid={`voip-number-${number.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{number.name}</h4>
                    {number.is_default && (
                      <span className="bg-abmix-green/20 text-abmix-green text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Padrão
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      number.provider === 'sobreip' 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {number.provider === 'sobreip' ? 'SobreIP' : 'Twilio'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 font-mono">{number.number}</p>
                  {number.provider === 'sobreip' && (
                    <p className="text-xs text-gray-500 mt-1">
                      Servidor: {number.sip_server}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!number.is_default && (
                    <Button
                      onClick={() => handleSetDefault(number)}
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-abmix-green"
                      data-testid={`button-set-default-${number.id}`}
                    >
                      <Star className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    onClick={() => handleDelete(number)}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-red-400"
                    data-testid={`button-delete-${number.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="dialog-add-voip-number">
          <DialogHeader>
            <DialogTitle>Adicionar Número VoIP</DialogTitle>
            <DialogDescription>
              Cadastre um novo número VoIP para usar no sistema
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome do Número</Label>
                <Input
                  id="name"
                  placeholder="Ex: SP Principal"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  data-testid="input-name"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="number">Número (formato E.164)</Label>
                <Input
                  id="number"
                  placeholder="+5511951944022"
                  value={formData.number}
                  onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  required
                  data-testid="input-number"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="provider">Provedor</Label>
                <Select
                  value={formData.provider}
                  onValueChange={(value) => setFormData({ ...formData, provider: value })}
                >
                  <SelectTrigger data-testid="select-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sobreip">SobreIP (VoIP Brasil)</SelectItem>
                    <SelectItem value="twilio">Twilio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.provider === 'sobreip' && (
                <>
                  <div className="bg-card border border-border rounded-lg p-3 mb-4">
                    <p className="text-sm text-muted-foreground">
                      <strong>🔒 Segurança:</strong> A senha SobreIP deve ser configurada como variável de ambiente <code className="bg-muted px-1 rounded">SOBREIP_PASSWORD</code> nos secrets do Replit.
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="sipUsername">Login SIP</Label>
                    <Input
                      id="sipUsername"
                      placeholder="Ex: 1151944022"
                      value={formData.sipUsername}
                      onChange={(e) => setFormData({ ...formData, sipUsername: e.target.value })}
                      data-testid="input-sip-username"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="sipServer">Servidor SIP</Label>
                    <Input
                      id="sipServer"
                      placeholder="voz.sobreip.com.br"
                      value={formData.sipServer}
                      onChange={(e) => setFormData({ ...formData, sipServer: e.target.value })}
                      data-testid="input-sip-server"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded border-gray-300"
                  data-testid="checkbox-is-default"
                />
                <Label htmlFor="isDefault" className="cursor-pointer">
                  Definir como número padrão
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-abmix-green text-black hover:bg-abmix-green/90"
                disabled={addMutation.isPending}
                data-testid="button-submit"
              >
                {addMutation.isPending ? 'Salvando...' : 'Salvar Número'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
