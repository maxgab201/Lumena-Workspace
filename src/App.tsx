import { useEffect } from 'react';
import { useUserStore } from './stores/userStore';
import { useUiStore } from './stores/uiStore';
import { AppProviders } from './providers/AppProviders';

function App() {
  useEffect(() => {
    // Hide loading screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      setTimeout(() => {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
          loadingScreen.remove();
        }, 300);
      }, 500);
    }
  }, []);

  useEffect(() => {
    const cleanupAuth = useUserStore.getState().initialize();
    void useUiStore.getState().loadSettings();

    return () => {
      cleanupAuth();
    };
  }, []);

  return <AppProviders />;
}

export default App;
