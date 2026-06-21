# Move Status Bar Padding to Titlebar

**Date**: 2026-06-14  
**Approach**: A (Move `--sat` padding to Titlebar)  
**Scope**: Legacy design mode on Android

## Problem

Two UI layout issues on Android in legacy design mode:

1. **Home page**: Excessive space between content top and status bar
   - `padding-top: var(--sat)` on layout wrapper + `mt-55` on `LegacyHome` = double gap
   
2. **Other pages**: Top buttons hidden behind status bar
   - If `--sat` is 0 or miscalculated, titlebar sits under status bar with no protection

## Root Cause

`padding-top: var(--sat)` is applied to the **outermost layout div** in `layout.tsx`, pushing the entire UI (including the titlebar) down. This creates:

- Titlebar doesn't extend behind status bar (wasted vertical space)
- Page content adds its own top margins, compounding the gap
- Titlebar has no awareness of status bar — buttons can be obscured

## Solution

Move `--sat` padding from the layout wrapper to the Titlebar component. The titlebar extends behind the status bar, with buttons safely below the inset.

### Architecture Change

**Before:**
```
┌─ status bar ──────────────┐
│                            │  ← var(--sat) padding pushes everything down
├─ Titlebar (h-10) ─────────┤
├─ SyncStatusBar ───────────┤
├─ main content ─────────────┤
│  (pages add their own     │
│   top margins too)        │
```

**After:**
```
┌─ status bar ──────────────┐
│  Titlebar extends up      │  ← Titlebar gets padding-top: var(--sat)
│  (buttons below inset)    │     so it renders behind the status bar
├─ Titlebar content ────────┤     with buttons safely below
├─ SyncStatusBar ───────────┤
├─ main content ─────────────┤  ← No extra padding-top from layout
│  (reduced page margins)   │
```

## Changes Required

### 1. `app/src/pages/layout.tsx`

**Legacy design branch** (line ~2375):
- Remove `"padding-top": "var(--sat)"` from outer div's inline style
- Keep `"padding-bottom": "var(--sab)"` (mobile tab bar still needs it)

**V2 design branch** (line ~2360):
- Same change: remove `"padding-top": "var(--sat)"` from outer div

### 2. `app/src/components/titlebar.tsx`

**Titlebar component** (line ~230):
- Add `padding-top: var(--sat)` to the `<header>` element's style
- This makes the titlebar extend behind the status bar
- Titlebar's fixed height (`h-10` = 40px legacy, `h-9` = 36px V2) effectively becomes `calc(height + var(--sat))`
- Buttons inside titlebar are positioned below the internal padding, so they'll be visible

### 3. `app/src/pages/home.tsx`

**LegacyHome component** (line ~1096):
- Reduce `mt-55` to `mt-4` or similar
- Status bar gap is now handled by titlebar, not by page margin

## What Stays The Same

- `mobile.css` — CSS fallback `--sat: env(safe-area-inset-top, 0px)` remains
- `MainActivity.java` — Java injection of `--sat`/`--sab` CSS variables remains
- `var(--sab)` bottom padding on layout div remains (mobile tab bar handles its own bottom inset)
- `viewport-fit=cover` meta tag remains (already present in `app/index.html`)

## Testing

1. **Home page**: Verify reduced top gap — content should start ~16px below titlebar, not ~220px
2. **Session page**: Verify top buttons (back/forward, new session) are visible and not obscured by status bar
3. **All pages**: Verify titlebar extends behind status bar with buttons safely below
4. **Bottom navigation**: Verify mobile tab bar still respects `--sab` for bottom inset

## Files Modified

- `app/src/pages/layout.tsx` (2 locations: legacy + V2 design branches)
- `app/src/components/titlebar.tsx` (1 location: header element)
- `app/src/pages/home.tsx` (1 location: LegacyHome mt-55)

## Risk

**Low**: Changes are localized to layout/titlebar components. No data flow or state management affected. Visual-only change with clear before/after comparison possible.
