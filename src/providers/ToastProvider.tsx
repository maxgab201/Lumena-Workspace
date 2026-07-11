import { Toaster } from 'sonner';

export const ToastProvider = () => {
  return (
    <Toaster 
      position="bottom-right" 
      toastOptions={{
        className: 'bg-card border border-border text-foreground shadow-lg',
        descriptionClassName: 'text-muted-foreground',
      }}
    />
  );
};
