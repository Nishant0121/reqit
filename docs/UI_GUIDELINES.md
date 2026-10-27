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

### 2.1 Rules

- Components MUST use **design tokens** (CSS variables) only. Raw hex, `rgb()`, or named colors in component code are forbidden. Tailwind arbitrary color values (`bg-[#fff]`) are forbidden.
- Every token has a **light** and a **dark** value. A new token is not complete until both exist.
- Text and essential UI elements MUST meet **WCAG AA**: 4.5:1 for normal text, 3:1 for large text (18px+ or 14px+ bold), icons, borders of inputs, and focus rings. Verify with a contrast tool before merging any new color.
- **Color MUST NOT be the only way to convey information.** Pair color with text, an icon, or a shape (for example, a status badge shows the number and the text, not just a green dot).
- One accent color only. No gradients anywhere.

### 2.2 Neutral and accent tokens

```css
:root {
  /* Surfaces */
  --bg-base: #ffffff; /* main content areas */
  --bg-subtle: #f6f7f9; /* sidebar, panels */
  --bg-muted: #edeff3; /* hover, table stripes, code background */
  --bg-elevated: #ffffff; /* menus, modals, popovers */
  --bg-overlay: rgba(15, 17, 21, 0.45); /* modal backdrop */

  /* Borders */
  --border: #e1e4ea; /* dividers, panel edges */
  --border-strong: #c9ced8; /* input borders */

  /* Text */
  --text-primary: #14171f;
  --text-secondary: #4a5162;
  --text-muted: #6b7384; /* hints, placeholders, timestamps */
  --text-disabled: #9aa1b0; /* disabled controls only, exempt from AA */

  /* Accent */
  --accent: #2f5bea;
  --accent-hover: #2449c4;
  --accent-subtle: #e8eeff; /* selected row background */
  --accent-fg: #ffffff; /* text on accent */
  --focus-ring: #2f5bea;
}

:root[data-theme='dark'] {
  --bg-base: #0f1115;
  --bg-subtle: #151820;
  --bg-muted: #1d212b;
  --bg-elevated: #1a1e27;
  --bg-overlay: rgba(0, 0, 0, 0.6);

  --border: #2a2f3b;
  --border-strong: #3a4150;

  --text-primary: #e8eaf0;
  --text-secondary: #a9b0bf;
  --text-muted: #8a92a3;
  --text-disabled: #5b6272;

  --accent: #6c8cff;
  --accent-hover: #8aa3ff;
  --accent-subtle: #1e2745;
  --accent-fg: #0f1115;
  --focus-ring: #8aa3ff;
}
```

### 2.3 Semantic tokens

| Token              | Light     | Dark      | Use                              |
| ------------------ | --------- | --------- | -------------------------------- |
| `--success`        | `#1A7F4B` | `#4CC38A` | Passed tests, 2xx                |
| `--success-subtle` | `#E4F5EC` | `#12281E` | Success backgrounds              |
| `--warning`        | `#9A6700` | `#E3B341` | 4xx, caution, unsaved            |
| `--warning-subtle` | `#FFF4D6` | `#2D2410` | Warning backgrounds              |
| `--danger`         | `#C62F3E` | `#FF6B7A` | 5xx, errors, destructive actions |
| `--danger-subtle`  | `#FDE8EA` | `#2E1519` | Error backgrounds                |
| `--info`           | `#0B6BCB` | `#5AB0FF` | 1xx, 3xx, neutral notices        |
| `--info-subtle`    | `#E3F0FD` | `#10243A` | Info backgrounds                 |

### 2.4 HTTP method colors

Method labels MUST always be shown as **text** (for example `GET`) in the color below, in the monospace font, bold, uppercase.

| Method    | Light     | Dark      |
| --------- | --------- | --------- |
| `GET`     | `#1A7F4B` | `#4CC38A` |
| `POST`    | `#9A5B00` | `#F0A040` |
| `PUT`     | `#2F5BEA` | `#6C8CFF` |
| `PATCH`   | `#7A3FD1` | `#B28CFF` |
| `DELETE`  | `#C62F3E` | `#FF6B7A` |
| `HEAD`    | `#0E7C86` | `#4CC9D6` |
| `OPTIONS` | `#6B7384` | `#8A92A3` |

In the sidebar, method labels are shortened to fit in a fixed 44px column: `GET`, `POST`, `PUT`, `PTCH`, `DEL`, `HEAD`, `OPT`.

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

The badge MUST show the numeric code **and** the status text.

### 2.6 Syntax highlighting tokens

Editor colors come from a fixed set so JSON, XML, HTML, YAML, and script views match.

| Token                  | Light                          | Dark                           |
| ---------------------- | ------------------------------ | ------------------------------ |
| Keys / properties      | `#1F4FBF`                      | `#8AA3FF`                      |
| Strings                | `#1A7F4B`                      | `#4CC38A`                      |
| Numbers                | `#9A5B00`                      | `#F0A040`                      |
| Booleans / null        | `#7A3FD1`                      | `#B28CFF`                      |
| Punctuation            | `#6B7384`                      | `#8A92A3`                      |
| Comments               | `#6B7384` (italic)             | `#8A92A3` (italic)             |
| Invalid / error        | `#C62F3E`                      | `#FF6B7A`                      |
| `{{variable}}` known   | `#0E7C86` on `--accent-subtle` | `#4CC9D6` on `--accent-subtle` |
| `{{variable}}` unknown | `#C62F3E` on `--danger-subtle` | `#FF6B7A` on `--danger-subtle` |

### 2.7 Theme behavior

- Three options: **System** (default), **Light**, **Dark**.
- Switching themes MUST apply instantly without reloading and without a flash of the wrong theme at startup (read the saved theme before first paint).
- No component may look broken in either theme. Both themes are tested.
- High-contrast support: honor `forced-colors` (Windows High Contrast) by not relying on background colors for essential boundaries; keep borders on interactive elements.

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

| Variant       | Look                                                | Use                                         |
| ------------- | --------------------------------------------------- | ------------------------------------------- |
| **Primary**   | `--accent` background, `--accent-fg` text           | One per view or dialog (Send, Save, Import) |
| **Secondary** | `--bg-muted` background, `--text-primary`           | Default actions                             |
| **Ghost**     | Transparent, `--text-secondary`, hover `--bg-muted` | Toolbars, icon buttons                      |
| **Danger**    | `--danger` background, white text                   | Confirm destructive actions only            |

- Only **one primary button** per dialog or view area.
- Button labels are verbs: "Send", "Save", "Import", "Delete request". Never "OK" or "Yes".
- Disabled buttons use `--text-disabled`, show `not-allowed`, and explain why in a tooltip when the reason is not obvious.
- Loading buttons keep their width, show a spinner, and are not clickable.
- The Send button becomes **Cancel** while a request is in flight (same position, same width).

### 6.2 Inputs and selects

- 28px high, 1px `--border-strong` border, `--bg-base` background, `--radius-sm`.
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
- Hover: `--bg-muted`. Right-click opens a context menu. F2 renames inline.
- Rows with a parse error show a `--danger` warning icon and a tooltip with the error.
- Modified-on-disk files (Git changes, after Phase 27) show a small colored letter: `M`, `A`, `D`.

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
- Context menus: 28px items, separators between groups, destructive items last and in `--danger`, keyboard navigable, shortcut shown right-aligned.

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
- Filter chips (method, status class) are toggle buttons at 24px height. Selected chips use `--accent-subtle` background and `--accent` text. Selecting none means "all".
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
- More than one accent color.
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
- **Contrast check:** a script computes contrast for each text/background token pair and fails below the AA thresholds.
- **axe accessibility tests** in Playwright for the main screens in both themes.
- **Visual regression screenshots** (Playwright) for the main screens in light and dark, at 100% and 150% zoom.
- **Bundle check:** no external URLs in the renderer output.

### 14.2 Pull request checklist

Copy this into every UI pull request.

- [ ] Uses tokens only. No raw colors, sizes, or arbitrary values
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
