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
    useUserStore.getState().initialize();
    useUiStore.getState().loadSettings();
  }, []);

  return <AppProviders />;
}

export default App;
