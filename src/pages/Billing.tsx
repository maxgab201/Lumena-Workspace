import { useState } from 'react';
import { PageContainer } from '../components/ui/PageContainer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useBillingStore } from '../stores/billingStore';
import { PLANS } from '../types/billing';
import { CheckIcon, Zap, Activity } from 'lucide-react';
import { UpgradeModal } from '../components/billing/UpgradeModal';
import { cn } from '../lib/utils';

export const Billing = () => {
  const { currentPlan, creditsRemaining, transactions } = useBillingStore();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const plan = PLANS[currentPlan];
  const usagePercentage = Math.min(100, Math.max(0, 100 - (creditsRemaining / plan.monthlyCredits) * 100));

  return (
    <PageContainer>
      <header className="mb-8">
        <h1 className="text-3xl font-heading font-semibold tracking-tight">Billing & Credits</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription, view credit usage, and upgrade your plan.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {/* Current Plan Card */}
        <Card className="border-white/10 bg-background/50 backdrop-blur-md shadow-sm lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Current Plan: <span className="text-accent">{plan.name}</span>
            </CardTitle>
            <CardDescription>
              {currentPlan === 'free' ? 'You are currently on the free tier.' : 'You have an active Pro subscription.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold mb-4">${plan.price}<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">Credit Usage</span>
                  <span className="text-muted-foreground">{plan.monthlyCredits - creditsRemaining} / {plan.monthlyCredits}</span>
                </div>
                <div className="h-2.5 w-full bg-muted overflow-hidden rounded-full">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500", 
                      usagePercentage > 90 ? "bg-destructive" : usagePercentage > 75 ? "bg-orange-500" : "bg-accent"
                    )}
                    style={{ width: `${usagePercentage}%` }}
                    data-testid="credit-progress-bar"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {creditsRemaining} credits remaining for this cycle.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            {currentPlan === 'free' ? (
              <Button 
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" 
                onClick={() => setIsUpgradeModalOpen(true)}
                data-testid="upgrade-btn"
              >
                <Zap className="w-4 h-4 mr-2" /> Upgrade to Pro
              </Button>
            ) : (
              <Button variant="outline" className="w-full text-muted-foreground" disabled>
                Manage Subscription (Coming Soon)
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Plan Comparison */}
        <Card className="border-white/10 bg-background/50 backdrop-blur-md shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle>Plan Features</CardTitle>
            <CardDescription>Compare what is included in each tier.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="font-medium text-lg mb-4">{PLANS.free.name}</h4>
                <ul className="space-y-3">
                  {PLANS.free.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckIcon className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-lg mb-4 text-accent">{PLANS.pro.name}</h4>
                <ul className="space-y-3">
                  {PLANS.pro.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckIcon className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card className="border-white/10 bg-background/50 backdrop-blur-md shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" /> Transaction History
          </CardTitle>
          <CardDescription>Recent credit grants, purchases, and usage.</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No transactions yet.
            </div>
          ) : (
            <div className="rounded-md border border-white/5 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b border-white/5">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {tx.description}
                        <span className={cn(
                          "ml-2 text-[10px] px-1.5 py-0.5 rounded-full border uppercase",
                          tx.type === 'usage' ? "border-destructive/30 text-destructive" : 
                          tx.type === 'grant' ? "border-blue-500/30 text-blue-500" :
                          "border-green-500/30 text-green-500"
                        )}>
                          {tx.type}
                        </span>
                      </td>
                      <td className={cn(
                        "px-4 py-3 text-right font-medium font-mono",
                        tx.amount > 0 ? "text-green-500" : "text-destructive"
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
