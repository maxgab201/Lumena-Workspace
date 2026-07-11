import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export const Auth = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/10 rounded-full blur-3xl -z-10 pointer-events-none" />
      
      <div className="w-full max-w-sm border border-border/50 bg-card/50 backdrop-blur-xl rounded-2xl p-8 shadow-2xl text-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent/80 text-white font-bold flex items-center justify-center mx-auto mb-6 text-xl shadow-inner">
          L
        </div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight mb-2">Welcome Back</h1>
        <p className="text-muted-foreground mb-8 text-sm">Sign in to your Lumena account</p>
        
        <div className="space-y-3">
          <Button variant="outline" className="w-full h-11 text-sm bg-background/50 hover:bg-secondary">
            Continue with GitHub
          </Button>
          <Button variant="outline" className="w-full h-11 text-sm bg-background/50 hover:bg-secondary">
            Continue with Google
          </Button>
        </div>
        
        <div className="mt-8 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors underline underline-offset-4">Back to Home</Link>
        </div>
      </div>
    </div>
  );
};
