import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Sparkles, Info } from "lucide-react";
import { useBillingStore } from "../../stores/billingStore";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpgradeModal = ({ isOpen, onClose }: UpgradeModalProps) => {
  const { subscription } = useBillingStore();

  if (subscription?.plan === "pro") {
    return (
      <Modal open={isOpen} onOpenChange={onClose}>
        <ModalContent className="sm:max-w-md backdrop-blur-2xl bg-background/80 border-white/10">
          <ModalHeader>
            <ModalTitle>You're already on Pro</ModalTitle>
            <ModalDescription>
              Thank you for being a Pro subscriber! Your account already has all premium features unlocked.
            </ModalDescription>
          </ModalHeader>
          <div className="flex justify-end mt-4">
            <Button onClick={onClose}>Close</Button>
          </div>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal open={isOpen} onOpenChange={onClose}>
      <ModalContent className="sm:max-w-md backdrop-blur-2xl bg-background/80 border-white/10" data-testid="upgrade-modal">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            Upgrade to Pro (Coming Soon)
          </ModalTitle>
          <ModalDescription>
            Pro plans with AI credits and unlimited workspaces will be available soon.
          </ModalDescription>
        </ModalHeader>
        
        <div className="py-4 space-y-4">
          <div className="text-4xl font-bold text-center mb-1">$15<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
          <p className="text-xs text-center text-muted-foreground">Billed monthly.</p>
          
          <div className="space-y-3 bg-muted/30 p-4 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-sm">
              <span>AI Queries</span>
              <span className="font-medium text-accent">1,000 / month</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Workspaces</span>
              <span className="font-medium">Unlimited</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Processing</span>
              <span className="font-medium">Priority Queue</span>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/30 border border-white/5 text-xs text-muted-foreground">
            <Info size={16} className="text-accent shrink-0 mt-0.5" />
            <span>Payment integration (Stripe) is under development. No charges will be made at this time.</span>
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
      </ModalContent>
    </Modal>
  );
};
