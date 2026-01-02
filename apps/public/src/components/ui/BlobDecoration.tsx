// Blob Decoration - Modern gradient blobs inspired by Stripe/Figma
// Server component - No client-side JS needed

interface BlobDecorationProps {
  variant?: 'blob1' | 'blob2' | 'blob3' | 'blob4';
  color?: 'primary' | 'secondary' | 'accent' | 'gradient-blue' | 'gradient-purple';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  opacity?: number; // 1-100 (percentage)
  blur?: boolean; // Add blur filter for softer effect
  className?: string;
}

export default function BlobDecoration({
  variant = 'blob1',
  color = 'primary',
  position = 'top-right',
  size = 'lg',
  opacity = 12,
  blur = true,
  className = '',
}: BlobDecorationProps) {
  // Position styles
  const positionStyles = {
    'top-left': 'top-0 left-0 -translate-x-1/4 -translate-y-1/4',
    'top-right': 'top-0 right-0 translate-x-1/4 -translate-y-1/4',
    'bottom-left': 'bottom-0 left-0 -translate-x-1/4 translate-y-1/4',
    'bottom-right': 'bottom-0 right-0 translate-x-1/4 translate-y-1/4',
    'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  };

  // Size styles
  const sizeStyles = {
    sm: 'w-64 h-64',
    md: 'w-96 h-96',
    lg: 'w-[600px] h-[600px]',
    xl: 'w-[800px] h-[800px]',
  };

  // Color fills - support gradients using CSS variables
  const getColorFill = () => {
    switch (color) {
      case 'gradient-blue':
        return (
          <defs>
            <linearGradient id={`gradient-blue-${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={1} />
              <stop offset="100%" stopColor="var(--color-secondary)" stopOpacity={1} />
            </linearGradient>
          </defs>
        );
      case 'gradient-purple':
        return (
          <defs>
            <linearGradient id={`gradient-purple-${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-secondary)" stopOpacity={1} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={1} />
            </linearGradient>
          </defs>
        );
      default:
        return null;
    }
  };

  const getFillColor = () => {
    switch (color) {
      case 'gradient-blue':
        return `url(#gradient-blue-${variant})`;
      case 'gradient-purple':
        return `url(#gradient-purple-${variant})`;
      case 'primary':
        return 'var(--color-primary)';
      case 'secondary':
        return 'var(--color-secondary)';
      case 'accent':
        return 'var(--color-accent)';
      default:
        return 'var(--color-primary)';
    }
  };

  // Blob SVG paths - organic shapes
  const blobPaths = {
    blob1: 'M60.5,-55.7C75.3,-39.6,82.7,-15.6,81.8,8.2C80.9,32,71.7,55.6,55.3,68.5C38.9,81.4,15.3,83.6,-7.8,90.3C-30.9,97,-61.2,108.2,-77.8,95.2C-94.4,82.2,-97.3,45,-91.1,14.8C-84.9,-15.4,-69.6,-38.6,-51.5,-54.5C-33.4,-70.4,-12.6,-79,6.1,-84.5C24.8,-90,45.7,-71.8,60.5,-55.7Z',
    blob2: 'M44.7,-50.2C57.1,-36.6,66.3,-20.8,68.4,-3.7C70.5,13.4,65.5,31.8,54.1,45.1C42.7,58.4,25.9,66.6,7.9,69.2C-10.1,71.8,-29.3,68.8,-43.7,57.4C-58.1,46,-67.7,26.2,-70.1,5.4C-72.5,-15.4,-67.7,-37.2,-55.8,-51.2C-43.9,-65.2,-25,-71.4,-7.3,-73.6C10.4,-75.8,32.3,-63.8,44.7,-50.2Z',
    blob3: 'M54.3,-63.5C67.7,-52.2,74.4,-32.1,76.5,-11.5C78.6,9.1,76.1,30.2,66.3,46.8C56.5,63.4,39.4,75.5,20.3,80.8C1.2,86.1,-19.9,84.6,-37.8,76.1C-55.7,67.6,-70.4,52.1,-76.8,33.8C-83.2,15.5,-81.3,-5.6,-74.1,-23.5C-66.9,-41.4,-54.4,-56.1,-39.5,-66.9C-24.6,-77.7,-7.4,-84.6,8.6,-92.3C24.6,-100,40.9,-74.8,54.3,-63.5Z',
    blob4: 'M37.8,-44.5C48.3,-34.3,55.7,-20.7,58.8,-5.3C61.9,10.1,60.7,27.3,52.3,39.8C43.9,52.3,28.3,60.1,11.5,64.5C-5.3,68.9,-23.3,69.9,-37.8,62.5C-52.3,55.1,-63.3,39.3,-67.8,21.8C-72.3,4.3,-70.3,-14.9,-62.5,-29.5C-54.7,-44.1,-41.1,-54.1,-26.7,-63.1C-12.3,-72.1,2.9,-80.1,16.4,-76.8C29.9,-73.5,27.3,-54.7,37.8,-44.5Z',
  };

  return (
    <div
      className={`absolute pointer-events-none select-none ${positionStyles[position]} ${sizeStyles[size]} ${blur ? 'blur-3xl' : ''} ${className}`}
      style={{ opacity: opacity / 100 }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {getColorFill()}
        <path
          fill={getFillColor()}
          d={blobPaths[variant]}
          transform="translate(100 100)"
        />
      </svg>
    </div>
  );
}
