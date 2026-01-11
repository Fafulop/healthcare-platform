// Badge component following DESIGN_GUIDE.md specifications
import React from 'react';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'secondary';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: BadgeVariant;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ children, variant = 'default', className = '', ...props }, ref) => {
    // Base styles
    const baseStyles = 'inline-flex items-center px-3 py-1 rounded-[var(--radius-small)] text-sm font-medium';

    // Variant styles
    const variantStyles = {
      default: 'bg-[var(--color-neutral-light)] text-[var(--color-neutral-dark)]',
      success: 'bg-[var(--color-success)] text-white',
      warning: 'bg-[var(--color-warning)] text-[var(--color-neutral-dark)]',
      error: 'bg-[var(--color-error)] text-white',
      secondary: 'bg-[var(--color-secondary)] text-white',
    };

    const combinedStyles = `${baseStyles} ${variantStyles[variant]} ${className}`;

    return (
      <span ref={ref} className={combinedStyles} {...props}>
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;
