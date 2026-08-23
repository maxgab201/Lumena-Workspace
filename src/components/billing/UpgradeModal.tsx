import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Sparkles } from 'lucide-react';
import { useBillingStore } from '../../stores/billingStore';
import { useState } from 'react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpgradeModal = ({ isOpen, onClose }: UpgradeModalProps) => {
  const { upgradeToPro, subscription } = useBillingStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleUpgrade = async () => {
    setIsProcessing(true);
    // Simulate network request to payment gateway
    await new Promise(resolve => setTimeout(resolve, 1500));
    await upgradeToPro();
    setIsProcessing(false);
    setIsSuccess(true);
    
    // Auto close after success
    setTimeout(() => {
      onClose();
      setIsSuccess(false);
    }, 2000);
  };

  if (subscription?.plan === 'pro' && !isSuccess) {
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
    <Modal open={isOpen} onOpenChange={() => !isProcessing && onClose()}>
      <ModalContent className="sm:max-w-md backdrop-blur-2xl bg-background/80 border-white/10" data-testid="upgrade-modal">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            {isSuccess ? 'Upgrade Successful!' : 'Upgrade to Pro'}
          </ModalTitle>
          <ModalDescription>
            {isSuccess 
              ? 'Your account has been upgraded. 1000 credits have been added to your balance.'
              : 'Unlock advanced AI features, unlimited workspaces, and priority processing.'}
          </ModalDescription>
        </ModalHeader>
        
        {!isSuccess && (
          <>
            <div className="py-6">
              <div className="text-4xl font-bold text-center mb-2">$15<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
              <p className="text-sm text-center text-muted-foreground mb-6">Billed monthly. Cancel anytime.</p>
              
              <div className="space-y-3 bg-muted/30 p-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between text-sm">
                  <span>AI Queries</span>
                  <span className="font-medium text-accent">1000 / month</span>
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
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={handleUpgrade}
                disabled={isProcessing}
                data-testid="confirm-upgrade-btn"
              >
                {isProcessing ? 'Processing Payment...' : 'Subscribe Now'}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Payment gateway is mocked for this preview. No real charges will occur.
              </p>
            </div>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
