# Doctor Profile UI Design Guide

```json
{
  "brand": {
    "name": "Doctor Profile UI",
    "description": "A hybrid visual system inspired by Zocdoc and One Medical, combining friendly optimism with trustworthy professionalism. Designed for healthcare provider profile pages with strong accessibility and SEO support."
  },

  "colors": {
    "primary": {
      "name": "Warm Yellow",
      "hex": "#FFEC1A",
      "usage": "CTA buttons, highlights, icons, calendar selection states. Creates energy and optimism."
    },
    "secondary": {
      "name": "Deep Medical Green",
      "hex": "#1D5B63",
      "usage": "Headers, section backgrounds, badges, trusted content zones. Conveys professionalism and reliability."
    },
    "accent": {
      "name": "Soft Gold",
      "hex": "#FFD700",
      "usage": "Accent borders, hover states, subtle emphasis."
    },
    "neutral": {
      "dark": {
        "hex": "#333333",
        "usage": "Primary text, headings, high-contrast elements."
      },
      "medium": {
        "hex": "#777777",
        "usage": "Secondary text, labels and metadata."
      },
      "light": {
        "hex": "#F7F7F7",
        "usage": "Section backgrounds, cards, dividers."
      },
      "white": {
        "hex": "#FFFFFF",
        "usage": "Base background, clean readable surfaces."
      }
    },
    "status": {
      "success": "#25A563",
      "warning": "#FDBA2D",
      "error": "#E54545"
    }
  },

  "typography": {
    "fontPrimary": {
      "family": "Inter, Helvetica, sans-serif",
      "usage": "Headings, titles, CTAs",
      "styles": ["600 SemiBold", "700 Bold"]
    },
    "fontSecondary": {
      "family": "Inter, Helvetica, sans-serif",
      "usage": "Body text, paragraphs, small labels",
      "styles": ["400 Regular", "500 Medium"]
    },
    "scale": {
      "h1": "2.3rem",
      "h2": "1.9rem",
      "h3": "1.5rem",
      "body": "1rem",
      "small": "0.875rem",
      "micro": "0.75rem"
    }
  },

  "spacing": {
    "unit": 8,
    "scale": {
      "xs": 4,
      "sm": 8,
      "md": 16,
      "lg": 24,
      "xl": 32,
      "xxl": 48
    }
  },

  "shapes": {
    "borderRadius": {
      "small": 6,
      "medium": 10,
      "large": 16,
      "pill": 999
    },
    "cardShadow": {
      "light": "0px 2px 8px rgba(0,0,0,0.06)",
      "medium": "0px 4px 14px rgba(0,0,0,0.10)"
    }
  },

  "icons": {
    "style": "Rounded geometric icons inspired by Zocdoc. Thick strokes. Friendly look.",
    "recommendedPack": ["Lucide", "HeroIcons"],
    "usageNotes": "Use icons sparingly, aligned with text. Important for trust elements like education, location, cedula, specialties."
  },

  "imagery": {
    "photoStyle": {
      "tone": "Warm, natural lighting. Human-first. Real clinics and real doctors.",
      "background": "Neutral or softly blurred. Avoid overly clinical white labs."
    },
    "videoStyle": {
      "format": "Short vertical or horizontal clips. Modal playback.",
      "tone": "Friendly, authentic, trust-building."
    },
    "patterns": {
      "usage": "Subtle geometric shapes behind sections. Inspired by Zocdoc's playful layer patterns.",
      "opacity": 0.08
    },
    "illustrations": {
      "style": "Optional watercolor or soft organic shapes inspired by One Medical.",
      "usage": "Only for sections like onboarding or empty states."
    }
  },

  "buttons": {
    "primaryButton": {
      "background": "#FFEC1A",
      "textColor": "#333333",
      "hover": "#FFE500",
      "shape": "pill",
      "shadow": "0px 2px 8px rgba(0,0,0,0.10)"
    },
    "secondaryButton": {
      "background": "#1D5B63",
      "textColor": "#FFFFFF",
      "hover": "#174951",
      "shape": "pill"
    },
    "tertiaryButton": {
      "background": "transparent",
      "border": "1px solid #1D5B63",
      "textColor": "#1D5B63"
    }
  },

  "layout": {
    "maxWidth": "1200px",
    "contentPadding": "16px",
    "sectionSpacing": "64px",
    "gridSystem": "12-column responsive grid",
    "heroHeight": "auto",
    "mobileFirst": true,
    "responsiveBreakpoints": {
      "sm": "480px",
      "md": "768px",
      "lg": "1024px",
      "xl": "1280px"
    }
  },

  "componentsBrandingRules": {
    "doctorPhoto": {
      "shape": "roundedLarge",
      "recommendedSize": "180x180",
      "shadow": "light"
    },
    "infoCards": {
      "background": "white",
      "shadow": "light",
      "borderRadius": "medium",
      "padding": "16px"
    },
    "carousel": {
      "height": "280px",
      "borderRadius": "medium",
      "background": "#F7F7F7"
    },
    "priceCards": {
      "background": "#FFFFFF",
      "accentBorder": "#FFD700",
      "borderRadius": "medium",
      "padding": "20px"
    },
    "calendar": {
      "selectedColor": "#FFEC1A",
      "availableColor": "#1D5B63",
      "unavailableColor": "#CCCCCC"
    }
  },

  "voiceAndTone": {
    "keywords": ["trustworthy", "warm", "optimistic", "professional"],
    "headingsStyle": "Clear, human, benefit-driven",
    "microcopyExamples": {
      "cta": "Book Appointment",
      "availability": "Next available date",
      "credentials": "Verified Credentials",
      "bio": "Get to know your doctor"
    }
  }
}
```
