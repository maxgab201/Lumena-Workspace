import { AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';

export const GenericError = ({ error, reset }: { error?: Error; reset?: () => void }) => {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-background text-foreground p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">Something went wrong</h1>
        <p className="text-muted-foreground">
          {error?.message || "An unexpected error occurred while loading this page."}
        </p>
        <div className="pt-4 flex justify-center gap-4">
          <Button onClick={() => window.location.href = '/'}>Go Home</Button>
          {reset && <Button variant="outline" onClick={reset}>Try Again</Button>}
        </div>
      </div>
    </div>
  );
};
