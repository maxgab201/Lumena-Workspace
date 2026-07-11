import { Spinner } from '../ui/Spinner';

export const LoadingPage = () => {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4 opacity-70">
        <Spinner size="lg" />
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading Workspace...</p>
      </div>
    </div>
  );
};
