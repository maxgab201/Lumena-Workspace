import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { ArrowRight, Sparkles, BookOpen, BrainCircuit, Share2, Search } from 'lucide-react';

export const Landing = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col relative selection:bg-accent/30 selection:text-accent-foreground">
      
      {/* Animated Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-1/2 -left-1/2 w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/10 via-background to-background opacity-60" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[150px] mix-blend-screen" />
      </div>
      
      {/* Premium Topbar */}
      <header className="h-20 flex items-center justify-between px-6 lg:px-12 w-full z-50 sticky top-0 bg-background/40 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center space-x-3 cursor-pointer">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent/60 text-white font-bold flex items-center justify-center shadow-lg shadow-accent/20">
            L
          </div>
          <span className="font-heading font-semibold text-xl tracking-tight text-foreground">Lumena</span>
        </div>
        <nav className="hidden md:flex items-center space-x-8">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
          <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">How it works</a>
          <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
        </nav>
        <div className="flex items-center space-x-4">
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground" asChild><Link to="/auth">Sign In</Link></Button>
          <Button className="rounded-full px-6 shadow-md shadow-accent/20" asChild><Link to="/dashboard">Get Started <ArrowRight className="ml-2 w-4 h-4" /></Link></Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col z-10 w-full max-w-7xl mx-auto">
        <section className="flex flex-col items-center justify-center min-h-[85vh] p-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-4xl space-y-8 relative"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm text-accent font-medium backdrop-blur-md mb-6"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Introducing Lumena AI Knowledge Engine
            </motion.div>
            
            <h1 className="text-5xl sm:text-6xl md:text-8xl font-heading font-bold text-foreground tracking-tighter leading-[1.05]">
              Intelligence for <br className="hidden md:block"/> your <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-accent/80 to-accent">documents.</span>
            </h1>
            
            <p className="text-lg md:text-2xl text-muted-foreground max-w-2xl mx-auto font-normal leading-relaxed">
              Upload complex PDFs, books, and research. Extract insights, build mind maps, and chat with your materials in a unified, professional workspace.
            </p>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-base rounded-full shadow-xl shadow-accent/20 font-medium" asChild>
                <Link to="/dashboard">Start Building Knowledge</Link>
              </Button>
              <Button variant="outline" size="lg" className="w-full sm:w-auto h-14 px-8 text-base rounded-full border-muted-foreground/30 hover:bg-secondary font-medium" asChild>
                <Link to="/auth">Book a Demo</Link>
              </Button>
            </motion.div>
          </motion.div>
        </section>

        {/* Features Placeholder */}
        <section id="features" className="py-24 px-6 relative border-t border-white/5">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-heading font-bold tracking-tight">Powerful tools, simple interface</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Everything you need to digest and analyze complex information.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { title: "Smart OCR", icon: <Search />, desc: "Instantly digitize scanned documents." },
              { title: "Knowledge Graphs", icon: <Share2 />, desc: "Visualize connections between concepts." },
              { title: "AI Assistant", icon: <BrainCircuit />, desc: "Chat with your documents securely." },
            ].map((f, i) => (
              <motion.div 
                key={i} 
                whileHover={{ y: -5 }}
                className="p-8 rounded-2xl border border-white/10 bg-secondary/30 backdrop-blur-sm shadow-xl flex flex-col items-center text-center space-y-4 transition-all hover:border-accent/50"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/20 text-accent flex items-center justify-center">
                  {f.icon}
                </div>
                <h3 className="text-xl font-semibold">{f.title}</h3>
                <p className="text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* How it Works Placeholder */}
        <section id="how-it-works" className="py-24 px-6 border-t border-white/5 bg-secondary/10">
           <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-heading font-bold tracking-tight">How it works</h2>
          </div>
          <div className="max-w-4xl mx-auto p-12 border border-white/10 rounded-3xl bg-card shadow-2xl relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
             <div className="flex flex-col items-center text-center opacity-60">
                <BookOpen className="w-16 h-16 mb-6 text-muted-foreground" />
                <h3 className="text-2xl font-medium mb-2">Interactive Demo Area</h3>
                <p>Placeholder for the interactive product walkthrough.</p>
             </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-white/10 text-center flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground max-w-7xl mx-auto w-full">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
             <div className="w-6 h-6 rounded bg-accent/20 text-accent flex items-center justify-center font-bold text-xs">L</div>
             <span className="font-medium text-foreground">Lumena Workspace</span>
          </div>
          <div className="space-x-6">
            <Link to="/legal" className="hover:text-foreground">Terms</Link>
            <Link to="/legal" className="hover:text-foreground">Privacy</Link>
            <a href="#" className="hover:text-foreground">Twitter</a>
          </div>
        </footer>
      </main>
    </div>
  );
};
