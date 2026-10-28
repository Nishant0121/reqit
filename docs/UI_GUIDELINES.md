# Reqit: UI Guidelines

These rules are **strict**. Every UI change must follow them, and a pull request that breaks one should not be merged. Words are used in the RFC sense: **MUST** and **MUST NOT** are hard rules, **SHOULD** is the default unless there is a written reason.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Spacing, Sizing, and Shape](#4-spacing-sizing-and-shape)
5. [Layout and Window Constraints](#5-layout-and-window-constraints)
6. [Components](#6-components)
7. [Filters and Search](#7-filters-and-search)
8. [States: Loading, Empty, Error](#8-states-loading-empty-error)
9. [Icons, Motion, and Elevation](#9-icons-motion-and-elevation)
10. [Keyboard and Accessibility](#10-keyboard-and-accessibility)
11. [Content and Copy Rules](#11-content-and-copy-rules)
12. [Performance Constraints](#12-performance-constraints)
13. [Forbidden List](#13-forbidden-list)
14. [Enforcement and PR Checklist](#14-enforcement-and-pr-checklist)

---

## 1. Design Principles

1. **Tool, not a platform.** The UI is quiet, dense, and fast. No marketing banners, upsells, onboarding popups, or login prompts. Ever.
2. **Content first.** Requests and responses are the product. Chrome (borders, toolbars, decoration) stays minimal.
3. **Keyboard first.** Every common action has a shortcut and a command palette entry.
4. **Predictable.** The same action looks and behaves the same everywhere.
5. **Honest.** Errors say what happened and what to do. Nothing fails silently.
6. **Safe by default.** Destructive and secret-related actions are visually distinct and need confirmation or are undoable.
7. **Respect the system.** Follow the OS theme, reduced-motion setting, and text scaling.

---

## 2. Color System

Palette name: **Terminal & Slate**. Deep slate surfaces, a single electric-cyan accent, and fixed semantic hues for HTTP methods, response statuses, test results, and Git state.

**Dark is the primary design target.** Design and review every screen in dark first, then verify light.

### 2.1 Rules

- Components MUST use **design tokens** (CSS variables) only. Raw hex, `rgb()`, or named colors in component code are forbidden. Tailwind arbitrary color values (`bg-[#fff]`) and Tailwind's default palette (`bg-blue-500`) are forbidden.
- Every token has a **dark** and a **light** value. A new token is not complete until both exist.
- Text and essential UI elements MUST meet **WCAG AA**: 4.5:1 for normal text, 3:1 for large text (18px+ or 14px+ bold), icons, input borders, and focus rings. Verify with a contrast tool before merging any new color.
- **Color MUST NOT be the only way to convey information.** Pair color with text, an icon, or a shape (a status badge shows the number and the text, not just a colored dot).
- **One accent color only: cyan.** Green, amber, blue, red, yellow, and indigo are reserved for meaning (methods, statuses, tests, Git) and never used for decoration.
- No gradients anywhere.
- **Two variants of each semantic hue.** The _base_ hue (your palette value) is identical in both themes and is used for **non-text marks** (status dots, waterfall bars, left-edge markers) that always sit next to text. The _text-safe_ variant is used whenever the color is applied to **text**. See 2.3.
- Components MUST NOT use Tailwind `dark:` variants. The tokens switch themes by themselves.

### 2.2 Surface, border, text, and accent tokens

Dark values are the defaults, so the app is dark if no preference is available.

```css
:root,
:root[data-theme='dark'] {
  /* Surfaces */
  --bg-base: #0f1117; /* app shell, request editor area */
  --bg-surface: #161922; /* sidebar, response panel, toolbars, tab bar */
  --bg-elevated: #1e222e; /* menus, modals, popovers, tooltips, command palette */
  --bg-hover: #1e222e; /* row hover on base/surface */
  --bg-active: #2a2f3d; /* hover/pressed on elevated surfaces, pressed rows */
  --bg-input: #0f1117; /* text inputs, selects */
  --bg-overlay: rgba(0, 0, 0, 0.6); /* modal backdrop */

  /* Borders */
  --border: #2a2f3d; /* dividers, splitters, panel edges */
  --border-strong: #6b7280; /* input and control borders (3:1 required) */

  /* Text */
  --text-primary: #f3f4f6;
  --text-secondary: #d1d5db;
  --text-muted: #9ca3af; /* file sizes, timestamps, placeholders */
  --text-disabled: #6b7280; /* disabled controls only, exempt from AA */

  /* Accent */
  --accent: #06b6d4; /* focus ring, active tab underline, icons, markers */
  --accent-strong: #06b6d4; /* primary button fill, accent text and links */
  --accent-hover: #0891b2; /* primary button hover */
  --accent-subtle: rgba(6, 182, 212, 0.16); /* selected row background */
  --accent-fg: #0f1117; /* text on --accent-strong (dark text, not white) */
  --focus-ring: #06b6d4;
}

:root[data-theme='light'] {
  /* Surfaces */
  --bg-base: #f9fafb;
  --bg-surface: #ffffff;
  --bg-elevated: #f3f4f6;
  --bg-hover: #f3f4f6;
  --bg-active: #e5e7eb;
  --bg-input: #ffffff;
  --bg-overlay: rgba(17, 24, 39, 0.45);

  /* Borders */
  --border: #e5e7eb;
  --border-strong: #8a919e;

  /* Text */
  --text-primary: #111827;
  --text-secondary: #4b5563;
  --text-muted: #6b7280;
  --text-disabled: #9ca3af;

  /* Accent */
  --accent: #0891b2; /* focus ring, underline, icons (non-text only) */
  --accent-strong: #0e7490; /* primary button fill, accent text and links */
  --accent-hover: #155e75;
  --accent-subtle: #cffafe;
  --accent-fg: #ffffff;
  --focus-ring: #0891b2;
}
```

Surface roles at a glance:

| Role                                    | Dark      | Light     | Where                                      |
| --------------------------------------- | --------- | --------- | ------------------------------------------ |
| Base (Abyssal Slate / Canvas White)     | `#0F1117` | `#F9FAFB` | App shell, request editor area             |
| Surface (Deep Charcoal / Pure White)    | `#161922` | `#FFFFFF` | Sidebar, response panel, toolbars, tab bar |
| Elevated (Charcoal Lift / Light Gray)   | `#1E222E` | `#F3F4F6` | Menus, modals, tooltips, cards             |
| Border (Subtle Grid / Border Gray)      | `#2A2F3D` | `#E5E7EB` | Dividers, splitters, tree lines            |
| Text primary (Crisp White / Dark Slate) | `#F3F4F6` | `#111827` | Headings, active items, input text         |
| Text muted (Slate Gray / Cool Gray)     | `#9CA3AF` | `#6B7280` | Metadata, placeholders                     |
| Accent (Electric Cyan / Deep Cyan)      | `#06B6D4` | `#0891B2` | Focus, active states, markers              |

### 2.3 Semantic hue tokens (HTTP, tests, Git)

| Hue                    | Base (both themes, marks only) | Text on dark | Text on light | Subtle bg (dark)        | Subtle bg (light) |
| ---------------------- | ------------------------------ | ------------ | ------------- | ----------------------- | ----------------- |
| Green                  | `#10B981`                      | `#10B981`    | `#047857`     | `rgba(16,185,129,0.14)` | `#ECFDF5`         |
| Amber                  | `#F59E0B`                      | `#F59E0B`    | `#92400E`     | `rgba(245,158,11,0.14)` | `#FFFBEB`         |
| Blue                   | `#3B82F6`                      | `#60A5FA`    | `#1D4ED8`     | `rgba(59,130,246,0.16)` | `#EFF6FF`         |
| Red                    | `#EF4444`                      | `#F87171`    | `#B91C1C`     | `rgba(239,68,68,0.14)`  | `#FEF2F2`         |
| Yellow (Git modified)  | `#EAB308`                      | `#EAB308`    | `#854D0E`     | n/a                     | n/a               |
| Green (Git staged)     | `#22C55E`                      | `#22C55E`    | `#166534`     | n/a                     | n/a               |
| Indigo (Git untracked) | `#6366F1`                      | `#818CF8`    | `#4F46E5`     | n/a                     | n/a               |

Semantic tokens (component code uses these names, never the hex):

```css
:root,
:root[data-theme='dark'] {
  --success: #10b981;
  --success-mark: #10b981;
  --success-subtle: rgba(16, 185, 129, 0.14);
  --warning: #f59e0b;
  --warning-mark: #f59e0b;
  --warning-subtle: rgba(245, 158, 11, 0.14);
  --info: #60a5fa;
  --info-mark: #3b82f6;
  --info-subtle: rgba(59, 130, 246, 0.16);
  --danger: #f87171;
  --danger-mark: #ef4444;
  --danger-subtle: rgba(239, 68, 68, 0.14);

  --danger-solid: #dc2626; /* destructive button fill, white text */
  --danger-solid-hover: #b91c1c;

  --git-modified: #eab308;
  --git-staged: #22c55e;
  --git-untracked: #818cf8;
}

:root[data-theme='light'] {
  --success: #047857;
  --success-mark: #10b981;
  --success-subtle: #ecfdf5;
  --warning: #92400e;
  --warning-mark: #f59e0b;
  --warning-subtle: #fffbeb;
  --info: #1d4ed8;
  --info-mark: #3b82f6;
  --info-subtle: #eff6ff;
  --danger: #b91c1c;
  --danger-mark: #ef4444;
  --danger-subtle: #fef2f2;

  --danger-solid: #b91c1c;
  --danger-solid-hover: #991b1b;

  --git-modified: #854d0e;
  --git-staged: #166534;
  --git-untracked: #4f46e5;
}
```

- Use `--success`, `--warning`, `--info`, `--danger` for **text and icons**.
- Use the `-mark` tokens for **dots, bars, and chart fills** only.
- Use `-subtle` for backgrounds of badges, banners, and test rows, with the text-safe color on top.

### 2.4 HTTP method colors

Method labels MUST always be shown as **text** (for example `GET`) in the monospace font, bold, uppercase.

| Method    | Token          | Dark text | Light text | Mark      |
| --------- | -------------- | --------- | ---------- | --------- |
| `GET`     | `--success`    | `#10B981` | `#047857`  | `#10B981` |
| `POST`    | `--warning`    | `#F59E0B` | `#92400E`  | `#F59E0B` |
| `PUT`     | `--info`       | `#60A5FA` | `#1D4ED8`  | `#3B82F6` |
| `PATCH`   | `--info`       | `#60A5FA` | `#1D4ED8`  | `#3B82F6` |
| `DELETE`  | `--danger`     | `#F87171` | `#B91C1C`  | `#EF4444` |
| `HEAD`    | `--text-muted` | `#9CA3AF` | `#6B7280`  | n/a       |
| `OPTIONS` | `--text-muted` | `#9CA3AF` | `#6B7280`  | n/a       |

PUT and PATCH share blue, so the text label is what tells them apart. HEAD and OPTIONS are neutral so they never compete with the five hues above.

In the sidebar, method labels are shortened to fit a fixed 44px column: `GET`, `POST`, `PUT`, `PTCH`, `DEL`, `HEAD`, `OPT`.

### 2.5 HTTP status colors

| Class                       | Token          | Badge text example          |
| --------------------------- | -------------- | --------------------------- |
| 1xx                         | `--info`       | `101 Switching Protocols`   |
| 2xx                         | `--success`    | `200 OK`                    |
| 3xx                         | `--info`       | `301 Moved Permanently`     |
| 4xx                         | `--warning`    | `404 Not Found`             |
| 5xx                         | `--danger`     | `500 Internal Server Error` |
| Network error (no response) | `--danger`     | `Network error`             |
| Cancelled                   | `--text-muted` | `Cancelled`                 |

The badge MUST show the numeric code **and** the status text, on the matching `-subtle` background.

Test results use the same tokens: passed is `--success`, failed is `--danger`, skipped is `--text-muted`, and each has an icon and the words "Passed", "Failed", or "Skipped".

### 2.6 Git and sync status colors

Used in the sidebar tree, tabs, and the Git panel (Phase 27).

| State                  | Marker | Token             | Meaning                                  |
| ---------------------- | ------ | ----------------- | ---------------------------------------- |
| Modified / uncommitted | `M`    | `--git-modified`  | File differs from the last commit        |
| Staged / synced        | `S`    | `--git-staged`    | Staged for commit, or matches the remote |
| Untracked              | `U`    | `--git-untracked` | New file Git does not know about yet     |
| Deleted                | `D`    | `--danger`        | Removed from disk or staged for deletion |

- The marker is a single letter in the monospace font (11px, bold) in a fixed 16px column at the right edge of the tree row. A tooltip gives the full word ("Modified").
- Folders show a dot (`--git-modified`) when any child is modified.
- Because Git staged green (`#22C55E`) is close to GET green (`#10B981`), the two never appear in the same place: Git markers sit only at the right edge of tree rows and in the Git panel, and method labels sit only at the left.

### 2.7 Syntax highlighting tokens

Editor colors come from a fixed set so JSON, XML, HTML, YAML, and script views match.

| Token                  | Dark                            | Light                           |
| ---------------------- | ------------------------------- | ------------------------------- |
| Keys / properties      | `#22D3EE`                       | `#0E7490`                       |
| Strings                | `#34D399`                       | `#047857`                       |
| Numbers                | `#FBBF24`                       | `#92400E`                       |
| Booleans / null        | `#818CF8`                       | `#4F46E5`                       |
| Punctuation            | `#9CA3AF`                       | `#6B7280`                       |
| Comments               | `#9CA3AF` (italic)              | `#6B7280` (italic)              |
| Invalid / error        | `#F87171`                       | `#B91C1C`                       |
| `{{variable}}` known   | `#22D3EE` on `--accent-subtle`  | `#0E7490` on `--accent-subtle`  |
| `{{variable}}` unknown | `--danger` on `--danger-subtle` | `--danger` on `--danger-subtle` |

The editor background is `--bg-base`. The response body background is `--bg-surface`. Selection uses `--accent-subtle`.

### 2.8 Theme behavior

- Three options: **System** (default), **Light**, **Dark**. If the OS reports no preference, use **Dark**.
- The saved theme MUST be applied (`data-theme` set on `<html>`) before first paint, so there is no flash of the wrong theme.
- Switching themes applies instantly without reloading.
- No component may look broken in either theme. Both are tested.
- Support `forced-colors` (Windows High Contrast): keep borders on all interactive elements so boundaries do not depend on background colors.

### 2.9 Contrast rules and deviations from the source palette

The source palette is used as the base. The following adjustments are required because some of its pairs fall below WCAG AA. Ratios are approximate and MUST be re-checked with the CI contrast script (Section 14).

| Issue in the source palette                                                                      | Approx. ratio | Rule in this document                                                                                                                                   |
| ------------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| White text on Deep Cyan `#0891B2` (light primary button)                                         | ~3.7:1        | Light primary buttons use `--accent-strong` `#0E7490` with white text (~5.4:1). `#0891B2` stays for focus rings, underlines, and icons.                 |
| Deep Cyan `#0891B2` as link text on white                                                        | ~3.7:1        | Accent text in light mode uses `--accent-strong`.                                                                                                       |
| White text on Electric Cyan `#06B6D4` (dark primary button)                                      | ~2.4:1        | Dark primary buttons use dark text `--accent-fg` `#0F1117` (~7.8:1).                                                                                    |
| Source method/status hues (`#10B981`, `#F59E0B`, `#3B82F6`, `#EF4444`) as text on light surfaces | ~2.1 to 3.8:1 | Light-mode text uses the darker text-safe variants in 2.3. The source hex values stay as the base for marks, and as dark-mode text for green and amber. |
| Blue `#3B82F6` and red `#EF4444` as text on `--bg-elevated` in dark                              | ~4.2 to 4.3:1 | Dark-mode blue and red **text** uses `#60A5FA` and `#F87171`.                                                                                           |
| Indigo `#6366F1` as text on dark surfaces                                                        | ~3.9:1        | Dark-mode untracked marker uses `#818CF8`.                                                                                                              |
| Border `#2A2F3D` as an input outline on `#0F1117`                                                | ~1.4:1        | Control borders use `--border-strong`. `--border` is for dividers only.                                                                                 |
| Muted text `#6B7280` on `#F3F4F6` (light elevated or hover)                                      | ~4.4:1        | In light mode, text on `--bg-elevated`, `--bg-hover`, or `--bg-active` uses `--text-secondary`, not `--text-muted`.                                     |
| White text on source red `#EF4444` (destructive button)                                          | ~3.8:1        | Destructive buttons use `--danger-solid` with white text.                                                                                               |

Colors added that are not in the source palette: `--text-secondary`, `--border-strong`, `--bg-hover`, `--bg-active`, `--bg-input`, `--bg-overlay`, `--accent-strong`, `--accent-subtle`, `--danger-solid`, the subtle backgrounds, the HEAD/OPTIONS and 1xx choices, and the Deleted and syntax colors.

### 2.10 Tailwind mapping

Do not use a config with fixed hex values. It cannot switch themes. Map Tailwind names to the CSS variables instead, and replace the default palette so stray colors cannot be used.

```javascript
// tailwind.config.js (Tailwind v3 syntax; in v4 declare the same names in @theme)
module.exports = {
  darkMode: ['selector', '[data-theme="dark"]'], // available, but components do not use dark:
  theme: {
    colors: {
      // replaces the default palette on purpose
      transparent: 'transparent',
      current: 'currentColor',

      base: 'var(--bg-base)',
      surface: 'var(--bg-surface)',
      elevated: 'var(--bg-elevated)',
      hover: 'var(--bg-hover)',
      active: 'var(--bg-active)',
      input: 'var(--bg-input)',
      overlay: 'var(--bg-overlay)',

      line: 'var(--border)',
      'line-strong': 'var(--border-strong)',

      content: {
        DEFAULT: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        disabled: 'var(--text-disabled)',
      },

      accent: {
        DEFAULT: 'var(--accent)',
        strong: 'var(--accent-strong)',
        hover: 'var(--accent-hover)',
        subtle: 'var(--accent-subtle)',
        fg: 'var(--accent-fg)',
      },

      success: {
        DEFAULT: 'var(--success)',
        mark: 'var(--success-mark)',
        subtle: 'var(--success-subtle)',
      },
      warning: {
        DEFAULT: 'var(--warning)',
        mark: 'var(--warning-mark)',
        subtle: 'var(--warning-subtle)',
      },
      info: { DEFAULT: 'var(--info)', mark: 'var(--info-mark)', subtle: 'var(--info-subtle)' },
      danger: {
        DEFAULT: 'var(--danger)',
        mark: 'var(--danger-mark)',
        subtle: 'var(--danger-subtle)',
        solid: 'var(--danger-solid)',
        'solid-hover': 'var(--danger-solid-hover)',
      },

      git: {
        modified: 'var(--git-modified)',
        staged: 'var(--git-staged)',
        untracked: 'var(--git-untracked)',
      },
    },
  },
};
```

Usage examples: `bg-surface text-content border-line`, `bg-accent-strong text-accent-fg hover:bg-accent-hover`, `text-success`, `bg-danger-subtle text-danger`.

Opacity modifiers (`bg-accent/50`) do not work with these variables and are forbidden. If a tint is needed, add a named token for it.

---

## 3. Typography

### 3.1 Fonts

- **UI font:** Inter (bundled with the app). Fallback: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- **Monospace font:** JetBrains Mono (bundled). Fallback: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.
- Fonts MUST be bundled. **No fonts or assets are loaded from the network**, because the app must work offline.
- Use the monospace font for: URLs, headers, bodies, variables, code, JSON, status codes, method labels, and IDs. Use the UI font for everything else.
- Users MAY change the editor font size and family in settings. The UI font is fixed.

### 3.2 Type scale (fixed, no other sizes)

| Token         | Size / Line height | Weight    | Use                                    |
| ------------- | ------------------ | --------- | -------------------------------------- |
| `--text-xs`   | 11px / 16px        | 500       | Badges, status bar, keyboard hints     |
| `--text-sm`   | 12px / 16px        | 400 / 500 | Secondary text, table cells, labels    |
| `--text-base` | 13px / 20px        | 400 / 500 | **Default** body, inputs, sidebar rows |
| `--text-md`   | 14px / 20px        | 500 / 600 | Section headings, dialog text          |
| `--text-lg`   | 16px / 24px        | 600       | Dialog titles, empty-state titles      |
| `--text-xl`   | 20px / 28px        | 600       | Welcome screen heading only            |

- Weights allowed: 400, 500, 600. No 300, 700, 800, or italics except for comments in code.
- Letter spacing stays at default, except uppercase badges (`+0.02em`).
- Never use all-caps for sentences. Uppercase is allowed only for method labels and small badges.
- Text MUST scale with the OS font-size setting and the app zoom (Ctrl/Cmd +, -, 0). Layouts MUST NOT break at 150% zoom.

---

## 4. Spacing, Sizing, and Shape

### 4.1 Spacing scale (4px base, no other values)

`2, 4, 8, 12, 16, 24, 32` px. Tokens: `--space-0-5, --space-1, --space-2, --space-3, --space-4, --space-6, --space-8`.

- Inside compact controls and rows: 4 or 8.
- Between related items: 8.
- Between groups or sections: 16 or 24.
- Dialog padding: 24. Panel padding: 12 or 16.

### 4.2 Control heights (fixed)

| Size        | Height | Use                               |
| ----------- | ------ | --------------------------------- |
| Compact     | 24px   | Table cells, toolbar icon buttons |
| **Default** | 28px   | Inputs, buttons, selects, rows    |
| Large       | 32px   | Dialog primary buttons, URL bar   |

Hit areas MUST be at least 24 x 24px. Icon-only buttons MUST have a tooltip and an `aria-label`.

### 4.3 Radius

| Token           | Value | Use                              |
| --------------- | ----- | -------------------------------- |
| `--radius-sm`   | 4px   | Inputs, buttons, badges, rows    |
| `--radius-md`   | 6px   | Menus, popovers, cards           |
| `--radius-lg`   | 8px   | Modals                           |
| `--radius-full` | 999px | Only for status dots and avatars |

### 4.4 Borders

- 1px solid. No 2px borders except the focus ring.
- Panels are separated by a single 1px `--border` line, not by shadows or gaps.

---

## 5. Layout and Window Constraints

```
┌──────────────────────────────────────────────────────────────────────┐
│ Top bar (40px): collection name · environment selector · settings    │
├──────────────┬───────────────────────────────────────────────────────┤
│ Sidebar      │ Request tabs (32px)                                   │
│ (280px)      ├───────────────────────────────────────────────────────┤
│              │ URL bar: [Method] [URL ..................] [Send]      │
│ Collections  ├───────────────────────────────────────────────────────┤
│ History      │ Request panel (params, headers, body, auth, scripts)  │
│              ├─────────────────── drag handle ───────────────────────┤
│              │ Response panel (body, headers, cookies, timing, tests)│
├──────────────┴───────────────────────────────────────────────────────┤
│ Status bar (24px): git branch · env · history count · app version    │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.1 Fixed dimensions

| Element                | Rule                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| Minimum window size    | **960 x 600px**. The window cannot be resized smaller.                                                          |
| Top bar                | 40px high                                                                                                       |
| Tab bar                | 32px high                                                                                                       |
| Status bar             | 24px high                                                                                                       |
| Sidebar width          | Default 280px, min 220px, max 480px, resizable, collapsible (Ctrl/Cmd+B)                                        |
| Request/response split | Vertical by default, switchable to horizontal. Each pane has a **minimum of 200px**.                            |
| Sidebar tree row       | 28px high, indent 16px per level, maximum nesting displayed: unlimited, but indent stops growing after 8 levels |
| Modal width            | 480px (small), 640px (default), 800px (large). Max height 80% of the window. Content scrolls inside.            |

### 5.2 Layout rules

- Layout MUST NOT shift when content loads. Reserve space for badges, counts, and scrollbars.
- Only one primary scroll area per panel. No nested scroll areas that fight each other.
- Panel sizes, sidebar state, and split direction are **remembered** between sessions.
- Long text never overflows: single-line items truncate with an ellipsis and show the full text in a tooltip. Multi-line areas wrap or scroll.
- The URL field is a single line that scrolls horizontally and never wraps.
- Do not use `position: fixed` overlays except for modals, toasts, and the command palette.

---

## 6. Components

All components live in `packages/desktop/src/renderer/components/ui/`. Do not build one-off versions inside feature code.

### 6.1 Buttons

| Variant       | Look                                                                                             | Use                                         |
| ------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| **Primary**   | `--accent-strong` background (`--accent-hover` on hover), `--accent-fg` text                     | One per view or dialog (Send, Save, Import) |
| **Secondary** | `--bg-elevated` background, 1px `--border` border, `--text-primary` text, `--bg-active` on hover | Default actions                             |
| **Ghost**     | Transparent, `--text-secondary`, hover `--bg-hover`                                              | Toolbars, icon buttons                      |
| **Danger**    | `--danger-solid` background (`--danger-solid-hover` on hover), white text                        | Confirm destructive actions only            |

- Only **one primary button** per dialog or view area.
- Button labels are verbs: "Send", "Save", "Import", "Delete request". Never "OK" or "Yes".
- Disabled buttons use `--text-disabled`, show `not-allowed`, and explain why in a tooltip when the reason is not obvious.
- Loading buttons keep their width, show a spinner, and are not clickable.
- The Send button becomes **Cancel** while a request is in flight (same position, same width).

### 6.2 Inputs and selects

- 28px high, 1px `--border-strong` border, `--bg-input` background, `--radius-sm`.
- Focus: 2px `--focus-ring` outline with a 1px offset. The focus ring MUST NOT be removed anywhere.
- Error state: `--danger` border plus an error message below, in `--text-sm`.
- Placeholders use `--text-muted` and show an example, not an instruction ("https://api.example.com/users").
- Fields that accept `{{variables}}` highlight them and offer autocomplete on typing `{{`.

### 6.3 Key-value tables (params, headers, form data)

- Columns: enable checkbox, key, value, description (optional), delete button.
- A blank row is always kept at the bottom; typing in it creates a new row.
- Disabled rows are shown with `--text-muted` and a strikethrough-free dimmed look.
- Rows can be reordered by dragging. Bulk edit mode (raw text) is available.

### 6.4 Tabs

- Underline style, 2px `--accent` underline for the active tab.
- Request tabs show: method (short, colored), name, an unsaved dot, and a close button on hover.
- Tab labels truncate at 180px. Preview tabs (single click) are shown in italics-free muted style and are replaced by the next preview.
- Count badges on sub-tabs (for example `Headers 4`, `Tests 3/5`) use `--text-xs`.

### 6.5 Sidebar tree

- Folder rows: chevron + folder icon + name. Request rows: method label (44px column) + name.
- Selected row: `--accent-subtle` background plus a 2px `--accent` bar on the left.
- Hover: `--bg-hover`. Right-click opens a context menu. F2 renames inline.
- Rows with a parse error show a `--danger` warning icon and a tooltip with the error.
- Files with Git changes (after Phase 27) show a status letter in a fixed 16px column at the right edge: `M`, `S`, `U`, or `D`, colored as defined in 2.6.

### 6.6 Response viewer

- Header strip: status badge, time, size, then actions (copy, save, search).
- The body is **read-only** and uses the monospace font.
- Default view is Pretty if the content type is recognized, otherwise Raw.
- Large bodies (over 5 MB) show a notice and load lazily. They never block typing or scrolling.
- Timing tab shows a waterfall chart with one row per phase (DNS, TCP, TLS, TTFB, Download), each with its duration as text.

### 6.7 Dialogs and modals

- Title (`--text-lg`), body, then a footer with buttons right-aligned: secondary on the left, primary on the right.
- Escape closes. Enter triggers the primary action unless focus is in a multi-line field.
- Focus is trapped inside while open, and returns to the trigger on close.
- **Destructive dialogs** name the thing being deleted ("Delete request 'Create User'?"), explain the effect ("This deletes the file `create-user.yaml`."), and use the Danger button. Where possible, prefer **move to trash plus an Undo toast** over a confirmation dialog.
- No modal opens another modal. Use a step inside the same modal instead.

### 6.8 Toasts

- Bottom right, max 3 visible, auto-dismiss after 4 seconds (errors stay until dismissed).
- Include an Undo action where one is possible.
- Never use a toast for something that needs a decision. Use a dialog or an inline banner.

### 6.9 Banners (inline notices)

- Used for persistent, contextual information: file changed on disk, collection not trusted, secrets file not ignored by Git.
- One line, an icon, a short message, and at most two actions. Colors come from the semantic subtle tokens.

### 6.10 Command palette

- Opens with Ctrl/Cmd+K, centered, 560px wide, max 8 visible results.
- Fuzzy search over requests, actions, environments, and settings.
- Shows the shortcut next to each action.

### 6.11 Tooltips and context menus

- Tooltip: appears after 500ms hover or immediately on keyboard focus, max width 280px, text only, never contains interactive content.
- Context menus: `--bg-elevated` background, 1px `--border` border, hover and keyboard-focus items use `--bg-active`, 28px items, separators between groups, destructive items last and in `--danger`, keyboard navigable, shortcut shown right-aligned.

---

## 7. Filters and Search

Filtering is a core feature. Every list that can grow past ~20 items MUST have a filter.

### 7.1 General filter rules

- Filters apply **as you type**, with no Apply button, within 100ms for up to 5,000 items.
- Every filter field has a clear (x) button and clears with Escape.
- The active filter is always visible. When a list is filtered, show the count ("12 of 240") and a "Clear filters" link.
- If no items match, show an empty state that says so and offers to clear the filter. Never show a blank list.
- Filter text matching is **case-insensitive** and **fuzzy** for names, **exact substring** for URLs and bodies.
- Filter state in the sidebar is not saved between sessions. Filter state in History is saved until cleared.
- Ctrl/Cmd+F focuses the nearest filter or in-panel search. Ctrl/Cmd+Shift+F opens global search.

### 7.2 Required filters by area

| Area                                 | Required filters                                                                                                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sidebar (collection)**             | Text filter on request name, URL, and folder name. Matching folders auto-expand, non-matching rows hide. Optional chips: method (multi-select).                                                    |
| **History**                          | Text (URL or name); method (multi-select); status class (2xx, 3xx, 4xx, 5xx, Error); date (Today, Last 7 days, Last 30 days, custom range); environment; sort by newest, oldest, slowest, largest. |
| **Global search (Ctrl/Cmd+Shift+F)** | Scope toggles: Names, URLs, Headers, Bodies, Docs, Scripts. Method filter. Results grouped by folder with the matching text highlighted.                                                           |
| **Response body**                    | In-body find (text, case-sensitive toggle, regex toggle, match count, next and previous). JSON: filter by JSONPath expression with live results.                                                   |
| **Response headers**                 | Filter by header name or value.                                                                                                                                                                    |
| **Cookies**                          | Filter by domain, name.                                                                                                                                                                            |
| **Environment variables**            | Filter by name or value; toggle "Show only overridden", toggle "Show secrets".                                                                                                                     |
| **Test results**                     | Toggle All, Passed, Failed.                                                                                                                                                                        |
| **Console (script output)**          | Level filter (log, warn, error), text filter, Clear.                                                                                                                                               |
| **Collection runner results**        | Toggle All, Passed, Failed, Skipped; text filter.                                                                                                                                                  |
| **Import report**                    | Toggle Converted, Approximated, Skipped.                                                                                                                                                           |
| **Command palette**                  | Fuzzy filter across everything, with prefix shortcuts: `>` actions, `@` requests, `#` environments.                                                                                                |

### 7.3 Filter UI pattern

- Filter inputs show a magnifier icon, the placeholder "Filter..." (or a specific one like "Filter requests"), and the shortcut hint when empty.
- Filter chips (method, status class) are toggle buttons at 24px height. Selected chips use `--accent-subtle` background and `--accent-strong` text. Selecting none means "all".
- Dropdown filters show the current selection in the button label ("Status: 4xx, 5xx").
- Do not hide filters behind a menu when the list is visible. Place them directly above the list.

---

## 8. States: Loading, Empty, Error

Every view that loads or holds data MUST define all three.

### 8.1 Loading

- Under 200ms: show nothing extra (avoid flicker).
- 200ms to 2s: inline spinner or skeleton rows in the same layout.
- Over 2s: show progress text ("Reading 340 files...") and, for requests, elapsed time and a Cancel button.
- Requests in flight show a live timer.

### 8.2 Empty

- Structure: a short title, one line of help, and **one** action.
- Examples:
  - No collection open: "Open a folder to get started" with [Open folder] and [New collection].
  - Empty collection: "No requests yet" with [New request].
  - No response yet: "Send the request to see the response" with the shortcut shown.
  - No results from a filter: "No requests match 'users'" with [Clear filter].
- Empty states are quiet: muted text, no illustrations larger than 48px.

### 8.3 Error

- Every error message has three parts: **what happened**, **why (if known)**, and **what to do**.

| Bad              | Good                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| "Request failed" | "Could not connect to localhost:3000. Connection refused. Check that the server is running."       |
| "Invalid file"   | "create-user.yaml, line 12: `method` must be one of GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS." |
| "Error"          | "Variable `{{token}}` is not defined in the 'dev' environment. [Add variable]"                     |

- Errors for a single file or request stay local (red marker, inline message). They MUST NOT block the rest of the app.
- Include a "Copy details" action on unexpected errors.
- A global error boundary catches crashes, shows a recovery screen, and never loses unsaved edits (they are autosaved to a recovery file).

---

## 9. Icons, Motion, and Elevation

### 9.1 Icons

- One icon set only: **Lucide**. Do not mix sets.
- Sizes: 14px (inline), 16px (default), 20px (large buttons, empty states). Stroke width 1.5.
- Icons use `currentColor`. Standalone icons have an accessible label. Decorative icons use `aria-hidden`.
- Do not use emoji anywhere in the UI.

### 9.2 Motion

- Allowed: opacity and small transform transitions on menus, tooltips, modals, toasts, and panel collapse.
- Durations: **120ms** for hover and small changes, **180ms** for menus and panels, **240ms maximum** for anything. Easing: `cubic-bezier(0.2, 0, 0, 1)`.
- Nothing animates on typing, scrolling, or when response data arrives.
- When the OS "reduce motion" setting is on, all transitions are disabled (instant) except spinners.
- Spinners are the only infinite animation.

### 9.3 Elevation

- Only floating layers have shadows: menus, popovers, modals, toasts, command palette.
- Shadow: `0 4px 16px rgba(0,0,0,0.12)` in light and `0 4px 16px rgba(0,0,0,0.5)` in dark. One level only.
- Content panels never have shadows.

---

## 10. Keyboard and Accessibility

### 10.1 Required shortcuts

Use Ctrl on Windows and Linux, Cmd on macOS.

| Action                | Shortcut                           |
| --------------------- | ---------------------------------- |
| Send request          | Ctrl/Cmd+Enter                     |
| Cancel request        | Escape (while in flight)           |
| Save                  | Ctrl/Cmd+S                         |
| New request           | Ctrl/Cmd+N                         |
| New folder            | Ctrl/Cmd+Shift+N                   |
| Open collection       | Ctrl/Cmd+O                         |
| Close tab             | Ctrl/Cmd+W                         |
| Next / previous tab   | Ctrl+Tab / Ctrl+Shift+Tab          |
| Command palette       | Ctrl/Cmd+K                         |
| Global search         | Ctrl/Cmd+Shift+F                   |
| Find in panel         | Ctrl/Cmd+F                         |
| Toggle sidebar        | Ctrl/Cmd+B                         |
| Focus URL bar         | Ctrl/Cmd+L                         |
| Switch environment    | Ctrl/Cmd+E                         |
| Zoom in / out / reset | Ctrl/Cmd+= / - / 0                 |
| Rename                | F2                                 |
| Delete                | Delete (moves to trash, with Undo) |

Shortcuts are defined in **one registry**, shown in a Keyboard Shortcuts dialog, and rebindable (Phase 20). Shortcuts MUST NOT conflict with text editing in inputs.

### 10.2 Accessibility requirements

- **Everything works with the keyboard alone.** Tab order follows visual order. No keyboard traps (except intentional focus traps in modals).
- **Visible focus** on every interactive element (2px ring, 3:1 contrast).
- Use semantic HTML and correct ARIA roles: `tree` for the sidebar, `tablist` for tabs, `dialog` for modals, `status` or `alert` for toasts and errors.
- Screen readers announce: request sent, response received (with status), test results, and errors.
- Respect `prefers-reduced-motion`, `prefers-color-scheme`, and `forced-colors`.
- Minimum hit area 24 x 24px.
- Form fields have visible or programmatic labels. Placeholders are never the only label.
- Run **axe** checks in the Playwright suite. New violations fail CI.

---

## 11. Content and Copy Rules

- **Sentence case** everywhere: "New request", not "New Request".
- Short and direct. Prefer verbs. No exclamation marks, no jokes in errors, no "Oops", no "Please".
- Use the product's own terms consistently: **Collection**, **Folder**, **Request**, **Environment**, **Variable**, **Secret**, **History**. Do not switch to "Workspace", "Project", or "Endpoint".
- Numbers: use digits and units with a space ("120 ms", "4.2 KB"). Use thousands separators ("1,204 requests").
- Time formatting for responses: `< 1,000 ms` shows as "245 ms", `>= 1 s` shows as "1.24 s".
- Size formatting: B, KB, MB with one decimal (binary-based: 1 KB = 1,024 bytes), consistent across the app.
- Dates: relative for recent ("3 min ago"), absolute with local time on hover.
- File paths are shown in the monospace font, truncated in the **middle** (`api/users/…/create-user.yaml`).
- Secrets are masked as `••••••••` with a fixed length (never reveal their real length).
- No lorem ipsum, placeholder names like "Foo", or fake data in shipped UI.

---

## 12. Performance Constraints

| Metric                                    | Limit                                                  |
| ----------------------------------------- | ------------------------------------------------------ |
| App startup to usable window              | Under 2 seconds on a mid-range laptop                  |
| Typing latency in any input or editor     | Under 50ms                                             |
| Sidebar filter response (5,000 requests)  | Under 100ms                                            |
| Opening a request from the sidebar        | Under 100ms                                            |
| Opening a 5 MB JSON response              | Under 1 second                                         |
| Opening a 50 MB JSON response             | UI stays responsive (never blocks for more than 100ms) |
| Idle memory with a 500-request collection | Under 400 MB                                           |
| Frame rate while scrolling or resizing    | 60 fps target, no frame over 50ms                      |

Rules to hit those limits:

- Lists over **200 rows** MUST be virtualized.
- Response bodies over **1 MB** MUST use a virtualized or lazy viewer.
- Heavy work (parsing big bodies, scanning folders, searching) MUST run in the main process or a worker, never on the renderer's UI thread.
- Debounce autosave (500ms), filters (50ms), and watcher events (100ms).
- No layout thrashing: do not read and write layout in loops.
- Add a performance test to CI for the limits above once Phase 14 is complete.

---

## 13. Forbidden List

The following MUST NOT appear in the app.

- Gradients, glassmorphism, blur effects, glow, neon colors, or decorative backgrounds.
- More than one accent color, or using green, amber, blue, red, yellow, or indigo for decoration.
- Base semantic hues (`--*-mark`) used as **text** color, or text-safe tokens used as large decorative fills.
- Raw hex values, inline styles for color, or arbitrary Tailwind values in components.
- Font sizes or spacing values outside the scales above.
- Emoji in UI text.
- Network-loaded fonts, icons, images, or scripts (the app is fully offline-capable).
- Login, account, "Sign in", "Upgrade", "Pro", "Premium", ads, or promotional UI of any kind.
- Telemetry prompts or tracking by default.
- Auto-playing animations, confetti, or celebratory effects.
- Custom scrollbars that remove the scrollbar entirely. Thin native-like scrollbars (10px) with visible thumbs are allowed.
- Disabling text selection in content areas (URLs, responses, errors). Chrome elements such as buttons and tabs may disable selection.
- Removing focus outlines.
- Modals over modals.
- Silent failures, or `alert()` / `confirm()` / `prompt()` browser dialogs.
- Hidden functionality only reachable by mouse.
- Hard-coded English strings in components (all text goes through a single strings module, to allow translation later).

---

## 14. Enforcement and PR Checklist

### 14.1 Automated checks (CI)

- **ESLint/Stylelint rules** that fail on raw color values, arbitrary Tailwind values, `alert/confirm/prompt`, and non-token spacing.
- **Token check script:** every token exists in both light and dark themes.
- **Contrast check:** a script computes contrast for every text/background token pair in both themes (including each semantic text token on `--bg-base`, `--bg-surface`, `--bg-elevated`, and its own `-subtle` background; `--border-strong` and `--focus-ring` against all surfaces) and fails below AA (4.5:1 text, 3:1 non-text).
- **No `dark:` variants and no Tailwind default colors:** a lint rule fails on `dark:` classes, arbitrary color values, and opacity modifiers on token colors.
- **axe accessibility tests** in Playwright for the main screens in both themes.
- **Visual regression screenshots** (Playwright) for the main screens in light and dark, at 100% and 150% zoom.
- **Bundle check:** no external URLs in the renderer output.

### 14.2 Pull request checklist

Copy this into every UI pull request.

- [ ] Uses tokens only. No raw colors, sizes, or arbitrary values, and no `dark:` variants
- [ ] Semantic colors on text use the text-safe tokens (`--success`, `--danger`, ...), and `-mark` tokens only for dots and bars
- [ ] Looks correct in **light and dark** themes
- [ ] Works at **960 x 600** and at 150% zoom with no overflow or clipping
- [ ] Fully usable with the keyboard, with visible focus
- [ ] Has loading, empty, and error states
- [ ] Error messages say what happened, why, and what to do
- [ ] Lists over 200 rows are virtualized, and long text truncates with a tooltip
- [ ] Lists that can grow have a filter, with a count and a clear action
- [ ] Destructive actions are undoable or confirmed with a named dialog
- [ ] Icon-only buttons have tooltips and `aria-label`s
- [ ] Respects reduced motion
- [ ] New strings are in the strings module, in sentence case
- [ ] No new network requests from the renderer
- [ ] Screenshots (light and dark) attached to the pull request

### 14.3 Changing these rules

These guidelines change only through a pull request that edits this file, with a short reason in the description and an entry in `docs/decisions.md`. If a design needs an exception, document it here first, then build it.
