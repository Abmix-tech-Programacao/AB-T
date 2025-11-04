import { useCallStore } from '@/stores/useCallStore';

export function Sidebar() {
  const { selectedProvider, activeView, setActiveView } = useCallStore();

  const handleNavClick = (view: string) => {
    setActiveView(view);
  };

  return (
    <div className="w-64 bg-card border-r border-border flex-shrink-0">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-abmix-green to-green-400 flex items-center justify-center">
            <i className="fas fa-phone text-black text-sm"></i>
          </div>
          <h1 className="text-xl font-bold text-abmix-green">Abmix</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Sistema de Discagem</p>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2">
        <button 
          onClick={() => handleNavClick('discagem')}
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
            activeView === 'discagem' 
              ? 'bg-abmix-green/10 text-abmix-green' 
              : 'hover:bg-muted text-muted-foreground'
          }`}
          data-testid="nav-dial"
        >
          <i className="fas fa-phone-alt w-4"></i>
          <span className={activeView === 'discagem' ? 'font-medium' : ''}>Discagem</span>
        </button>
        
        <button 
          onClick={() => handleNavClick('vozes')}
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
            activeView === 'vozes' 
              ? 'bg-abmix-green/10 text-abmix-green' 
              : 'hover:bg-muted text-muted-foreground'
          }`}
          data-testid="nav-voices"
        >
          <i className="fas fa-volume-up w-4"></i>
          <span className={activeView === 'vozes' ? 'font-medium' : ''}>Vozes & TTS</span>
        </button>

        <button 
          onClick={() => handleNavClick('enhancer')}
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
            activeView === 'enhancer' 
              ? 'bg-abmix-green/10 text-abmix-green' 
              : 'hover:bg-muted text-muted-foreground'
          }`}
          data-testid="nav-enhancer"
        >
          <i className="fas fa-magic w-4"></i>
          <span className={activeView === 'enhancer' ? 'font-medium' : ''}>Voz Natural</span>
        </button>
        
        <button 
          onClick={() => handleNavClick('audio')}
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
            activeView === 'audio' 
              ? 'bg-abmix-green/10 text-abmix-green' 
              : 'hover:bg-muted text-muted-foreground'
          }`}
          data-testid="nav-audio"
        >
          <i className="fas fa-music w-4"></i>
          <span className={activeView === 'audio' ? 'font-medium' : ''}>Áudio & Efeitos</span>
        </button>
        
        <button 
          onClick={() => handleNavClick('chamadas')}
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
            activeView === 'chamadas' 
              ? 'bg-abmix-green/10 text-abmix-green' 
              : 'hover:bg-muted text-muted-foreground'
          }`}
          data-testid="nav-calls"
        >
          <i className="fas fa-phone-volume w-4"></i>
          <span className={activeView === 'chamadas' ? 'font-medium' : ''}>Chamadas</span>
        </button>

        <button 
          onClick={() => handleNavClick('numeros')}
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
            activeView === 'numeros' 
              ? 'bg-abmix-green/10 text-abmix-green' 
              : 'hover:bg-muted text-muted-foreground'
          }`}
          data-testid="nav-numbers"
        >
          <i className="fas fa-phone w-4"></i>
          <span className={activeView === 'numeros' ? 'font-medium' : ''}>Meus Números</span>
        </button>
        
        <button 
          onClick={() => handleNavClick('favoritos')}
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
            activeView === 'favoritos' 
              ? 'bg-abmix-green/10 text-abmix-green' 
              : 'hover:bg-muted text-muted-foreground'
          }`}
          data-testid="nav-favorites"
        >
          <i className="fas fa-star w-4"></i>
          <span className={activeView === 'favoritos' ? 'font-medium' : ''}>Favoritos</span>
        </button>
        
        <button 
          onClick={() => handleNavClick('gravacoes')}
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
            activeView === 'gravacoes' 
              ? 'bg-abmix-green/10 text-abmix-green' 
              : 'hover:bg-muted text-muted-foreground'
          }`}
          data-testid="nav-recordings"
        >
          <i className="fas fa-microphone w-4"></i>
          <span className={activeView === 'gravacoes' ? 'font-medium' : ''}>Gravações</span>
        </button>
        
        <button 
          onClick={() => handleNavClick('configuracoes')}
          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
            activeView === 'configuracoes' 
              ? 'bg-abmix-green/10 text-abmix-green' 
              : 'hover:bg-muted text-muted-foreground'
          }`}
          data-testid="nav-settings"
        >
          <i className="fas fa-cog w-4"></i>
          <span className={activeView === 'configuracoes' ? 'font-medium' : ''}>Configurações</span>
        </button>
      </nav>

      {/* Provider Status */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-dark-border/50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Provider</span>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-abmix-green rounded-full"></div>
              <span className="text-sm text-white capitalize" data-testid="provider-status">{selectedProvider}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
