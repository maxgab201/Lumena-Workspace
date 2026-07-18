import { useState } from 'react';
import { PageContainer } from '../components/ui/PageContainer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useBillingStore } from '../stores/billingStore';
import { PLANS } from '../types/billing';
import { CheckIcon, Zap, Activity, PieChart, FileText, MessageSquare, ImageIcon } from 'lucide-react';
import { UpgradeModal } from '../components/billing/UpgradeModal';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

export const Billing = () => {
  const { currentPlan, creditsRemaining, transactions } = useBillingStore();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const plan = PLANS[currentPlan];
  const usagePercentage = Math.min(100, Math.max(0, 100 - (creditsRemaining / plan.monthlyCredits) * 100));

  // Mock breakdown data
  const breakdown = [
    { label: 'OCR Processing', value: 45, icon: <FileText size={14} />, color: 'bg-blue-500' },
    { label: 'Chat Engine', value: 30, icon: <MessageSquare size={14} />, color: 'bg-purple-500' },
    { label: 'Vision AI', value: 25, icon: <ImageIcon size={14} />, color: 'bg-emerald-500' }
  ];

  return (
    <PageContainer>
      <header className="space-y-1 mb-8">
        <h1 className="text-3xl font-heading font-semibold tracking-tight">Billing & Credits</h1>
        <p className="text-muted-foreground">Manage your subscription, view credit usage, and upgrade your plan.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-12 mb-8">
        {/* Current Plan Card */}
        <Card className="border-white/5 bg-card/40 backdrop-blur-md shadow-sm md:col-span-4 flex flex-col justify-between overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              Current Plan: <span className="text-accent">{plan.name}</span>
            </CardTitle>
            <CardDescription>
              {currentPlan === 'free' ? 'You are currently on the free tier.' : 'You have an active Pro subscription.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold mb-6 font-heading tracking-tight">
              ${plan.price}<span className="text-lg text-muted-foreground font-normal">/mo</span>
            </div>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-semibold text-foreground">Credit Usage</span>
                  <span className="text-muted-foreground font-mono">{plan.monthlyCredits - creditsRemaining} / {plan.monthlyCredits}</span>
                </div>
                <div className="h-3 w-full bg-secondary/40 overflow-hidden rounded-full border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${usagePercentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full shadow-inner", 
                      usagePercentage > 90 ? "bg-destructive" : usagePercentage > 75 ? "bg-orange-500" : "bg-accent"
                    )}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center">
                  <Activity size={12} className="mr-1.5" /> {creditsRemaining} credits remaining this cycle
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="pt-2">
            {currentPlan === 'free' ? (
               <Button 
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-full shadow-md shadow-accent/20 h-11 font-semibold" 
                onClick={() => setIsUpgradeModalOpen(true)}
              >
                <Zap className="w-4 h-4 mr-2 fill-current" /> Upgrade to Pro
              </Button>
            ) : (
              <Button variant="outline" className="w-full text-foreground border-white/10 rounded-full h-11" disabled>
                Manage Subscription (Coming Soon)
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Usage Breakdown */}
        <Card className="border-white/5 bg-card/40 backdrop-blur-md shadow-sm md:col-span-8 flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart size={18} className="text-muted-foreground" /> Usage Breakdown
            </CardTitle>
            <CardDescription>How your credits have been spent this billing cycle.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center pb-8">
            <div className="space-y-6">
              {/* Visual Bar */}
              <div className="flex h-6 rounded-full overflow-hidden border border-white/5 bg-secondary/20 w-full mb-8">
                {breakdown.map((item, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ width: 0 }}
                    animate={{ width: `${item.value}%` }}
                    transition={{ delay: 0.2 * i, duration: 0.8, ease: "easeOut" }}
                    className={item.color}
                    title={`${item.label} (${item.value}%)`}
                  />
                ))}
              </div>
              
              {/* Legend */}
              <div className="grid grid-cols-3 gap-4">
                {breakdown.map((item, i) => (
                  <div key={i} className="flex flex-col space-y-2 p-3 rounded-xl border border-white/5 bg-secondary/10">
                    <div className="flex items-center space-x-2 text-sm font-medium text-foreground">
                      <div className={cn("w-6 h-6 rounded-md flex items-center justify-center text-white", item.color)}>
                        {item.icon}
                      </div>
                      <span>{item.label}</span>
                    </div>
                    <div className="text-2xl font-bold font-mono text-muted-foreground ml-8">{item.value}%</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Comparison Section */}
      <section className="mb-8 border border-white/5 bg-card/20 rounded-3xl p-8 backdrop-blur-md shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-heading font-bold">Compare Plans</h2>
            <p className="text-muted-foreground text-sm mt-1">Find the perfect workspace plan for your research.</p>
          </div>
          
          <div className="inline-flex bg-secondary/50 rounded-full p-1 border border-white/5 self-start">
            <button 
              onClick={() => setBillingCycle('monthly')}
              className={cn("px-4 py-1.5 rounded-full text-sm font-medium transition-colors", billingCycle === 'monthly' ? "bg-background text-foreground shadow-sm border border-white/5" : "text-muted-foreground hover:text-foreground")}
            >
              Monthly
            </button>
            <button 
              onClick={() => setBillingCycle('annual')}
              className={cn("px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center space-x-1.5", billingCycle === 'annual' ? "bg-background text-foreground shadow-sm border border-white/5" : "text-muted-foreground hover:text-foreground")}
            >
              <span>Annual</span>
              <span className="text-[9px] bg-accent/20 text-accent uppercase font-bold px-1.5 py-0.5 rounded">Save 20%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl border border-white/5 bg-background/40">
            <h4 className="font-semibold text-lg mb-4">{PLANS.free.name}</h4>
            <div className="text-3xl font-bold font-heading mb-6">$0<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
            <ul className="space-y-3">
              {PLANS.free.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <CheckIcon className="w-4 h-4 text-accent/70 shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="p-6 rounded-2xl border border-accent/30 bg-accent/5 shadow-[0_0_20px_rgba(var(--accent-hsl),0.05)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <h4 className="font-semibold text-lg mb-4 text-foreground flex items-center justify-between">
                {PLANS.pro.name}
                <span className="text-[10px] bg-accent text-white uppercase font-bold tracking-widest px-2 py-0.5 rounded-full">Pro</span>
              </h4>
              <div className="text-3xl font-bold font-heading mb-6">
                ${billingCycle === 'monthly' ? PLANS.pro.price : Math.floor(PLANS.pro.price * 0.8)}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                {billingCycle === 'annual' && <span className="block text-xs font-normal text-accent mt-1">Billed annually</span>}
              </div>
              <ul className="space-y-3">
                {PLANS.pro.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm font-medium">
                    <CheckIcon className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Transaction History */}
      <Card className="border-white/5 bg-card/40 backdrop-blur-md shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             Transaction History
          </CardTitle>
          <CardDescription>Recent credit grants, purchases, and usage.</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12 border border-white/5 border-dashed rounded-xl bg-secondary/10">
              <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No transactions yet.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/5 overflow-hidden bg-background/50">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/30 border-b border-white/5 text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Description</th>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                        {new Date(tx.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">
                        {tx.description}
                        <span className={cn(
                          "ml-3 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider",
                          tx.type === 'usage' ? "bg-destructive/10 text-destructive" : 
                          tx.type === 'grant' ? "bg-blue-500/10 text-blue-500" :
                          "bg-emerald-500/10 text-emerald-500"
                        )}>
                          {tx.type}
                        </span>
                      </td>
                      <td className={cn(
                        "px-6 py-4 text-right font-bold font-mono",
                        tx.amount > 0 ? "text-emerald-500" : "text-destructive"
                      )}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <UpgradeModal 
        isOpen={isUpgradeModalOpen} 
        onClose={() => setIsUpgradeModalOpen(false)} 
      />
    </PageContainer>
  );
};
