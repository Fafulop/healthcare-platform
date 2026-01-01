// Button component following DESIGN_GUIDE.md specifications
import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, children, className = '', disabled, ...props }, ref) => {
    // Base styles
    const baseStyles = 'font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    // Variant styles
    const variantStyles = {
      primary: 'bg-[var(--color-primary)] text-[var(--color-neutral-dark)] hover:bg-[var(--color-primary-hover)] focus:ring-[var(--color-primary)] shadow-[var(--shadow-light)]',
      secondary: 'bg-[var(--color-secondary)] text-white hover:bg-[var(--color-secondary-hover)] focus:ring-[var(--color-secondary)]',
      tertiary: 'bg-transparent border border-[var(--color-secondary)] text-[var(--color-secondary)] hover:bg-[var(--color-secondary)] hover:text-white focus:ring-[var(--color-secondary)]',
    };

    // Size styles
    const sizeStyles = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-6 py-3 text-base',
      lg: 'px-8 py-4 text-lg',
    };

    // Moderate radius (10px) - Notion + Unobravo style
    const shapeStyles = 'rounded-[10px]';

    const combinedStyles = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${shapeStyles} ${className}`;

    return (
      <button
        ref={ref}
        className={combinedStyles}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {children}
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
