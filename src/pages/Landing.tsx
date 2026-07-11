import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';

export const Landing = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Premium subtle gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent/15 via-background to-background -z-10" />
      
      {/* Topbar minimalist */}
      <header className="h-16 flex items-center justify-between px-6 lg:px-12 max-w-7xl mx-auto w-full z-10 relative">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-md bg-accent text-white font-bold flex items-center justify-center">L</div>
          <span className="font-heading font-medium text-foreground tracking-tight">Lumena</span>
        </div>
        <nav className="flex items-center space-x-4">
          <Button variant="ghost" asChild><Link to="/auth">Sign In</Link></Button>
          <Button asChild><Link to="/dashboard">Get Started</Link></Button>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 relative mt-[-4rem]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-4xl space-y-8"
        >
          <div className="inline-flex items-center rounded-full border border-accent/20 bg-accent/5 px-3 py-1 text-sm text-accent font-medium backdrop-blur-sm mb-4">
            <span className="flex h-2 w-2 rounded-full bg-accent mr-2 animate-pulse"></span>
            Introducing Lumena Workspace 1.0
          </div>
          
          <h1 className="text-5xl md:text-7xl font-heading font-bold text-foreground tracking-tight leading-[1.1]">
            Where documents <br className="hidden md:block"/> become <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-accent/70">knowledge</span>.
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-normal">
            Transform your PDFs and research into an interactive learning environment. Extract insights, build mind maps, and master your materials with AI.
          </p>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base shadow-lg shadow-accent/20" asChild>
              <Link to="/dashboard">Start Learning Now</Link>
            </Button>
            <Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8 text-base" asChild>
              <Link to="/auth">View Demo</Link>
            </Button>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};
