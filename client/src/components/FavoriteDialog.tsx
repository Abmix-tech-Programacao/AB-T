import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/services/api';
import { validateE164, formatPhoneNumber } from '@/utils/validation';
import type { Favorite } from '@shared/schema';

interface FavoriteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  favorite: Favorite | null;
  onClose: () => void;
}

export function FavoriteDialog({ open, onOpenChange, favorite, onClose }: FavoriteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    name: '',
    number: '',
    tags: '',
    notes: '',
  });

  // Reset form when dialog opens/closes or favorite changes
  useEffect(() => {
    if (open) {
      if (favorite) {
        setFormData({
          name: favorite.name,
          number: favorite.number,
          tags: favorite.tags || '',
          notes: favorite.notes || '',
        });
      } else {
        setFormData({
          name: '',
          number: '',
          tags: '',
          notes: '',
        });
      }
    }
  }, [open, favorite]);

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.createFavorite(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/favorites'] });
      toast({
        title: "Favorito adicionado",
        description: `${formData.name} foi adicionado aos favoritos`,
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Erro ao adicionar favorito",
        description: error instanceof Error ? error.message : "Falha na operação",
        variant: "destructive",
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => api.updateFavorite(favorite!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/favorites'] });
      toast({
        title: "Favorito atualizado",
        description: `${formData.name} foi atualizado`,
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar favorito",
        description: error instanceof Error ? error.message : "Falha na operação",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, preencha o nome do favorito",
        variant: "destructive",
      });
      return;
    }

    // Remove caracteres não numéricos
    const cleanNumber = formData.number.replace(/[^\d]/g, '');
    
    // Validar: deve ter 10 ou 11 dígitos (DDD + número)
    if (cleanNumber.length < 10 || cleanNumber.length > 11) {
      toast({
        title: "Número inválido",
        description: "Por favor, insira apenas DDD + número (ex: 11999999999)",
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      ...formData,
      number: cleanNumber,
    };

    if (favorite) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleInputChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-dark-surface border-dark-border text-white">
        <DialogHeader>
          <DialogTitle>
            {favorite ? 'Editar Favorito' : 'Adicionar Favorito'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="favorite-name">Nome *</Label>
            <Input
              id="favorite-name"
              placeholder="Ex: Suporte Técnico"
              value={formData.name}
              onChange={handleInputChange('name')}
              className="bg-dark-bg border-dark-border"
              data-testid="favorite-name-input"
              required
            />
          </div>

          <div>
            <Label htmlFor="favorite-number">Número (DDD + Número) *</Label>
            <Input
              id="favorite-number"
              placeholder="11999999999"
              value={formData.number}
              onChange={handleInputChange('number')}
              className="bg-dark-bg border-dark-border font-mono"
              data-testid="favorite-number-input"
              required
            />
          </div>

          <div>
            <Label htmlFor="favorite-tags">Tags</Label>
            <Input
              id="favorite-tags"
              placeholder="Ex: trabalho, suporte, vendas"
              value={formData.tags}
              onChange={handleInputChange('tags')}
              className="bg-dark-bg border-dark-border"
              data-testid="favorite-tags-input"
            />
          </div>

          <div>
            <Label htmlFor="favorite-notes">Observações</Label>
            <Textarea
              id="favorite-notes"
              placeholder="Notas adicionais sobre este contato..."
              value={formData.notes}
              onChange={handleInputChange('notes')}
              className="bg-dark-bg border-dark-border h-20 resize-none"
              data-testid="favorite-notes-input"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-dark-border text-white hover:bg-dark-border"
              data-testid="cancel-favorite-button"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-abmix-green text-black hover:bg-abmix-green/90"
              data-testid="save-favorite-button"
            >
              {isLoading ? 'Salvando...' : (favorite ? 'Atualizar' : 'Adicionar')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
