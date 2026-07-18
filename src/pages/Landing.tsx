
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { 
  ArrowRight, 
  Sparkles, 
  BookOpen, 
  BrainCircuit, 
  Share2, 
  Search, 
  Check, 
  Zap, 
  ArrowUpRight, 
  Star 
} from 'lucide-react';

export const Landing = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col relative selection:bg-accent/30 selection:text-accent-foreground overflow-x-hidden">
      {/* Animated Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-1/2 -left-1/2 w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/10 via-background to-background opacity-60" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[120px] mix-blend-screen animate-blob" />
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[150px] mix-blend-screen animate-blob" style={{ animationDelay: '2s' }} />
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
      <main className="flex-1 flex flex-col z-10 w-full">
        <section className="flex flex-col items-center justify-center min-h-[85vh] p-6 text-center max-w-7xl mx-auto">
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
              <Sparkles className="w-4 h-4 mr-2" /> Introducing Lumena AI Knowledge Engine
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

        {/* Product Showcase Section */}
        <section className="px-6 py-12 max-w-7xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-3xl border border-white/10 bg-card/40 backdrop-blur-xl p-4 md:p-6 shadow-2xl overflow-hidden group"
          >
            {/* Glowing background behind mockup */}
            <div className="absolute -inset-10 bg-gradient-to-tr from-accent/20 via-transparent to-accent/10 rounded-3xl opacity-50 blur-2xl group-hover:opacity-60 transition-opacity" />
            
            {/* Interactive Mockup Container */}
            <div className="relative rounded-2xl border border-white/5 bg-background/80 overflow-hidden shadow-inner aspect-[16/10] flex flex-col">
              {/* Window Controls */}
              <div className="h-10 border-b border-white/5 bg-secondary/20 flex items-center px-4 justify-between">
                <div className="flex items-center space-x-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="text-[11px] text-muted-foreground font-mono bg-background/50 border border-white/5 px-4 py-0.5 rounded-md">
                  app.lumena.workspace
                </div>
                <div className="w-12" /> {/* Spacer */}
              </div>

              {/* Mockup Workspace UI */}
              <div className="flex-1 flex overflow-hidden">
                {/* Mockup Sidebar */}
                <div className="w-48 border-r border-white/5 bg-background/30 p-3 space-y-4 hidden md:block">
                  <div className="h-6 w-full rounded bg-white/5" />
                  <div className="space-y-2">
                    <div className="h-5 w-4/5 rounded bg-accent/20" />
                    <div className="h-5 w-3/4 rounded bg-white/5" />
                    <div className="h-5 w-5/6 rounded bg-white/5" />
                  </div>
                  <div className="pt-4 border-t border-white/5 space-y-2">
                    <div className="h-4 w-1/2 rounded bg-white/5" />
                    <div className="h-5 w-4/5 rounded bg-white/5" />
                    <div className="h-5 w-3/4 rounded bg-white/5" />
                  </div>
                </div>

                {/* Mockup Main Content */}
                <div className="flex-1 flex overflow-hidden">
                  {/* Mockup PDF Viewer Area */}
                  <div className="flex-1 bg-secondary/10 p-6 flex flex-col space-y-4">
                    <div className="h-6 w-1/3 rounded bg-white/10" />
                    <div className="flex-1 rounded-xl border border-white/5 bg-background/90 p-6 space-y-4 shadow-sm overflow-hidden relative">
                      {/* Stylized PDF Document text lines */}
                      <div className="absolute top-0 right-0 p-3"><BookOpen size={16} className="text-accent" /></div>
                      <div className="h-4 w-3/4 rounded bg-white/10" />
                      <div className="h-4 w-5/6 rounded bg-white/5" />
                      <div className="h-4 w-2/3 rounded bg-white/5" />
                      <div className="h-4 w-full rounded bg-white/5" />
                      <div className="h-4 w-11/12 rounded bg-white/5" />
                      
                      {/* Highlight effect */}
                      <div className="bg-accent/10 border-l-2 border-accent p-3 rounded-r-lg space-y-2 my-4">
                        <div className="h-3 w-full rounded bg-accent/20" />
                        <div className="h-3 w-5/6 rounded bg-accent/20" />
                      </div>

                      <div className="h-4 w-4/5 rounded bg-white/5" />
                      <div className="h-4 w-3/4 rounded bg-white/5" />
                    </div>
                  </div>

                  {/* Mockup Chat Assistant Panel */}
                  <div className="w-80 border-l border-white/5 bg-background/60 p-4 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2 border-b border-white/5 pb-2">
                        <div className="w-5 h-5 rounded bg-accent flex items-center justify-center text-[10px] text-white font-bold">A</div>
                        <span className="text-xs font-semibold">Lumena AI Assistant</span>
                      </div>
                      <div className="space-y-3">
                        <div className="bg-secondary/40 p-2.5 rounded-lg text-[11px] text-muted-foreground max-w-[85%] font-medium">
                          Explain the core concept of page 4.
                        </div>
                        <div className="bg-accent/10 border border-accent/20 p-2.5 rounded-lg text-[11px] text-foreground max-w-[85%] self-end ml-auto font-medium">
                          Based on page 4, the primary architecture uses a decentralized neural system designed to...
                        </div>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="h-8 w-full rounded-md bg-secondary/30 border border-white/5 px-2 flex items-center text-[10px] text-muted-foreground justify-between">
                        Ask a question...
                        <ArrowRight size={12} className="text-accent" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Stats Counter Section */}
        <section className="py-20 px-6 max-w-7xl mx-auto w-full border-y border-white/5 bg-secondary/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-accent/5 via-transparent to-transparent opacity-50" />
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 max-w-5xl mx-auto text-center">
            {[
              { number: "10,000+", label: "Documents Analyzed" },
              { number: "500k+", label: "Questions Answered" },
              { number: "99.9%", label: "Accuracy Rate" },
              { number: "150+", label: "Countries Supported" },
            ].map((stat, i) => (
              <div key={i} className="space-y-2">
                <div className="text-4xl md:text-5xl font-heading font-extrabold text-foreground tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
                  {stat.number}
                </div>
                <div className="text-xs md:text-sm text-muted-foreground font-medium uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 px-6 relative border-t border-white/5">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-heading font-bold tracking-tight">Powerful tools, simple interface</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Everything you need to digest and analyze complex information.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { title: "Smart OCR & PDF Parser", icon: <Search />, desc: "Instantly digitize and search scanned documents, handwritten notes, and full-length PDFs." },
              { title: "Knowledge Graphs", icon: <Share2 />, desc: "Visualize and map connections between concepts automatically generated from your sources." },
              { title: "AI Research Assistant", icon: <BrainCircuit />, desc: "Ask complex questions, generate summaries, and synthesize info from multiple documents at once." },
            ].map((f, i) => (
              <motion.div 
                key={i} 
                whileHover={{ y: -5 }} 
                className="p-8 rounded-2xl glass-card flex flex-col items-center text-center space-y-4 border border-white/5 bg-card/20 backdrop-blur-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/20 text-accent flex items-center justify-center">
                  {f.icon}
                </div>
                <h3 className="text-xl font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* How it Works Section */}
        <section id="how-it-works" className="py-24 px-6 border-t border-white/5 bg-secondary/10 relative overflow-hidden">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-heading font-bold tracking-tight">How it works</h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">Three simple steps to transform your raw documents into structured intelligence.</p>
          </div>
          
          <div className="max-w-5xl mx-auto relative">
            {/* Connecting line for desktop */}
            <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-gradient-to-r from-accent/10 via-accent/30 to-accent/10 -translate-y-1/2 hidden md:block z-0" />
            
            <div className="grid md:grid-cols-3 gap-8 relative z-10">
              {[
                { step: "01", title: "Import Source Materials", desc: "Drag and drop your PDFs, research papers, textbooks, or notes. We securely ingest and process them in seconds." },
                { step: "02", title: "AI Analysis & Indexing", desc: "Our engine parses the layout, charts, tables, and text, building a semantic map of your source material." },
                { step: "03", title: "Interact & Synthesize", desc: "Chat with documents, organize them in mind maps, compile notes, and instantly export podcasts or presentations." }
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center text-center bg-card/30 border border-white/5 rounded-2xl p-8 backdrop-blur-md relative overflow-hidden">
                  <div className="absolute -top-4 -right-4 text-7xl font-bold font-mono opacity-5 text-white select-none">
                    {item.step}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-accent/20 text-accent border border-accent/30 font-bold flex items-center justify-center text-sm mb-6">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-bold mb-3">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 px-6 border-t border-white/5 max-w-7xl mx-auto w-full">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-heading font-bold tracking-tight">Flexible Plans</h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">Get started for free, then upgrade to premium features when you're ready.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
            {/* Free Card */}
            <div className="rounded-3xl border border-white/5 bg-card/20 backdrop-blur-md p-8 md:p-10 flex flex-col justify-between space-y-8 relative overflow-hidden">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-foreground">Free</h3>
                  <p className="text-sm text-muted-foreground mt-1">Essential tools for personal study.</p>
                </div>
                <div className="flex items-baseline">
                  <span className="text-4xl md:text-5xl font-bold font-heading">$0</span>
                  <span className="text-muted-foreground text-sm ml-2">/ month</span>
                </div>
                <ul className="space-y-3.5 pt-4 border-t border-white/5">
                  {[
                    "Upload up to 3 PDFs / month",
                    "Basic AI Document Chat",
                    "50 MB secure workspace storage",
                    "Standard OCR processing"
                  ].map((feat, i) => (
                    <li key={i} className="flex items-center text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-accent/80 mr-3 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button variant="outline" className="w-full rounded-full py-6 border-white/10 hover:bg-secondary font-semibold" asChild>
                <Link to="/dashboard">Get Started</Link>
              </Button>
            </div>

            {/* Pro Card */}
            <div className="rounded-3xl border border-accent/40 bg-accent/5 backdrop-blur-md p-8 md:p-10 flex flex-col justify-between space-y-8 relative overflow-hidden shadow-xl shadow-accent/5">
              {/* Premium Glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                Most Popular
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-foreground">Pro</h3>
                    <Zap className="w-4 h-4 text-accent" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Ultimate power for professional work.</p>
                </div>
                <div className="flex items-baseline">
                  <span className="text-4xl md:text-5xl font-bold font-heading">$15</span>
                  <span className="text-muted-foreground text-sm ml-2">/ month</span>
                </div>
                <ul className="space-y-3.5 pt-4 border-t border-white/5">
                  {[
                    "Unlimited PDF & Document Uploads",
                    "Advanced Multi-Document AI Engine",
                    "Full Knowledge Graphs & Mind Mapping",
                    "10 GB secure workspace storage",
                    "Generate AI Audio Podcasts (Phase 11)",
                    "Create Interactive Infographics & Slides",
                    "Priority OCR & Processing Queue"
                  ].map((feat, i) => (
                    <li key={i} className="flex items-center text-sm text-foreground font-medium">
                      <Check className="w-4 h-4 text-accent mr-3 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button className="w-full rounded-full py-6 bg-accent hover:bg-accent/90 text-white font-semibold shadow-lg shadow-accent/20" asChild>
                <Link to="/billing">Upgrade to Pro</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Testimonials/Social Proof Section */}
        <section className="py-24 px-6 border-t border-white/5 max-w-7xl mx-auto w-full bg-secondary/5 relative">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-heading font-bold tracking-tight">Loved by researchers and creators</h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">Here is how professionals leverage Lumena to speed up their research workflows.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              {
                text: "Lumena completely transformed my PhD research. Managing 200+ academic papers and connecting ideas across them is now effortless.",
                name: "Dr. Sarah Jenkins",
                role: "Senior AI Researcher",
                rating: 5
              },
              {
                text: "The audio podcast feature is a lifesaver. I can drop 3 long technical papers in the workspace, and listen to a synthesis while commuting.",
                name: "Julian Rivera",
                role: "Lead Software Architect",
                rating: 5
              },
              {
                text: "An incredibly elegant tool. The UI is beautiful, fast, and light. It's the cleanest document assistant app on the market today.",
                name: "Clara Vance",
                role: "Science Writer & Journalist",
                rating: 5
              }
            ].map((test, i) => (
              <div key={i} className="p-8 rounded-2xl border border-white/5 bg-card/10 backdrop-blur-sm flex flex-col justify-between space-y-6">
                <div className="flex space-x-1">
                  {Array.from({ length: test.rating }).map((_, r) => (
                    <Star key={r} size={14} className="fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground italic leading-relaxed">"{test.text}"</p>
                <div className="border-t border-white/5 pt-4">
                  <div className="font-semibold text-sm text-foreground">{test.name}</div>
                  <div className="text-xs text-muted-foreground">{test.role}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Polished CTA Section */}
        <section className="py-28 px-6 border-t border-white/5 relative overflow-hidden w-full text-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-accent/15 via-transparent to-transparent opacity-80" />
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto space-y-8 relative z-10"
          >
            <h2 className="text-4xl md:text-6xl font-heading font-bold tracking-tight">Ready to build your personal knowledge engine?</h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">Join thousands of students, researchers, and professional writers today.</p>
            <Button size="lg" className="h-14 px-10 text-base rounded-full shadow-2xl shadow-accent/30 font-semibold" asChild>
              <Link to="/dashboard">Get Started for Free <ArrowUpRight className="ml-2 w-4 h-4" /></Link>
            </Button>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-white/10 text-center flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground max-w-7xl mx-auto w-full z-10">
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