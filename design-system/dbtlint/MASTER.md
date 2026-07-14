# DBTLint Design System

This is the visual source of truth for DBTLint marketing surfaces. Page-level files in `pages/` may override these rules.

## Direction

- Pattern: real-time operations landing page
- Audience: analytics engineers, data leads, and platform teams
- Personality: precise, calm, technical, trustworthy
- Visual mode: dark-first, high-contrast, restrained ambient depth
- Conversion model: one primary action, supported by product evidence rather than generic claims

## Color tokens

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#020617` / Slate 950 | Page background and terminal surfaces |
| Surface | `#0F172A` / Slate 900 | Cards, navigation, elevated panels |
| Surface raised | `#1E293B` / Slate 800 | Hover and selected states |
| Border | `#334155` / Slate 700 | Strong borders and active separation |
| Border subtle | `#1E293B` / Slate 800 | Default dividers and card borders |
| Text | `#F8FAFC` / Slate 50 | Headings and primary labels |
| Text secondary | `#CBD5E1` / Slate 300 | Body copy |
| Text muted | `#64748B` / Slate 500 | Metadata and tertiary labels |
| Accent | `#34D399` / Emerald 400 | Primary CTA, success, focus, brand mark |
| Accent hover | `#6EE7B7` / Emerald 300 | Primary CTA hover |
| Warning | `#FCD34D` / Amber 300 | Lint warnings |
| Error | `#FDA4AF` / Rose 300 | Lint errors |

Use emerald for the primary action and positive system state only. Warning and error colors always appear with text or an icon.

## Typography

- Display and body: Geist Sans via `next/font`
- Technical labels, code, prices, and metrics: Geist Mono
- Display scale: 36/40 mobile, 48/52 tablet, 68/71 desktop
- Section headings: 30/36 mobile, 48/52 desktop
- Body: 16/28; supporting copy: 14/24
- Display tracking: `-0.035em` to `-0.045em`; body uses normal tracking
- Text measure: 60–72 characters for primary copy

## Layout and spacing

- Content width: `1200px`
- Gutters: `16px` mobile, `24px` tablet and desktop
- Base spacing unit: `4px`
- Core steps: `4, 8, 12, 16, 24, 32, 48, 64, 80, 96`
- Section padding: `80px` mobile, `96–112px` desktop
- Card radius: `16px`; major CTA radius: `24px`; controls: `8px`
- Minimum interactive height: `44px`

## Components

### Buttons

- Primary: Emerald 400 fill, Slate 950 text, 44–48px high, 8px radius
- Secondary: Slate 700 border, transparent or Slate 900 surface, Slate 100 text
- Hover transitions: color/elevation only, 200ms; no layout-shifting transforms
- Focus: visible 2–3px emerald ring
- Loading: disabled with explicit label; never leave an active control without feedback

### Cards

- Slate 900 at 55–100% opacity over Slate 950
- 1px Slate 800 border; Slate 700 on hover
- Use elevation only on the active conversion card or hero product frame
- Content hierarchy: technical eyebrow, outcome-led title, short explanation, evidence row

### Navigation

- Fixed at `z-50`, 64px high, translucent Slate 950 with backdrop blur
- Reserve hero top padding so content is never obscured
- Internal routes use Next.js `Link`; section anchors use native anchors

## Effects and motion

- Easing: `cubic-bezier(0.16, 1, 0.3, 1)`
- Entrance duration: 250–400ms; stagger: 60–80ms
- Animate opacity and transform only
- Ambient glow is static; continuous motion is limited to meaningful live/loading state
- Respect `prefers-reduced-motion` for every Framer Motion entrance
- Shadows are deep and cool: use Slate 950 at 30–55% opacity

## Accessibility

- Body copy targets WCAG AA contrast
- Every interactive item has a visible focus state and a minimum 44px target
- Icons are Lucide SVGs and decorative icons are hidden from assistive technology
- Navigation regions and the footer CTA have accessible labels
- Information is never communicated by color alone
- Layout must not introduce horizontal page scroll at 375px

## Avoid

- Multiple competing accent colors
- Decorative looping animation or large autoplay media
- Unsupported customer counts or vague social proof
- Emoji as interface icons
- Glass effects without a solid readable surface
- Tiny body copy, weak gray-on-gray contrast, and hover-only affordances
