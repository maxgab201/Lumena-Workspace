import { useState, useEffect } from "react";
import { PageContainer } from "../components/ui/PageContainer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useBillingStore } from "../stores/billingStore";
import { PLANS, type PlanType } from "../types/billing";
import { CheckIcon, Zap, Activity, CreditCard, Sparkles, Info } from "lucide-react";
import { UpgradeModal } from "../components/billing/UpgradeModal";
import { cn } from "../lib/utils";
import { t } from "../i18n";
import { useLanguage } from "../hooks/useLanguage";
import { toast } from "sonner";

export const Billing = () => {
  useLanguage();
  const { subscription, account, transactions, packages, paymentsConfigured, checkoutPackage, fetchBillingData } = useBillingStore();

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const currentPlan = (subscription?.plan?.code || "free") as PlanType;
  const creditsRemaining = account?.available || 0;
  const creditsConsumed = account?.consumed || 0;
  const creditsReserved = account?.reserved || 0;
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const plan = PLANS[currentPlan] ?? PLANS.free!;
  const isFreePlan = currentPlan === "free";
  const creditsTotal = plan.monthlyCredits || 0;
  const usagePercentage = creditsTotal > 0
    ? Math.min(100, Math.max(0, (creditsConsumed / creditsTotal) * 100))
    : 0;

  const paymentsUnavailable = paymentsConfigured === 'no';

  const handleBuyPackage = async (packageId: string) => {
    try {
      await checkoutPackage(packageId);
    } catch (err: any) {
      if (err?.message === 'PRICE_NOT_PROVISIONED') {
        toast.info(t('billing.notAvailableYet'), { description: t('billing.notAvailableYetDesc') });
      } else {
        toast.error(t('billing.checkoutError'), { description: err?.message });
      }
    }
  };

  return (
    <PageContainer>
      <header className="space-y-1 mb-8">
        <h1 className="text-3xl font-heading font-semibold tracking-tight">{t("billing.title")}</h1>
        <p className="text-muted-foreground">{t("billing.description")}</p>
      </header>

      {/* Honest payments-availability notice (alpha stage) */}
      {paymentsUnavailable && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-secondary/20 border border-white/5" data-testid="payments-unavailable-notice">
          <Info size={18} className="text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">{t("billing.paymentsUnavailable")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("billing.paymentsUnavailableDesc")}</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-12 mb-8">
        {/* Current Plan Card */}
        <Card className="border-white/5 bg-card/40 backdrop-blur-md shadow-sm md:col-span-4 flex flex-col justify-between overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              {t("billing.currentPlan")}: <span className="text-accent">{plan.name}</span>
            </CardTitle>
            <CardDescription>
              {isFreePlan ? t("billing.freeTier") : t("billing.activeSub")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold mb-6 font-heading tracking-tight">
              ${plan.price}<span className="text-lg text-muted-foreground font-normal">/mo</span>
            </div>

            {isFreePlan ? (
              <div className="p-4 rounded-xl bg-secondary/20 border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles size={16} className="text-accent" />
                  <span>{t("billing.noCreditsIncluded")}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("billing.freePlanDetails")}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold text-foreground">{t("billing.creditUsage")}</span>
                    <span className="text-muted-foreground font-mono">
                      {creditsConsumed} / {creditsTotal}
                    </span>
                  </div>
                  <div data-testid="credit-progress-bar" className="h-3 w-full bg-secondary/40 overflow-hidden rounded-full border border-white/5 mb-2">
                    <div
                      className={cn(
                        "h-full rounded-full shadow-inner transition-[width]",
                        usagePercentage > 90 ? "bg-destructive" : usagePercentage > 75 ? "bg-orange-500" : "bg-accent"
                      )}
                      style={{ width: `${usagePercentage}%` }}
                    />
                  </div>
                  <div className="flex flex-col mt-2 gap-1 text-xs text-muted-foreground">
                    <p className="flex items-center text-foreground font-semibold">
                      <Activity size={12} className="mr-1.5" /> {creditsRemaining} {t("billing.creditsAvailable")}
                    </p>
                    {creditsReserved > 0 && (
                      <p className="flex items-center text-orange-400">
                        <Zap size={12} className="mr-1.5" /> {creditsReserved} {t("billing.creditsReserved")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-4">
            {isFreePlan ? (
              <Button
                data-testid="upgrade-btn"
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-full shadow-md shadow-accent/20 h-11 font-semibold"
                onClick={() => setIsUpgradeModalOpen(true)}
              >
                <Zap className="w-4 h-4 mr-2 fill-current" /> {t("billing.upgradeToPro")}
              </Button>
            ) : (
              <Button variant="outline" className="w-full text-foreground border-white/10 rounded-full h-11" disabled>
                {t("billing.manageSubscription") || "Manage Subscription"}
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* What Core includes — always relevant, especially on Free */}
        <Card className="border-white/5 bg-card/40 backdrop-blur-md shadow-sm md:col-span-8 flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard size={18} className="text-muted-foreground" /> {t("billing.coreIncluded")}
            </CardTitle>
            <CardDescription>{t("billing.coreIncludedDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center pb-8">
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col space-y-2 p-4 rounded-xl border border-white/5 bg-secondary/10">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className="text-accent"><CheckIcon size={16} /></span>
                  {t("billing.coreReading")}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{t("billing.coreReadingDesc")}</p>
              </div>
              <div className="flex flex-col space-y-2 p-4 rounded-xl border border-white/5 bg-secondary/10">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className="text-accent"><CheckIcon size={16} /></span>
                  {t("billing.coreHighlights")}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{t("billing.coreHighlightsDesc")}</p>
              </div>
              <div className="flex flex-col space-y-2 p-4 rounded-xl border border-white/5 bg-secondary/10">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className="text-accent"><CheckIcon size={16} /></span>
                  {t("billing.coreFree")}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{t("billing.coreFreeDesc")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan Comparison Section */}
      <section className="mb-8 border border-white/5 bg-card/20 rounded-3xl p-8 backdrop-blur-md shadow-lg">
        <div className="mb-8">
          <h2 className="text-2xl font-heading font-bold">{t("billing.comparePlans")}</h2>
          <p className="text-muted-foreground text-sm mt-1">{t("billing.comparePlansDesc")}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl border border-white/5 bg-background/40">
            {PLANS.free && <>
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
            </>}
          </div>

          <div className="p-6 rounded-2xl border border-accent/30 bg-accent/5 shadow-[0_0_20px_rgba(var(--accent-hsl),0.05)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10" data-plan="pro">
              {PLANS.pro && <>
              <h4 className="font-semibold text-lg mb-4 text-foreground flex items-center justify-between">
                {PLANS.pro.name}
                <span className="text-[10px] bg-accent text-white uppercase font-bold tracking-widest px-2 py-0.5 rounded-full">Pro</span>
              </h4>
              <div className="text-3xl font-bold font-heading mb-6">
                ${PLANS.pro.price}<span className="text-sm font-normal text-muted-foreground">/mo</span>
              </div>
              <ul className="space-y-3">
                {PLANS.pro.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm font-medium">
                    <CheckIcon className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full mt-6 bg-accent hover:bg-accent/90 text-accent-foreground"
                disabled
                title={t("billing.paymentsUnavailable")}
                data-testid="pro-checkout-disabled"
              >
                {t("billing.notAvailableYet")}
              </Button>
              </>}
            </div>
          </div>
        </div>
      </section>

      {/* Transaction History */}
      <Card className="border-white/5 bg-card/40 backdrop-blur-md shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             {t("billing.transactionHistory")}
          </CardTitle>
          <CardDescription>{t("billing.transactionHistoryDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-12 border border-white/5 border-dashed rounded-xl bg-secondary/10">
              <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t("billing.noEntries")}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/5 overflow-hidden bg-background/50">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/30 border-b border-white/5 text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Entry Type</th>
                    <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                        {new Date(tx.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground">
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider",
                          ["consume", "reserve"].includes(tx.entry_type) ? "bg-destructive/10 text-destructive" :
                          tx.entry_type.includes("grant") ? "bg-emerald-500/10 text-emerald-500" :
                          "bg-blue-500/10 text-blue-500"
                        )}>
                          {tx.entry_type}
                        </span>
                      </td>
                      <td className={cn(
                        "px-6 py-4 text-right font-bold font-mono",
                        tx.direction > 0 ? "text-emerald-500" : "text-destructive"
                      )}>
                        {tx.direction > 0 ? "+" : "-"}{tx.amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credit Packages Section */}
      <section className="mb-8">
        <div className="flex flex-col mb-6">
          <h2 className="text-2xl font-heading font-bold">{t("billing.buyCredits")}</h2>
          <p className="text-muted-foreground text-sm mt-1">{t("billing.buyCreditsDesc")}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {packages.length === 0 && (
            <div className="col-span-3 text-center py-12 border border-white/5 border-dashed rounded-xl bg-secondary/10">
              <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t("billing.noPackages")}</p>
            </div>
          )}
          {packages.map((pkg) => (
            <Card key={pkg.id} className="border-white/5 bg-card/40 backdrop-blur-md shadow-sm hover:shadow-md hover:border-accent/30 transition-all flex flex-col justify-between">
              <CardHeader>
                <CardTitle>{pkg.name}</CardTitle>
                <CardDescription>{pkg.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-heading mb-2 text-foreground">
                  ${pkg.price_usd}
                </div>
                <div className="text-sm font-medium text-accent flex items-center">
                  <Zap className="w-4 h-4 mr-1.5 fill-accent" /> {pkg.credits.toLocaleString()} Credits
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full bg-secondary hover:bg-secondary/80 text-foreground"
                  onClick={() => handleBuyPackage(pkg.id)}
                  disabled={paymentsUnavailable}
                  title={paymentsUnavailable ? t("billing.paymentsUnavailable") : undefined}
                  data-testid={`buy-package-${pkg.id}`}
                >
                  {t("billing.buyNow")}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </PageContainer>
  );
};
