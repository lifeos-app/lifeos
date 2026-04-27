# LifeOS Design Tokens

This directory contains the single source of truth for all design tokens used across LifeOS.

## Files

| File | Purpose |
|------|---------|
| `tokens.css` | **Authoritative token definitions** — all CSS custom properties |
| `design-system.css` | Utility classes, animations, glass effects (references tokens) |
| `theme.css` | Theme application, global resets (imports design-system.css) |
| `mobile.css` | Mobile-specific responsive overrides |
| `performance.css` | Performance-focused CSS utilities |

## How to Use Tokens

**Always prefer `var(--token-name)` over raw values:**

```css
/* ✗ Bad — raw hex value */
.my-card {
  color: #F9FAFB;
  background: rgba(17, 24, 39, 0.8);
  border-radius: 14px;
  padding: 16px;
}

/* ✓ Good — uses design tokens */
.my-card {
  color: var(--color-text-primary);
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}
```

## Token Categories

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg-primary` | `#0A0E1A` | Main background |
| `--color-bg-secondary` | `#111827` | Secondary panels, sidebar |
| `--color-bg-tertiary` | `#1F2937` | Elevated surfaces |
| `--color-bg-card` | `rgba(17, 24, 39, 0.8)` | Glass card background |
| `--color-accent` | `#00D4FF` | Primary accent (cyan) |
| `--color-accent-2` | `#39FF14` | Secondary accent (neon green) |
| `--color-accent-gold` | `#FFD700` | Gold accent |
| `--color-accent-orange` | `#F97316` | Orange accent |
| `--color-accent-purple` | `#8B5CF6` | Purple accent |
| `--color-accent-rose` | `#F43F5E` | Rose accent |
| `--color-text-primary` | `#F9FAFB` | Main body text |
| `--color-text-secondary` | `#9CA3AF` | Supporting text |
| `--color-text-muted` | `#6B7280` | Captions, muted text |
| `--color-success` | `#22C55E` | Success states |
| `--color-warning` | `#F59E0B` | Warning states |
| `--color-danger` | `#EF4444` | Error/danger states |

### Theme Overrides
The `--theme-*` tokens are dynamically overridden by `themes.ts` at runtime based on user theme selection. Components that need to react to theme changes should use `--theme-bg`, `--theme-accent`, etc.

### Spacing
| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | `4px` | Micro gaps, icon padding |
| `--space-2` | `8px` | Compact gap, inline |
| `--space-3` | `12px` | Default gap |
| `--space-4` | `16px` | Standard padding |
| `--space-5` | `20px` | Medium padding |
| `--space-6` | `24px` | Large padding |
| `--space-8` | `32px` | Section spacing |
| `--space-10` | `40px` | Major section gap |
| `--space-12` | `48px` | Page margins |
| `--space-16` | `64px` | Hero spacing |

### Typography
| Token | Value | Usage |
|-------|-------|-------|
| `--font-display` | `'Orbitron', monospace` | Headings, numbers, display |
| `--font-body` | `'Poppins', sans-serif` | Body text, UI |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', monospace` | Code, data |
| `--text-xs` | `11px` | Captions |
| `--text-sm` | `13px` | Small text |
| `--text-base` | `15px` | Body |
| `--text-lg` | `18px` | Subheadings |
| `--text-xl` | `24px` | Headings |
| `--text-2xl` | `28px` | Large headings |

### Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| `--radius-xs` | `4px` | Small elements |
| `--radius-sm` | `6px` | Badges, chips |
| `--radius-base` | `8px` | Inputs, small cards |
| `--radius-md` | `10px` | Buttons, cards |
| `--radius-lg` | `14px` | Main cards, panels |
| `--radius-xl` | `20px` | Large cards |
| `--radius-2xl` | `28px` | Modals |
| `--radius-full` | `9999px` | Pills, avatars |

### Shadows
| Token | Value |
|-------|-------|
| `--shadow-elevation-sm` | `0 2px 8px rgba(0, 0, 0, 0.2)` |
| `--shadow-elevation-md` | `0 4px 16px rgba(0, 0, 0, 0.3)` |
| `--shadow-elevation-lg` | `0 8px 32px rgba(0, 0, 0, 0.4)` |
| `--shadow-glow-cyan` | `0 0 20px rgba(0, 212, 255, 0.3)` |

## Common Value Mappings (old → new)

| Old (raw) | New (token) |
|-----------|-------------|
| `#0A0E1A` | `var(--color-bg-primary)` |
| `#111827` | `var(--color-bg-secondary)` |
| `#1F2937` | `var(--color-bg-tertiary)` |
| `#00D4FF` | `var(--color-accent)` or `var(--theme-accent)` |
| `#39FF14` | `var(--color-accent-2)` |
| `#F9FAFB` | `var(--color-text-primary)` |
| `#9CA3AF` | `var(--color-text-secondary)` |
| `#6B7280` | `var(--color-text-muted)` |
| `#EF4444` | `var(--color-danger)` |
| `#10B981` / `#22C55E` | `var(--color-success)` |
| `rgba(255, 255, 255, 0.08)` | `var(--color-border-default)` |
| `rgba(255, 255, 255, 0.06)` | `var(--color-border-subtle)` |
| `rgba(255, 255, 255, 0.12)` | `var(--color-border-strong)` |
| `rgba(17, 24, 39, 0.8)` | `var(--color-bg-card)` or `var(--glass-bg)` |

## Note on Legacy Variables

The existing `design-system.css` and `theme.css` already define some overlapping variables (e.g. `--bg-primary`, `--accent-cyan`, `--text-primary`). The new `tokens.css` introduces a unified `--color-*` / `--space-*` / `--radius-*` naming convention. During the migration period, both systems coexist. Future tasks will gradually migrate component CSS to use the new tokens.

## Adding New Tokens

1. Add the token definition in `tokens.css` under the appropriate category
2. Use the correct naming convention: `--color-*`, `--space-*`, `--text-*`, `--radius-*`, `--shadow-*`, `--gradient-*`, `--glass-*`
3. Document it in this README's tables above
4. Reference it with `var(--token-name)` in your component CSS