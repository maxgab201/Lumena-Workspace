import { useEffect } from 'react';
import { AppProviders } from './providers/AppProviders';
import { useUserStore } from './stores/userStore';

function App() {
  const initialize = useUserStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <AppProviders />;
}

export default App;
