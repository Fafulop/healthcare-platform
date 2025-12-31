// Color Palette Provider - Server-side CSS variables injection for optimal performance
// This is a SERVER COMPONENT - no client-side JS, instant paint

import { getPaletteById } from '@healthcare/types';

interface ColorPaletteProviderProps {
  paletteId?: string;
  children: React.ReactNode;
}

export default function ColorPaletteProvider({
  paletteId = 'warm',
  children
}: ColorPaletteProviderProps) {
  const palette = getPaletteById(paletteId);

  // Generate inline styles for server-side rendering
  // This eliminates client-side JS overhead and improves LCP
  const cssVariables = `
    :root {
      /* Primary Color - Main brand color */
      --color-primary: ${palette.colors.primary};
      --color-primary-light: ${palette.colors.primaryLight};
      --color-primary-dark: ${palette.colors.primaryDark};

      /* Secondary Color - Accent/complement color */
      --color-secondary: ${palette.colors.secondary};
      --color-secondary-light: ${palette.colors.secondaryLight};
      --color-secondary-dark: ${palette.colors.secondaryDark};
      --color-secondary-hover: ${palette.colors.secondaryDark};

      /* Accent Color - For highlights */
      --color-accent: ${palette.colors.accent};

      /* Background Colors */
      --color-bg-yellow-light: ${palette.colors.bgYellowLight};
      --color-bg-green-light: ${palette.colors.bgGreenLight};

      /* Semantic Colors */
      --color-success: ${palette.colors.success};
      --color-warning: ${palette.colors.warning};
      --color-error: ${palette.colors.error};

      /* Neutral Colors (unchanged across palettes) */
      --color-neutral-dark: #1F2937;
      --color-neutral-medium: #6B7280;
      --color-neutral-light: #F3F4F6;
    }
  `;

  return (
    <>
      {/* Server-rendered inline styles - available immediately on first paint */}
      <style dangerouslySetInnerHTML={{ __html: cssVariables }} />
      {children}
    </>
  );
}
