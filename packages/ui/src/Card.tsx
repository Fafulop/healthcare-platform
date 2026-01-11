// Card component following DESIGN_GUIDE.md specifications
import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  shadow?: 'light' | 'medium' | 'none';
  padding?: 'sm' | 'md' | 'lg';
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, shadow = 'light', padding = 'md', className = '', ...props }, ref) => {
    // Shadow styles
    const shadowStyles = {
      light: 'shadow-[var(--shadow-light)]',
      medium: 'shadow-[var(--shadow-medium)]',
      none: '',
    };

    // Padding styles
    const paddingStyles = {
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    };

    // Base styles
    const baseStyles = 'bg-white rounded-[var(--radius-medium)]';

    const combinedStyles = `${baseStyles} ${shadowStyles[shadow]} ${paddingStyles[padding]} ${className}`;

    return (
      <div ref={ref} className={combinedStyles} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
