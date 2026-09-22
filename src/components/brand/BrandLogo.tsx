import { cn } from '../../lib/utils';

type BrandLogoVariant = 'icon' | 'horizontal' | 'lockup' | 'vertical';

const SOURCES: Record<BrandLogoVariant, string> = {
  icon: '/logo-icon.svg',
  horizontal: '/logo-horizontal.svg',
  lockup: '/logo-lockup.svg',
  vertical: '/logo-vertical.svg',
};

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
  alt?: string;
  decorative?: boolean;
}

export const BrandLogo = ({
  variant = 'horizontal',
  className,
  alt = 'Lumena Workspace',
  decorative = false,
}: BrandLogoProps) => (
  <img
    src={SOURCES[variant]}
    alt={decorative ? '' : alt}
    aria-hidden={decorative || undefined}
    draggable={false}
    className={cn('select-none shrink-0', className)}
  />
);
