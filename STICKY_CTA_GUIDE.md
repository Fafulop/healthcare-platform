# Sticky CTA Guide

## Overview

Guidelines for implementing a sticky "Book Appointment" CTA that remains visible while scrolling, without harming SEO, UX, or performance.

---

## Purpose

Keep a primary action ("Book Appointment") visible while the user scrolls, ensuring:
- ✅ No SEO penalties
- ✅ Excellent UX
- ✅ Optimal Core Web Vitals
- ✅ Full accessibility compliance

---

## Placement

### Mobile
- **Position**: Full-width bottom sticky bar
- **Behavior**: Always visible while scrolling

### Desktop
- **Options**:
  1. Small floating button (bottom-right corner)
  2. Thin bottom bar (full-width)
- **Preference**: Floating button for less intrusion

### Technical
- **z-index**: 9999
- **Non-obtrusive**: Must not block critical content

---

## Dimensions

### Mobile
- **Height**: 48px to 64px
- **Width**: 100%
- **Padding**: 16px

### Desktop
- **Width**: auto or 200px
- **Height**: 48px
- **Padding**: 16px

### Constraints
- **Max viewport usage**: 15%
- Must not dominate the screen

---

## Visual Design

```json
{
  "backgroundColor": "#FFEC1A",
  "textColor": "#333333",
  "borderRadius": "999px",
  "shadow": "0px -2px 8px rgba(0,0,0,0.1)",
  "fontWeight": 600
}
```

### Icons
- **Allowed**: Yes
- **Size**: 20px
- **Type**: Calendar or checkmark
- **Avoid**: Large images

### Design Notes
- Use brand primary yellow (#FFEC1A)
- High contrast with dark text (#333333)
- Pill-shaped (fully rounded)
- Subtle upward shadow for elevation

---

## UX Rules

### ✅ DO
- Single primary action only
- Use "Book Appointment" as the CTA
- Always visible on mobile for fast booking
- Add safe area padding (body `padding-bottom` = bar height)
- Ensure click target ≥ 48px for accessibility

### ❌ DON'T
- Multiple buttons in the sticky bar
- Include WhatsApp, Call, Pricing, or Services buttons
- Cover content (add body padding to compensate)
- Use on desktop if it feels obtrusive

### Content Safety
- **Does not cover content**: ✅
- **Appropriate body padding**: Required
- **Click target size**: ≥48px height

---

## SEO Compliance

### Critical Requirements
- ✅ Does not overlap headings (H1, H2, H3)
- ✅ Does not hide text content
- ✅ No Cumulative Layout Shift (CLS) impact
- ✅ Does not block crawlable content
- ✅ No interference with Googlebot

### Semantic HTML
```html
<!-- Good: Semantic button -->
<button aria-label="Book appointment">Book Appointment</button>

<!-- Good: Link to booking page -->
<a href="/booking" aria-label="Book appointment">Book Appointment</a>

<!-- Bad: Non-semantic div -->
<div onclick="book()">Book Now</div>
```

### Text Content
- Should not replace above-the-fold headings
- Must have descriptive text (not just an icon)
- Keep alt text/aria-label accurate

---

## Core Web Vitals

### CLS (Cumulative Layout Shift)
- **Risk**: Medium
- **Solution**: Set fixed height and position from initial render
  ```css
  .sticky-cta {
    position: fixed;
    height: 56px; /* Defined upfront */
    bottom: 0;
    left: 0;
    width: 100%;
  }
  ```
- **Body compensation**: Add `padding-bottom: 56px` to prevent content jump

### LCP (Largest Contentful Paint)
- **Risk**: Low
- **Avoid**: Loading large icons or images inside sticky CTA
- **Use**: SVG icons or icon fonts (lightweight)

### INP (Interaction to Next Paint)
- **Risk**: Medium
- **Avoid**: Heavy JavaScript event listeners (especially scroll)
- **Recommended**: Pure CSS `position: fixed` or `position: sticky`
- **Event listeners**: Only `click` (no scroll, no intervals)

---

## Performance Rules

### ✅ DO
- Use pure CSS for positioning
- Use lightweight SVG icons
- Lazy-load non-critical icons
- Hydrate only on user interaction
- Keep JavaScript minimal

### ❌ AVOID
- JavaScript animations (use CSS transitions)
- Heavy framework components
- Scroll event listeners
- Animation intervals or requestAnimationFrame loops
- Loading external resources on every render

---

## Accessibility

### Requirements
```json
{
  "ariaRole": "button",
  "ariaLabel": "Book appointment",
  "keyboardFocusable": true,
  "contrastRatio": ">= 4.5:1",
  "hitArea": "48px minimum"
}
```

### Testing Checklist
- ✅ Tab navigation works
- ✅ Enter/Space triggers action
- ✅ Screen reader announces correctly
- ✅ Color contrast passes WCAG AA
- ✅ Touch target is large enough (48px+)

---

## Interaction States

### Hover
```css
.sticky-cta:hover {
  background: #FFE500;
  transform: scale(1.02);
}
```

### Active (Click)
```css
.sticky-cta:active {
  background: #FFD700;
  transform: scale(0.98);
}
```

### Transitions
```css
.sticky-cta {
  transition: all 0.15s ease-in-out;
}
```

---

## Allowed Content

### ✅ Allowed
- **Text**: "Book Appointment"
- **Icon**: Calendar or checkmark (20px SVG)
- **Loading spinner**: Optional, lightweight

### Example
```html
<button class="sticky-cta">
  <svg class="icon"><!-- Calendar icon --></svg>
  <span>Book Appointment</span>
</button>
```

---

## Disallowed Content

### ❌ Not Allowed
- Dropdown menus
- Multiple buttons
- Long paragraphs of text
- Advertisements
- Auto-play media or videos
- Social media widgets

---

## CSS Implementation

### Recommended CSS

```css
.sticky-cta {
  /* Positioning */
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 56px;
  z-index: 9999;

  /* Layout */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;

  /* Visual */
  background-color: #FFEC1A;
  color: #333333;
  border-radius: 999px 999px 0 0; /* Rounded top corners */
  box-shadow: 0px -2px 8px rgba(0, 0, 0, 0.1);
  font-weight: 600;

  /* Interaction */
  transition: all 0.15s ease-in-out;
  cursor: pointer;
}

.sticky-cta:hover {
  background-color: #FFE500;
  transform: scale(1.02);
}

.sticky-cta:active {
  background-color: #FFD700;
  transform: scale(0.98);
}

/* Body compensation to prevent content overlap */
body {
  padding-bottom: 56px;
}

/* Desktop: Floating button alternative */
@media (min-width: 768px) {
  .sticky-cta {
    bottom: 24px;
    right: 24px;
    left: auto;
    width: auto;
    padding: 12px 24px;
    border-radius: 999px; /* Fully rounded */
  }

  body {
    padding-bottom: 0; /* Remove padding on desktop */
  }
}
```

---

## JavaScript Usage

### Recommended
- **Minimal or none**: Pure CSS preferred
- **Event listeners**: `click` only
- **Hydration**: On interaction only

### Example (Minimal JS)
```javascript
// Only if needed for analytics or navigation
document.querySelector('.sticky-cta').addEventListener('click', function() {
  // Navigate to booking page or open modal
  window.location.href = '/booking';

  // Optional: Track analytics
  gtag('event', 'click', { event_category: 'CTA', event_label: 'Sticky Book' });
});
```

### ❌ Avoid
- Scroll event listeners
- Animation intervals (setInterval, requestAnimationFrame)
- Heavy framework re-renders
- Dynamic style calculations on scroll

---

## Implementation Checklist

### Before Launch
- [ ] Fixed height set in CSS (no layout shift)
- [ ] Body padding added to compensate for bar height
- [ ] Only one primary action ("Book Appointment")
- [ ] No content is covered by sticky bar
- [ ] Contrast ratio ≥ 4.5:1
- [ ] Click target ≥ 48px
- [ ] Keyboard accessible (Tab + Enter)
- [ ] Screen reader compatible (aria-label)
- [ ] No scroll event listeners
- [ ] Lightweight icons only (SVG, <5KB)
- [ ] Pure CSS positioning (no JS)
- [ ] Tested on mobile and desktop
- [ ] Core Web Vitals pass (CLS, LCP, INP)
- [ ] Does not overlap H1/H2/H3 tags

### Testing
1. **Lighthouse Audit**: Score 90+ on all metrics
2. **CLS Test**: No layout shift when sticky CTA appears
3. **Accessibility Test**: Run axe DevTools
4. **Mobile Test**: Touch target size and visibility
5. **Screen Reader Test**: VoiceOver/NVDA announces correctly

---

## Mobile vs Desktop Strategy

### Mobile-First
```
┌─────────────────────────┐
│                         │
│   Content scrolls       │
│                         │
│                         │
├─────────────────────────┤
│  [Book Appointment]     │  ← Always visible
└─────────────────────────┘
```

### Desktop (Option 1: Floating Button)
```
┌─────────────────────────────────┐
│                                 │
│   Content scrolls               │
│                                 │
│                                 │
│                       ┌────────┐│
│                       │ Book   ││ ← Small floating
└───────────────────────┴────────┘│   button bottom-right
```

### Desktop (Option 2: Bottom Bar)
```
┌─────────────────────────────────┐
│                                 │
│   Content scrolls               │
│                                 │
│                                 │
├─────────────────────────────────┤
│       [Book Appointment]        │ ← Thin bar, centered
└─────────────────────────────────┘
```

---

## Notes for Engineers

- **Framework**: Works with any (React, Vue, Next.js, vanilla)
- **SSR Compatible**: Yes (pure CSS, no hydration needed)
- **Bundle Impact**: Minimal (<1KB if implemented correctly)
- **Browser Support**: All modern browsers + IE11 (with fallback)
- **Testing Required**: Mobile, tablet, desktop, screen readers
- **Analytics**: Track clicks for conversion optimization

---

## Summary

A well-implemented sticky CTA:
- ✅ Increases conversions (especially mobile)
- ✅ Has zero SEO penalty
- ✅ Maintains excellent Core Web Vitals
- ✅ Is fully accessible
- ✅ Uses minimal resources (<1KB JS)
- ✅ Does not annoy users

**Key Principle**: Use CSS positioning, avoid JavaScript scroll listeners, compensate for bar height with body padding, and keep it simple.
