// Color Palette System - Predefined palettes for doctor profiles
// Each doctor can choose a palette that applies to their entire site (profile + blog)

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
  // ==================== SINGLE-COLOR PALETTES ====================

  warm: {
    id: 'warm',
    name: 'Cálido y Amigable',
    description: 'Amarillo cálido con verde médico - Diseño original',
    type: 'single',
    colors: {
      primary: '#FFEC1A',           // Warm Yellow
      primaryLight: '#FFF5C2',      // Light Yellow
      primaryDark: '#E6D317',       // Dark Yellow
      secondary: '#1D5B63',         // Medical Green
      secondaryLight: '#2A7D86',    // Light Medical Green
      secondaryDark: '#164449',     // Dark Medical Green
      accent: '#FF6B6B',            // Coral accent
      bgYellowLight: '#FFFBEB',     // Very light yellow background
      bgGreenLight: '#D0E7E9',      // Very light green background
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
  },

  blue: {
    id: 'blue',
    name: 'Azul Profesional',
    description: 'Azul confiable y profesional',
    type: 'single',
    colors: {
      primary: '#3B82F6',           // Blue
      primaryLight: '#DBEAFE',      // Light Blue
      primaryDark: '#1E40AF',       // Dark Blue
      secondary: '#0C4A6E',         // Deep Blue
      secondaryLight: '#0369A1',    // Medium Blue
      secondaryDark: '#082F49',     // Darker Blue
      accent: '#F59E0B',            // Amber accent
      bgYellowLight: '#EFF6FF',     // Very light blue background
      bgGreenLight: '#DBEAFE',      // Light blue background
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
  },

  green: {
    id: 'green',
    name: 'Verde Médico',
    description: 'Verde esmeralda médico y confiable',
    type: 'single',
    colors: {
      primary: '#10B981',           // Emerald
      primaryLight: '#D1FAE5',      // Light Emerald
      primaryDark: '#047857',       // Dark Emerald
      secondary: '#065F46',         // Deep Green
      secondaryLight: '#059669',    // Medium Green
      secondaryDark: '#064E3B',     // Darker Green
      accent: '#3B82F6',            // Blue accent
      bgYellowLight: '#ECFDF5',     // Very light green background
      bgGreenLight: '#D1FAE5',      // Light green background
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
  },

  purple: {
    id: 'purple',
    name: 'Púrpura Tranquilo',
    description: 'Púrpura calmante y sofisticado',
    type: 'single',
    colors: {
      primary: '#8B5CF6',           // Purple
      primaryLight: '#EDE9FE',      // Light Purple
      primaryDark: '#6D28D9',       // Dark Purple
      secondary: '#5B21B6',         // Deep Purple
      secondaryLight: '#7C3AED',    // Medium Purple
      secondaryDark: '#4C1D95',     // Darker Purple
      accent: '#EC4899',            // Pink accent
      bgYellowLight: '#FAF5FF',     // Very light purple background
      bgGreenLight: '#EDE9FE',      // Light purple background
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
  },

  orange: {
    id: 'orange',
    name: 'Naranja Energético',
    description: 'Naranja vibrante y energético',
    type: 'single',
    colors: {
      primary: '#F97316',           // Orange
      primaryLight: '#FFEDD5',      // Light Orange
      primaryDark: '#C2410C',       // Dark Orange
      secondary: '#9A3412',         // Deep Orange
      secondaryLight: '#EA580C',    // Medium Orange
      secondaryDark: '#7C2D12',     // Darker Orange
      accent: '#3B82F6',            // Blue accent
      bgYellowLight: '#FFF7ED',     // Very light orange background
      bgGreenLight: '#FFEDD5',      // Light orange background
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
  },

  // ==================== DUAL-COLOR PALETTES ====================

  ocean: {
    id: 'ocean',
    name: 'Océano',
    description: 'Azul y turquesa fresco como el mar',
    type: 'dual',
    colors: {
      primary: '#06B6D4',           // Cyan
      primaryLight: '#CFFAFE',      // Light Cyan
      primaryDark: '#0891B2',       // Dark Cyan
      secondary: '#0E7490',         // Teal
      secondaryLight: '#14B8A6',    // Light Teal
      secondaryDark: '#0F766E',     // Dark Teal
      accent: '#F59E0B',            // Amber accent
      bgYellowLight: '#ECFEFF',     // Very light cyan background
      bgGreenLight: '#CCFBF1',      // Light teal background
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
  },

  sunset: {
    id: 'sunset',
    name: 'Atardecer',
    description: 'Naranja y rosa como el atardecer',
    type: 'dual',
    colors: {
      primary: '#FB923C',           // Orange
      primaryLight: '#FED7AA',      // Light Orange
      primaryDark: '#EA580C',       // Dark Orange
      secondary: '#EC4899',         // Pink
      secondaryLight: '#F9A8D4',    // Light Pink
      secondaryDark: '#DB2777',     // Dark Pink
      accent: '#8B5CF6',            // Purple accent
      bgYellowLight: '#FFF7ED',     // Very light orange background
      bgGreenLight: '#FCE7F3',      // Light pink background
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
  },

  forest: {
    id: 'forest',
    name: 'Bosque',
    description: 'Verde y café natural del bosque',
    type: 'dual',
    colors: {
      primary: '#22C55E',           // Green
      primaryLight: '#DCFCE7',      // Light Green
      primaryDark: '#16A34A',       // Dark Green
      secondary: '#92400E',         // Brown
      secondaryLight: '#B45309',    // Light Brown
      secondaryDark: '#78350F',     // Dark Brown
      accent: '#3B82F6',            // Blue accent
      bgYellowLight: '#F0FDF4',     // Very light green background
      bgGreenLight: '#FEF3C7',      // Light amber background
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
  },

  royal: {
    id: 'royal',
    name: 'Real',
    description: 'Púrpura y dorado elegante y lujoso',
    type: 'dual',
    colors: {
      primary: '#A855F7',           // Purple
      primaryLight: '#F3E8FF',      // Light Purple
      primaryDark: '#7E22CE',       // Dark Purple
      secondary: '#D97706',         // Gold
      secondaryLight: '#FBBF24',    // Light Gold
      secondaryDark: '#B45309',     // Dark Gold
      accent: '#EC4899',            // Pink accent
      bgYellowLight: '#FAF5FF',     // Very light purple background
      bgGreenLight: '#FEF3C7',      // Light gold background
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
  },

  cherry: {
    id: 'cherry',
    name: 'Cereza',
    description: 'Rojo y rosa vibrante y cálido',
    type: 'dual',
    colors: {
      primary: '#EF4444',           // Red
      primaryLight: '#FEE2E2',      // Light Red
      primaryDark: '#DC2626',       // Dark Red
      secondary: '#EC4899',         // Pink
      secondaryLight: '#F9A8D4',    // Light Pink
      secondaryDark: '#DB2777',     // Dark Pink
      accent: '#F59E0B',            // Amber accent
      bgYellowLight: '#FEF2F2',     // Very light red background
      bgGreenLight: '#FCE7F3',      // Light pink background
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
  },
};

// Helper function to get palette by ID
export function getPaletteById(id: string): ColorPalette {
  return COLOR_PALETTES[id] || COLOR_PALETTES.warm;
}

// Helper function to get all palette IDs
export function getAllPaletteIds(): string[] {
  return Object.keys(COLOR_PALETTES);
}

// Helper function to get palettes by type
export function getPalettesByType(type: 'single' | 'dual'): ColorPalette[] {
  return Object.values(COLOR_PALETTES).filter(p => p.type === type);
}
