---
trigger: glob
globs: web/app/**, web/components/**, web/lib/theme.ts, web/lib/stage/**
---

# UI rule: neo-brutalist press sheet

You are editing UI code. Apply the design system below exactly; it overrides your default style.

Before finishing any UI change:
1. Use only tokens from `web/app/tokens.css` (CSS) or `web/lib/theme.ts` (canvas). No new colors.
2. Square corners, 4px black borders, hard shadows `x y 0 0 ink`, uppercase heavy display type.
3. No gradients, blur, glow, glass, rounded corners, soft shadows, pills, or emoji icons.
4. Run `npm run check:design` and fix every violation in the code (never in the script).
5. Screenshot the result at 1440×900 and 390×844 and compare against section 3 of the system.

@[DESIGN.md](../../DESIGN.md)
