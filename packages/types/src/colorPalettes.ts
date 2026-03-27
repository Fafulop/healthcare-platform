// Color Palette System - Predefined palettes for doctor profiles
// Each doctor can choose a palette that applies to their entire site (profile + blog)
// UPDATED: Notion + Unobravo inspired minimal professional palettes

export interface ColorPalette {
  id: string;
  name: string;
  description: string;
  type: 'single' | 'dual'; // Single color variations vs dual color mix
  colors: {
    primary: string;
    primaryLight: string;
    primaryDark: string;
    secondary: string;
    secondaryLight: string;
    secondaryDark: string;
    accent: string;
    bgYellowLight: string;
    bgGreenLight: string;
    success: string;
    warning: string;
    error: string;
  };
}

export const COLOR_PALETTES: Record<string, ColorPalette> = {
  // ==================== MINIMAL PROFESSIONAL PALETTES ====================

  professional: {
    id: 'professional',
    name: 'Profesional Azul',
    description: 'Azul frío profesional con acentos cálidos - Inspirado en Notion',
    type: 'single',
    colors: {
      primary: '#3B82F6',           // Cool Blue
      primaryLight: '#DBEAFE',      // Very light blue
      primaryDark: '#2563EB',       // Darker blue
      secondary: '#1E3A8A',         // Navy blue
      secondaryLight: '#3B82F6',    // Medium blue
      secondaryDark: '#1E293B',     // Almost black blue
      accent: '#F59E0B',            // Warm amber
      bgYellowLight: '#FAF8F5',     // Warm cream
      bgGreenLight: '#F2F0EB',      // Slightly deeper cream
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
  },

  healthcare: {
    id: 'healthcare',
    name: 'Salud Profesional',
    description: 'Verde azulado médico con tonos neutros - Inspirado en Unobravo',
    type: 'single',
    colors: {
      primary: '#0891B2',           // Medical teal
      primaryLight: '#CFFAFE',      // Light cyan
      primaryDark: '#0E7490',       // Dark teal
      secondary: '#0F766E',         // Deep teal
      secondaryLight: '#14B8A6',    // Bright teal
      secondaryDark: '#134E4A',     // Forest teal
      accent: '#D97706',            // Warm amber
      bgYellowLight: '#FAF8F5',     // Warm cream (matches professional)
      bgGreenLight: '#E6F2EF',      // Light tint of blob green (#0F766E)
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
  },

  sunshine: {
    id: 'sunshine',
    name: 'Cálido Amarillo',
    description: 'Amarillo cálido suave con acentos dorados - Energía positiva',
    type: 'single',
    colors: {
      primary: '#F59E0B',           // Warm amber/gold
      primaryLight: '#FEF3C7',      // Very light yellow
      primaryDark: '#D97706',       // Deep amber
      secondary: '#CA8A04',         // Rich gold
      secondaryLight: '#FCD34D',    // Light gold
      secondaryDark: '#92400E',     // Dark brown-gold
      accent: '#0891B2',            // Teal accent for contrast
      bgYellowLight: '#FFFBEB',     // Creamy light yellow
      bgGreenLight: '#FEF9C3',      // Pale yellow tint
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
  },

};

// Helper function to get palette by ID
export function getPaletteById(id: string): ColorPalette {
  return COLOR_PALETTES[id] || COLOR_PALETTES.professional; // Changed from 'warm' to 'professional'
}

// Helper function to get all palette IDs
export function getAllPaletteIds(): string[] {
  return Object.keys(COLOR_PALETTES);
}

// Helper function to get palettes by type
export function getPalettesByType(type: 'single' | 'dual'): ColorPalette[] {
  return Object.values(COLOR_PALETTES).filter(p => p.type === type);
}
