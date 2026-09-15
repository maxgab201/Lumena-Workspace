import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Sparkles, Info } from "lucide-react";
import { useBillingStore } from "../../stores/billingStore";
import { PLANS } from "../../types/billing";
import { useLanguage } from "../../hooks/useLanguage";
import { t } from "../../i18n";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Honest upgrade modal: presents the Pro plan but never fakes a checkout.
 * When Stripe is not configured (the current alpha state) it clearly states
 * that payments are not available yet.
 */
export const UpgradeModal = ({ isOpen, onClose }: UpgradeModalProps) => {
  useLanguage();
  const { subscription } = useBillingStore();

  const alreadyPro = (subscription?.plan?.code || 'free') === 'pro';

  return (
    <Modal open={isOpen} onOpenChange={onClose}>
      <ModalContent className="sm:max-w-md backdrop-blur-2xl bg-background/80 border-white/10" data-testid="upgrade-modal">
        {alreadyPro ? (
          <>
            <ModalHeader>
              <ModalTitle>You're already on Pro</ModalTitle>
              <ModalDescription>
                Thank you for being a Pro subscriber! Your account already has all premium features unlocked.
              </ModalDescription>
            </ModalHeader>
            <div className="flex justify-end mt-4">
              <Button onClick={onClose}>Close</Button>
            </div>
          </>
        ) : (
          <>
            <ModalHeader>
              <ModalTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" />
                {t('billing.upgradeToPro')}
              </ModalTitle>
              <ModalDescription>
                {t('billing.paymentsUnavailableDesc')}
              </ModalDescription>
            </ModalHeader>

            <div className="py-4 space-y-4">
              <div className="text-4xl font-bold text-center mb-1">${PLANS.pro?.price}<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
              <p className="text-xs text-center text-muted-foreground">Billed monthly.</p>

              <div className="space-y-3 bg-muted/30 p-4 rounded-xl border border-white/5">
                {PLANS.pro?.features.map((feature) => (
                  <div key={feature} className="flex items-center justify-between text-sm gap-3">
                    <span className="text-muted-foreground">{feature}</span>
                    <span className="text-accent shrink-0">✓</span>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/30 border border-white/5 text-xs text-muted-foreground" data-testid="payments-unavailable-modal-note">
                <Info size={16} className="text-accent shrink-0 mt-0.5" />
                <span>{t('billing.paymentsUnavailable')} — {t('billing.notAvailableYetDesc')}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                className="w-full bg-secondary hover:bg-secondary/80 text-foreground"
                onClick={onClose}
                data-testid="confirm-upgrade-btn"
              >
                Understood
              </Button>
            </div>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
