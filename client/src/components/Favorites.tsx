import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCallStore } from '@/stores/useCallStore';
import { api } from '@/services/api';
import { FavoriteDialog } from '.';
import type { Favorite } from '@shared/schema';

export function Favorites() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setPhoneNumber } = useCallStore();
  const [editingFavorite, setEditingFavorite] = useState<Favorite | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ['/api/favorites'],
    queryFn: () => api.getFavorites(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteFavorite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/favorites'] });
      toast({
        title: "Favorito removido",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover favorito",
        description: error instanceof Error ? error.message : "Falha na operação",
        variant: "destructive",
      });
    }
  });

  const handleDialFavorite = (favorite: Favorite) => {
    // Set the number in the dialer component
    setPhoneNumber(favorite.number);
    
    // Also trigger the dialer to update its local state
    const event = new CustomEvent('setDialerNumber', { 
      detail: { number: favorite.number } 
    });
    window.dispatchEvent(event);
    
    toast({
      title: "Número preenchido",
      description: `${favorite.name}: ${favorite.number}`,
    });
  };

  const handleEditFavorite = (favorite: Favorite) => {
    setEditingFavorite(favorite);
    setIsDialogOpen(true);
  };

  const handleDeleteFavorite = (favorite: Favorite) => {
    if (window.confirm(`Deseja realmente remover ${favorite.name}?`)) {
      deleteMutation.mutate(favorite.id);
    }
  };

  const handleAddFavorite = () => {
    setEditingFavorite(null);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingFavorite(null);
  };

  if (isLoading) {
    return (
      <div className="bg-dark-surface rounded-xl p-6 border border-dark-border h-fit">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Favoritos</h3>
        </div>
        <div className="text-center text-gray-400">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="bg-dark-surface rounded-xl p-6 border border-dark-border h-fit">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Favoritos</h3>
        <Button
          onClick={handleAddFavorite}
          className="bg-abmix-green text-black p-2 rounded-lg hover:bg-abmix-green/90 transition-colors"
          data-testid="add-favorite-button"
        >
          <i className="fas fa-plus"></i>
        </Button>
      </div>

      <div className="space-y-3">
        {favorites.length === 0 ? (
          <div className="text-center text-gray-400 py-4">
            <i className="fas fa-star text-2xl mb-2 block"></i>
            Nenhum favorito adicionado
          </div>
        ) : (
          favorites.map((favorite: Favorite) => (
            <div
              key={favorite.id}
              className="bg-dark-bg rounded-lg p-4 border border-dark-border"
              data-testid={`favorite-${favorite.id}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{favorite.name}</h4>
                  <p className="text-sm text-gray-400 font-mono">{favorite.number}</p>
                  {favorite.notes && (
                    <p className="text-xs text-gray-500 mt-1">{favorite.notes}</p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={() => handleDialFavorite(favorite)}
                    className="text-abmix-green hover:bg-abmix-green/10 p-2 rounded transition-colors"
                    variant="ghost"
                    size="sm"
                    data-testid={`dial-favorite-${favorite.id}`}
                  >
                    <i className="fas fa-phone"></i>
                  </Button>
                  <Button
                    onClick={() => handleEditFavorite(favorite)}
                    className="text-blue-400 hover:bg-blue-400/10 p-2 rounded transition-colors"
                    variant="ghost"
                    size="sm"
                    data-testid={`edit-favorite-${favorite.id}`}
                  >
                    <i className="fas fa-edit"></i>
                  </Button>
                  <Button
                    onClick={() => handleDeleteFavorite(favorite)}
                    disabled={deleteMutation.isPending}
                    className="text-red-400 hover:bg-red-400/10 p-2 rounded transition-colors"
                    variant="ghost"
                    size="sm"
                    data-testid={`delete-favorite-${favorite.id}`}
                  >
                    <i className="fas fa-trash"></i>
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <FavoriteDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        favorite={editingFavorite}
        onClose={handleDialogClose}
      />
    </div>
  );
}
