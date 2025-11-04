import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useState, useEffect } from "react";
import Home from "@/pages/Home";
import VoIPNumbersPage from "@/pages/VoIPNumbersPage";
import NotFound from "@/pages/not-found";
import { SetupModal } from "@/components/SetupModal";

function Router() {
  console.log(`[ROUTER] Base URL: /`); // Debug
  
  return (
    <WouterRouter base="">

      <Switch>
        <Route path="/" component={Home} />
        <Route path="/meus-numeros" component={VoIPNumbersPage} />
        <Route path="~/*" component={NotFound} />
      </Switch>
    </WouterRouter>
  );
}

function App() {
  // Temporariamente desabilitado - modal de configuração removido
  const [isSetupComplete, setIsSetupComplete] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);

  // useEffect(() => {
  //   // Check if setup is complete
  //   const setupComplete = localStorage.getItem('abmix_setup_complete');
  //   if (setupComplete === 'true') {
  //     setIsSetupComplete(true);
  //   } else {
  //     setShowSetupModal(true);
  //   }
  // }, []);

  const handleSetupComplete = () => {
    setIsSetupComplete(true);
    setShowSetupModal(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <div>
            {/* Modal de configuração temporariamente desabilitado */}
            {/* <SetupModal 
              isOpen={showSetupModal} 
              onComplete={handleSetupComplete}
            /> */}
            
            <Router />
            
            <Toaster />
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
