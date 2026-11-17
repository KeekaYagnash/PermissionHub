# Minimalism — DESIGN.md

Style: minimum

This file is a complete, self-contained design system: rules, tokens, CSS, Tailwind configuration, React components and HTML. Drop it into your AI-coded app and follow it exactly.

## Contents
- `design.md` (design.md)
- `tokens.json` (JSON tokens)
- `preview.html` (HTML preview)

## design.md

```markdown
# Minimalism — minimum

## Scope and reconstruction conventions

This specification covers stylesheet rules, custom properties, keyframes, and media queries. Inline styles, SVG artwork, sample content, and script implementations are not system rules. Property lists below are literal CSS declarations expressed as selector-by-selector reference entries; combine matching entries using normal CSS specificity, inheritance, and source order. Unspecified properties retain inherited or browser-default behavior. Modifier classes add to, rather than replace, their base classes. `var(--name)` resolves to the complete token definitions in Part A.

Malformed declarations `:pointer` and `:not-allowed` occur throughout the stylesheet. They are invalid and ignored: they do not set ``. No declarations should be substituted for them. All valid declarations are specified below.

CSS exposes class-driven states such as `.open`, `.active`, `.out`, `.sel`, and `.done`; the rules define their appearance, not event handling, data updates, dismissal timing, keyboard navigation, or drag behavior. Native pseudo-classes and the native details `open` attribute work through the corresponding HTML controls. No additional script behavior is prescribed by this CSS-only specification.

# PART A — Tokens

## Color and themes

Declare the following custom properties on `:root`. The dark column lists overrides applied by `[data-theme="dark"]`; all unlisted properties retain their root values.

| Property | Default/light | Dark |
|---|---|---|
| `--bg` | `#ffffff` | `#0c0c0c` |
| `--surface` | `#fafafa` | `#141414` |
| `--surface-2` | `#f2f2f2` | `#1c1c1c` |
| `--border` | `#e8e8e8` | `#242424` |
| `--border-strong` | `#d6d6d6` | `#333333` |
| `--text` | `#0f0f0f` | `#f5f5f5` |
| `--muted` | `#757575` | `#9a9a9a` |
| `--faint` | `#a8a8a8` | `#6b6b6b` |
| `--accent` | `#0f0f0f` | `#f5f5f5` |
| `--on-accent` | `#ffffff` | `#0c0c0c` |
| `--success` | `#157f4a` | `#4ec98a` |
| `--success-bg` | `#eef7f1` | `#0f2419` |
| `--warn` | `#9a6700` | `#e0b341` |
| `--warn-bg` | `#fdf6e3` | `#241d0b` |
| `--danger` | `#c0362c` | `#f0736a` |
| `--danger-bg` | `#fdefee` | `#2a1311` |
| `--info` | `#1d5fa8` | `#7aaef0` |
| `--info-bg` | `#eef3fa` | `#0f1a2a` |

Background and surface properties provide neutral surfaces; text/muted/faint provide text hierarchy. Accent equals text in both themes. Semantic foreground/background pairs remain chromatic. Border tokens are colors, not border-width tokens.

Additional literal colors are not theme-overridden: `#fff`, `#111`, `rgba(255,255,255,.12)`, `rgba(255,255,255,.25)`, `rgba(255,255,255,.9)`, `rgba(255,255,255,.1)`, `rgba(255,255,255,.2)`, `rgba(0,0,0,.42)`, `rgba(0,0,0,.4)`, `rgba(8,8,8,.94)`, `rgba(128,128,128,.09)`, and `rgba(128,128,128,.12)`. Rules also use `transparent`, `currentColor`, and `inherit`.

## Typography

- `--font`: `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`.
- `--mono`: `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace`.
- No font import or font-face declaration is defined.
- Body: `14px`, line-height `1.55`; weights explicitly declared elsewhere are `500` and `600`.
- Observed stylesheet font sizes: `10px`, `10.5px`, `11px`, `11.5px`, `12px`, `12.5px`, `13px`, `13.5px`, `14px`, `15px`, `16px`, `22px`, `24px`, `30px`.
- Letter-spacing values: `-.03em`, `-.02em`, `-.01em`, `.02em`, `.06em`, `.1em`, `.12em`, `.14em`.
- Explicit line-height values: `0`, `1`, `1.45`, `1.5`, `1.55`, `1.65`, `1.7`.
- Uppercase, italic, and line-through treatments are component-specific below; no global typographic scale variables exist.

## Radius

Root properties: `--r-xs:4px`; `--r-sm:6px`; `--r:8px`; `--r-lg:14px`; `--r-full:999px`.

Additional literal radii: `1px`, `2px`, `5px`, `6px`, `50%`; asymmetric combinations include `2px 2px 0 0`, `50% 50% 50% 0`, and `var(--r-lg) var(--r-lg) 0 0`. They are not additional named root tokens.

## Shadow and elevation

| Property | Default/light | Dark |
|---|---|---|
| `--ring` | `0 0 0 3px rgba(15,15,15,.08)` | `0 0 0 3px rgba(245,245,245,.12)` |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,.05)` | unchanged |
| `--shadow` | `0 4px 16px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.04)` | `0 4px 16px rgba(0,0,0,.5), 0 1px 2px rgba(0,0,0,.4)` |
| `--shadow-lg` | `0 24px 60px rgba(0,0,0,.14)` | `0 24px 60px rgba(0,0,0,.7)` |

Other exact shadows: `0 1px 2px rgba(0,0,0,.2)`; `0 0 0 3px var(--danger-bg)`; `inset 0 0 0 3px var(--bg)`; `0 0 0 1px var(--border-strong)`; `inset 0 0 0 1px var(--border-strong)`; `0 0 0 3px var(--surface-2)`.

Layer values are `1`, `60`, `70`, `80`, `90`, `200`, `210`, `220`, `250`, `300`, with assignments in Part B.

## Effects and gradients

Backdrop blur values are `3px` for modal overlays, `2px` for scrims, and `6px` for the large play control. No saturation filter or neumorphic treatment is defined.

- Skeleton: `linear-gradient(90deg,var(--surface-2) 25%,var(--border) 37%,var(--surface-2) 63%)`, background-size `400% 100%`.
- Placeholder: `repeating-linear-gradient(45deg,transparent 0 9px,rgba(128,128,128,.09) 9px 18px)`.
- Lightbox content: `repeating-linear-gradient(45deg,transparent 0 14px,rgba(128,128,128,.12) 14px 28px)`.
- Map: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`, background-size `40px 40px`.
- Donut: `conic-gradient(var(--text) 0 46%, var(--border-strong) 46% 74%, var(--faint) 74% 100%)`.

## Spacing

No root spacing variable or enforced modular rhythm exists. Positive pixel values used for padding, margins, or gaps are `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`, `13`, `14`, `16`, `18`, `20`, `22`, `24`, `26`, `28`, `36`, `40`, `44`, `52`, `56`, `72`, `120`, `140`, and `236`; `0` and `auto` also occur. Negative margins include `-1px`, `-4px`, and `-9px`. Exact combinations and contextual offsets are defined in Part B rather than normalized into an invented scale.

## Grid and sizing

- General grid: gap `12px`; fixed `repeat(2,1fr)`, `repeat(3,1fr)`, or `repeat(4,1fr)` columns; automatic `repeat(auto-fit,minmax(120px,1fr))` columns.
- Gallery: `repeat(3,1fr)` with `8px` gap.
- Calendar: `repeat(7,1fr)` with `2px` gap.
- Container: width `100%`, max-width `640px`, centered with `margin:0 auto`.
- Documentation sidebar width and main left margin: `236px`; main max-width `1200px`.
- Other constraints, aspect ratios, and flex arrangements are listed per component; no global column-count or gutter token exists.

## Breakpoints

Only two media queries exist, both inclusive maximum widths: `(max-width:1000px)` and `(max-width:720px)`. Their complete overrides appear at the end of Part B. No reduced-motion or automatic color-scheme query exists.

## Motion

- Root `--t:.16s ease`. A bare `transition:var(--t)` means all properties, duration `.16s`, easing `ease`, default delay `0s`.
- Progress width: `.3s ease`.
- Track fill width: `.2s linear`.
- Drawer/sheet transform: `.26s cubic-bezier(.4,0,.2,1)`.
- Carousel transform: `.38s cubic-bezier(.4,0,.2,1)`.
- Responsive documentation navigation transform: `.24s ease`.
- `shimmer`: `1.4s ease infinite`; `0% {background-position:100% 0}` to `100% {background-position:-100% 0}`; used by `.skeleton`.
- `toastIn`: `.22s ease`; only `from {opacity:0;transform:translateY(10px) scale(.98)}` is specified; destination is underlying style; used by `.toast`.
- `toastOut`: `.2s ease forwards`; only `to {opacity:0;transform:translateX(20px)}` is specified; used by `.toast.out`.
- `spin`: `.7s linear infinite`; `to {transform:rotate(360deg)}`; used by `.spinner`.
- HTML scrolling uses `scroll-behavior:smooth`; no duration is specified.

# PART B — Components and complete selector reference

## Global foundation and icons

- `*`: `box-sizing:border-box`.
- `html`: `scroll-behavior:smooth`.
- `body`: `margin:0; background:var(--bg); color:var(--text); font-family:var(--font); font-size:14px; line-height:1.55; -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; transition:background var(--t), color var(--t)`.
- `h1,h2,h3,h4,p`: `margin:0`.
- `a`: `color:inherit`.
- `button`: `font-family:inherit`.
- `::selection`: `background:var(--text); color:var(--bg)`.
- `.icon`: `width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; flex:none; display:block`.
- `.icon-sm`: `width:14px; height:14px`.
- `.icon-lg`: `width:22px; height:22px`.

## Documentation shell

- `.docnav`: `position:fixed; inset:0 auto 0 0; width:236px; z-index:60; background:var(--bg); border-right:1px solid var(--border); padding:22px 14px; overflow-y:auto`.
- `.brand`: `display:flex; align-items:center; gap:10px; padding:0 8px 18px; font-size:13px; letter-spacing:-.01em`.
- `.brand-mark`: `width:16px; height:16px; border-radius:5px; background:var(--text); display:block`.
- `.brand strong`: `font-weight:600`.
- `.brand span:last-child`: `color:var(--muted)`.
- `.docnav nav`: `display:flex; flex-direction:column; gap:1px`.
- `.docnav nav a`: `display:block; padding:6px 8px; border-radius:var(--r-xs); font-size:12.5px; color:var(--muted); text-decoration:none; transition:var(--t)`.
- `.docnav nav a:hover`: `background:var(--surface-2); color:var(--text)`.
- `.docnav nav a.active`: `color:var(--text); background:var(--surface-2); font-weight:500`.
- `.nav-group`: `padding:16px 8px 6px; font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--faint)`.
- `.docmain`: `margin-left:236px; padding:44px 52px 140px; max-width:1200px`.
- `.doc-head`: `margin-bottom:56px`.
- `.doc-head h1`: `font-size:30px; font-weight:600; letter-spacing:-.03em; margin-bottom:8px`.
- `.doc-head p`: `color:var(--muted); max-width:60ch; font-size:13.5px`.
- `.doc-head .swatches`: `display:flex; gap:8px; margin-top:20px`.
- `.doc-head .swatches i`: `width:22px; height:22px; border-radius:6px; display:block; border:1px solid var(--border)`.
- `.section`: `margin-bottom:72px; scroll-margin-top:24px`.
- `.section > h2`: `font-size:11px; text-transform:uppercase; letter-spacing:.14em; font-weight:600; color:var(--muted); border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:28px`.
- `.spec`: `margin-bottom:36px`.
- `.spec-label`: `font-size:10.5px; text-transform:uppercase; letter-spacing:.1em; color:var(--faint); margin-bottom:10px`.
- `.spec-body`: empty rule; no styling.

## Frames and utilities

- `.frame`: `border:1px solid var(--border); border-radius:var(--r); overflow:hidden; background:var(--bg)`.
- `.frame-pad`: `padding:20px`.
- `.row`: `display:flex; flex-wrap:wrap; gap:10px; align-items:center`.
- `.row-tight`: `gap:6px`.
- `.col`: `display:flex; flex-direction:column; gap:10px`.
- `.muted`: `color:var(--muted)`.
- `.faint`: `color:var(--faint)`.
- `.mono`: `font-family:var(--mono)`.

## Application navigation

- `.app-header`: `display:flex; align-items:center; justify-content:space-between; height:56px; padding:0 14px; border-bottom:1px solid var(--border); background:var(--bg)`.
- `.hdr-left,.hdr-right`: `display:flex; align-items:center; gap:6px`.
- `.logo-mark`: `width:18px; height:18px; border-radius:5px; background:var(--text); margin:0 4px`.
- `.hdr-title`: `font-size:13.5px; font-weight:600; letter-spacing:-.01em`.
- `.navbar`: `display:flex; align-items:center; gap:2px; padding:8px 12px; border-bottom:1px solid var(--border); background:var(--bg); flex-wrap:wrap`.
- `.nav-link`: `padding:7px 12px; border-radius:var(--r-sm); font-size:13px; color:var(--muted); text-decoration:none; transition:var(--t); border:0; background:none`.
- `.nav-link:hover`: `background:var(--surface-2); color:var(--text)`.
- `.nav-link.active`: `color:var(--text); background:var(--surface-2); font-weight:500`.
- `.sidebar`: `width:220px; padding:16px 12px; background:var(--surface); border-right:1px solid var(--border)`.
- `.sb-group`: `padding:14px 10px 6px; font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--faint)`.
- `.sb-item`: `display:flex; align-items:center; gap:10px; padding:7px 10px; border-radius:var(--r-sm); font-size:13px; color:var(--muted); text-decoration:none; transition:var(--t)`.
- `.sb-item:hover`: `background:var(--surface-2); color:var(--text)`.
- `.sb-item.active`: `background:var(--bg); color:var(--text); font-weight:500; box-shadow:var(--shadow-sm)`.
- `.sb-badge`: `margin-left:auto; font-size:10px; padding:1px 6px; border-radius:var(--r-full); background:var(--surface-2); color:var(--muted)`.
- `.breadcrumbs`: `display:flex; align-items:center; gap:8px; font-size:12.5px; color:var(--muted); flex-wrap:wrap`.
- `.breadcrumbs a`: `text-decoration:none; transition:var(--t)`.
- `.breadcrumbs a:hover`: `color:var(--text)`.
- `.breadcrumbs .sep`: `color:var(--faint)`.
- `.breadcrumbs .current`: `color:var(--text); font-weight:500`.

## Tabs and pagination

- `.tabs`: `display:flex; gap:26px; border-bottom:1px solid var(--border); overflow-x:auto`.
- `.tab`: `padding:10px 0; font-size:13px; color:var(--muted); background:none; border:0; border-bottom:1.5px solid transparent; margin-bottom:-1px; transition:var(--t); white-space:nowrap`.
- `.tab:hover`: `color:var(--text)`.
- `.tab.active`: `color:var(--text); border-bottom-color:var(--text); font-weight:500`.
- `.tabpanel`: `display:none; padding:16px 0; font-size:13px; color:var(--muted)`.
- `.tabpanel.active`: `display:block`. Tab and panel active states must be coordinated externally.
- `.pagination`: `display:flex; align-items:center; gap:4px`.
- `.page`: `min-width:32px; height:32px; padding:0 8px; display:inline-grid; place-items:center; border:1px solid transparent; border-radius:var(--r-sm); background:none; color:var(--muted); font-size:12.5px; transition:var(--t)`.
- `.page:hover`: `background:var(--surface-2); color:var(--text)`.
- `.page.active`: `background:var(--accent); color:var(--on-accent); font-weight:500`.
- `.page[disabled]`: `opacity:.35; pointer-events:none`.

## Menus and popovers

- `.dropdown`: `position:relative; display:inline-block`.
- `.menu,.popover`: `position:absolute; top:calc(100% + 6px); left:0; z-index:80; min-width:200px; background:var(--bg); border:1px solid var(--border); border-radius:var(--r); box-shadow:var(--shadow); padding:6px; opacity:0; visibility:hidden; transform:translateY(-4px); transition:opacity var(--t), transform var(--t), visibility var(--t)`.
- `.menu.open,.popover.open`: `opacity:1; visibility:visible; transform:none`.
- `.menu.right`: `left:auto; right:0`.
- `.menu-item`: `display:flex; align-items:center; gap:10px; width:100%; padding:7px 10px; border:0; background:none; font-size:13px; color:var(--text); border-radius:var(--r-xs); text-align:left; text-decoration:none; transition:var(--t)`.
- `.menu-item:hover`: `background:var(--surface-2)`.
- `.menu-item.danger`: `color:var(--danger)`.
- `.menu-item .shortcut`: `margin-left:auto; font-size:11px; color:var(--faint); font-family:var(--mono)`.
- `.menu-sep`: `height:1px; background:var(--border); margin:6px 2px`.
- `.menu-label`: `padding:8px 10px 4px; font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--faint)`.
- `.popover`: additionally `min-width:260px; padding:14px; top:calc(100% + 8px)`.

## Form fields, select, and search

- `.field`: `display:flex; flex-direction:column; gap:6px; max-width:320px; width:100%`.
- `.label`: `font-size:12px; font-weight:500; color:var(--text)`.
- `.label .req`: `color:var(--danger); margin-left:2px`.
- `.hint`: `font-size:11.5px; color:var(--faint)`.
- `.input,.textarea,.select`: `width:100%; height:36px; padding:0 12px; border:1px solid var(--border-strong); border-radius:var(--r-sm); background:var(--bg); color:var(--text); font-family:inherit; font-size:13px; transition:var(--t); appearance:none`.
- `.textarea`: `height:auto; min-height:88px; padding:9px 12px; resize:vertical; line-height:1.55`.
- `.input::placeholder,.textarea::placeholder`: `color:var(--faint)`.
- `.input:focus,.textarea:focus,.select:focus`: `outline:none; border-color:var(--text); box-shadow:var(--ring)`.
- `.input:disabled,.textarea:disabled,.select:disabled`: `background:var(--surface-2); opacity:.6`. The malformed `:not-allowed` has no effect.
- `.input.invalid,.textarea.invalid`: `border-color:var(--danger)`.
- `.input.invalid:focus,.textarea.invalid:focus`: `box-shadow:0 0 0 3px var(--danger-bg)`.
- `.input.valid,.textarea.valid`: `border-color:var(--success)`.
- `.select-wrap`: `position:relative; width:100%`.
- `.select-wrap .select`: `padding-right:34px`.
- `.select-wrap::after`: `content: ""; position:absolute; right:12px; top:50%; width:8px; height:8px; border-right:1.5px solid var(--muted); border-bottom:1.5px solid var(--muted); transform:translateY(-70%) rotate(45deg); pointer-events:none`.
- `.search`: `position:relative; width:100%; max-width:320px`.
- `.search .input`: `padding-left:36px`.
- `.search .icon`: `position:absolute; left:11px; top:50%; transform:translateY(-50%); color:var(--faint); pointer-events:none`.
- `.search kbd`: `position:absolute; right:8px; top:50%; transform:translateY(-50%); font-family:var(--mono); font-size:10px; color:var(--faint); border:1px solid var(--border); border-radius:var(--r-xs); padding:1px 5px; background:var(--surface)`.

Invalid/valid classes are visual states only. Select has no invalid/valid styling. No date-specific selector exists. No search shortcut action or validation logic is defined by these rules.

## Checkbox, radio, and switch

- `.check`: `display:inline-flex; align-items:flex-start; gap:9px; font-size:13px; user-select:none`.
- `.check input`: `position:absolute; opacity:0; width:0; height:0`.
- `.box`: `width:16px; height:16px; border:1px solid var(--border-strong); border-radius:var(--r-xs); background:var(--bg); flex:none; margin-top:2px; position:relative; transition:var(--t)`.
- `.check input:checked + .box`: `background:var(--accent); border-color:var(--accent)`.
- `.check input:checked + .box::after`: `content: ""; position:absolute; left:5px; top:2px; width:3.5px; height:7.5px; border:solid var(--on-accent); border-width:0 1.5px 1.5px 0; transform:rotate(45deg)`.
- `.check input:focus-visible + .box`: `box-shadow:var(--ring)`.
- `.check input:disabled + .box`: `opacity:.4`.
- `.check input:disabled ~ .check-text`: `opacity:.45`; `.check-text` has no separate base rule.
- `.box.round`: `border-radius:50%`.
- `.check input:checked + .box.round`: `background:var(--accent); border-color:var(--accent); box-shadow:inset 0 0 0 3px var(--bg)`.
- `.check input:checked + .box.round::after`: `display:none`.
- `.switch`: `appearance:none; width:36px; height:20px; border-radius:var(--r-full); background:var(--border-strong); position:relative; transition:var(--t); flex:none; border:0; margin:0`.
- `.switch::after`: `content: ""; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; transition:var(--t); box-shadow:0 1px 2px rgba(0,0,0,.2)`.
- `.switch:checked`: `background:var(--accent)`.
- `.switch:checked::after`: `transform:translateX(16px); background:var(--bg)`.
- `.switch:focus-visible`: `outline:none; box-shadow:var(--ring)`.
- `.switch-row`: `display:inline-flex; align-items:center; gap:10px; font-size:13px`.

Checkbox/radio presentation requires the input immediately followed by `.box`, with `.check-text` as a later sibling. Checked radio inset shadow wins over the earlier focus-visible shadow when both match. No switch-specific disabled appearance is defined.

## Upload, range, and validation messages

- `.dropzone`: `border:1px dashed var(--border-strong); border-radius:var(--r); padding:26px 20px; text-align:center; background:var(--surface); transition:var(--t)`.
- `.dropzone:hover`: `border-color:var(--text); background:var(--surface-2)`.
- `.dropzone .icon`: `margin:0 auto 10px; color:var(--faint); width:22px; height:22px`.
- `.dropzone strong`: `font-size:13px; font-weight:500; display:block; margin-bottom:2px`.
- `.dropzone span`: `font-size:11.5px; color:var(--faint)`.
- `.range`: `appearance:none; width:100%; max-width:320px; height:2px; border-radius:2px; background:var(--border-strong); outline:none`.
- `.range::-webkit-slider-thumb`: `appearance:none; width:15px; height:15px; border-radius:50%; background:var(--accent); border:3px solid var(--bg); box-shadow:0 0 0 1px var(--border-strong); transition:var(--t)`.
- `.range::-webkit-slider-thumb:hover`: `transform:scale(1.12)`.
- `.range::-moz-range-thumb`: `width:15px; height:15px; border-radius:50%; background:var(--accent); border:3px solid var(--bg); box-shadow:0 0 0 1px var(--border-strong)`.
- `.msg`: `display:flex; align-items:flex-start; gap:6px; font-size:11.5px; line-height:1.45`.
- `.msg .icon`: `width:13px; height:13px; margin-top:2px`.
- `.msg-error`: `color:var(--danger)`.
- `.msg-success`: `color:var(--success)`.
- `.msg-hint`: `color:var(--faint)`.

Upload has no drag-over state, file constraints, or browse action in CSS. Range thumb hover animation is WebKit-specific; no corresponding Mozilla hover rule exists.

## Buttons

- `.btn`: `display:inline-flex; align-items:center; justify-content:center; gap:8px; height:36px; padding:0 14px; border-radius:var(--r-sm); border:1px solid transparent; background:transparent; color:var(--text); font-size:13px; font-weight:500; transition:var(--t); white-space:nowrap; text-decoration:none; line-height:1`.
- `.btn:focus-visible`: `outline:none; box-shadow:var(--ring); border-color:var(--text)`.
- `.btn-primary`: `background:var(--accent); color:var(--on-accent); border-color:var(--accent)`.
- `.btn-primary:hover`: `opacity:.85`.
- `.btn-secondary`: `border-color:var(--border-strong); background:var(--bg)`.
- `.btn-secondary:hover`: `background:var(--surface-2)`.
- `.btn-ghost`: `color:var(--muted)`.
- `.btn-ghost:hover`: `background:var(--surface-2); color:var(--text)`.
- `.btn-danger`: `background:var(--danger); color:#fff; border-color:var(--danger)`.
- `.btn-danger:hover`: `opacity:.88`.
- `.btn-sm`: `height:30px; padding:0 10px; font-size:12px`.
- `.btn-lg`: `height:44px; padding:0 20px; font-size:14px`.
- `.btn[disabled],.btn.disabled`: `opacity:.38; pointer-events:none`.
- `.btn-block`: `width:100%`.
- `.btn .icon`: `width:16px; height:16px`.

No pressed `:active` button rule exists. `.disabled` is a visual/pointer state, not a native disabled attribute.

## Icon buttons and floating action buttons

- `.icon-btn`: `display:inline-grid; place-items:center; width:36px; height:36px; border-radius:var(--r-sm); border:1px solid transparent; background:transparent; color:var(--text); transition:var(--t); position:relative`.
- `.icon-btn:hover`: `background:var(--surface-2)`.
- `.icon-btn:focus-visible`: `outline:none; box-shadow:var(--ring); border-color:var(--text)`.
- `.icon-btn.bordered`: `border-color:var(--border-strong)`.
- `.icon-btn.sm`: `width:28px; height:28px`.
- `.icon-btn.sm .icon`: `width:15px; height:15px`.
- `.icon-btn .dot`: `position:absolute; top:7px; right:8px; width:6px; height:6px; border-radius:50%; background:var(--danger); border:1.5px solid var(--bg)`.
- `.fab`: `width:52px; height:52px; border-radius:var(--r-full); background:var(--accent); color:var(--on-accent); border:0; display:inline-grid; place-items:center; box-shadow:var(--shadow); transition:var(--t)`.
- `.fab:hover`: `transform:translateY(-2px); box-shadow:var(--shadow-lg)`.
- `.fab.sm`: `width:42px; height:42px`.

No icon-button or FAB disabled selector is present. The later `.icon-btn.bordered` rule overrides its focus border color at equal specificity.

## Split buttons and button groups

- `.btn-split`: `display:inline-flex; align-items:stretch; border-radius:var(--r-sm); overflow:hidden; border:1px solid var(--accent); background:var(--accent)`.
- `.btn-split .btn`: `border-radius:0; border:0; background:transparent; color:var(--on-accent)`.
- `.btn-split .btn:hover`: `background:rgba(255,255,255,.12)`.
- `.btn-split .divider-v`: `width:1px; background:rgba(255,255,255,.25)`.
- `.btn-split.secondary`: `border-color:var(--border-strong); background:var(--bg)`.
- `.btn-split.secondary .btn`: `color:var(--text)`.
- `.btn-split.secondary .btn:hover`: `background:var(--surface-2)`.
- `.btn-split.secondary .divider-v`: `background:var(--border)`.
- `.btn-group`: `display:inline-flex; border:1px solid var(--border-strong); border-radius:var(--r-sm); overflow:hidden`.
- `.btn-group .btn`: `border-radius:0; border:0; height:34px; color:var(--muted)`.
- `.btn-group .btn + .btn`: `border-left:1px solid var(--border)`.
- `.btn-group .btn:hover`: `background:var(--surface-2); color:var(--text)`.
- `.btn-group .btn.active`: `background:var(--accent); color:var(--on-accent)`.

Group button height overrides size modifiers through greater specificity. CSS does not implement exclusive selection or split-menu opening.

## Cards, lists, and tables

- `.card`: `border:1px solid var(--border); border-radius:var(--r); background:var(--bg); overflow:hidden; transition:var(--t)`.
- `.card-hover:hover`: `border-color:var(--border-strong); box-shadow:var(--shadow)`.
- `.card-body`: `padding:18px`.
- `.card-title`: `font-size:14px; font-weight:600; letter-spacing:-.01em; margin-bottom:4px`.
- `.card-text`: `font-size:12.5px; color:var(--muted)`.
- `.card-footer`: `padding:12px 18px; border-top:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; gap:10px; background:var(--surface)`.
- `.list`: `list-style:none; margin:0; padding:0; border:1px solid var(--border); border-radius:var(--r); overflow:hidden`.
- `.list li`: `display:flex; align-items:center; gap:12px; padding:12px 16px; font-size:13px; border-bottom:1px solid var(--border); background:var(--bg); transition:var(--t)`.
- `.list li:last-child`: `border-bottom:0`.
- `.list li:hover`: `background:var(--surface)`.
- `.list .li-main`: `font-weight:500`.
- `.list .li-sub`: `font-size:11.5px; color:var(--muted)`.
- `.list .li-end`: `margin-left:auto; color:var(--faint); font-size:12px`.
- `.table-wrap`: `border:1px solid var(--border); border-radius:var(--r); overflow:auto; background:var(--bg)`.
- `table.tbl`: `width:100%; border-collapse:collapse; font-size:12.5px`.
- `table.tbl th`: `text-align:left; font-weight:500; font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--faint); padding:11px 16px; border-bottom:1px solid var(--border); background:var(--surface); white-space:nowrap`.
- `table.tbl td`: `padding:12px 16px; border-bottom:1px solid var(--border); color:var(--text)`.
- `table.tbl tr:last-child td`: `border-bottom:0`.
- `table.tbl tbody tr:hover td`: `background:var(--surface)`.
- `table.tbl th.sortable`: `user-select:none`.
- `table.tbl th.sortable:hover`: `color:var(--text)`.
- `table.tbl th .sort-ind`: `opacity:.4; margin-left:4px`.

Sorting is not implemented by the stylesheet. `table.tbl td` overrides `.muted` text color on the same cell through specificity.

## Accordion and tooltip

- `.accordion`: `border:1px solid var(--border); border-radius:var(--r); overflow:hidden; background:var(--bg)`.
- `.acc-item`: `border-bottom:1px solid var(--border)`.
- `.acc-item:last-child`: `border-bottom:0`.
- `.acc-item summary`: `display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; font-size:13px; font-weight:500; list-style:none; transition:var(--t)`.
- `.acc-item summary::-webkit-details-marker`: `display:none`.
- `.acc-item summary:hover`: `background:var(--surface)`.
- `.acc-item summary::after`: `content: ""; width:7px; height:7px; flex:none; border-right:1.5px solid var(--muted); border-bottom:1.5px solid var(--muted); transform:rotate(45deg); transition:transform var(--t); margin-top:-4px`.
- `.acc-item[open] summary::after`: `transform:rotate(-135deg); margin-top:2px`.
- `.acc-body`: `padding:0 16px 16px; font-size:12.5px; color:var(--muted)`.
- `.tip`: `position:relative; display:inline-flex`.
- `.tip::after`: `content:attr(data-tip); position:absolute; bottom:calc(100% + 9px); left:50%; transform:translateX(-50%) translateY(4px); background:var(--text); color:var(--bg); font-size:11px; font-weight:500; padding:5px 9px; border-radius:var(--r-xs); white-space:nowrap; opacity:0; pointer-events:none; transition:var(--t); z-index:90`.
- `.tip:hover::after`: `opacity:1; transform:translateX(-50%)`.
- `.tip.below::after`: `bottom:auto; top:calc(100% + 9px)`.

Accordion content visibility relies on native details/summary behavior; only the indicator is animated. Tooltip uses the `data-tip` attribute and hover only; no focus rule is specified.

## Badges, avatars, and chips

- `.badge`: `display:inline-flex; align-items:center; gap:5px; height:20px; padding:0 8px; border-radius:var(--r-full); font-size:11px; font-weight:500; background:var(--surface-2); color:var(--muted)`.
- `.badge-solid`: `background:var(--accent); color:var(--on-accent)`.
- `.badge-success`: `background:var(--success-bg); color:var(--success)`.
- `.badge-warn`: `background:var(--warn-bg); color:var(--warn)`.
- `.badge-danger`: `background:var(--danger-bg); color:var(--danger)`.
- `.badge-info`: `background:var(--info-bg); color:var(--info)`.
- `.badge-outline`: `background:transparent; border:1px solid var(--border-strong)`.
- `.badge-dot`: `width:6px; height:6px; border-radius:50%; background:currentColor`.
- `.avatar`: `width:36px; height:36px; border-radius:50%; background:var(--surface-2); color:var(--muted); display:inline-grid; place-items:center; font-size:12px; font-weight:600; flex:none; overflow:hidden; border:1px solid var(--border); letter-spacing:.02em`.
- `.avatar-sm`: `width:26px; height:26px; font-size:10px`.
- `.avatar-lg`: `width:48px; height:48px; font-size:15px`.
- `.avatar-xl`: `width:72px; height:72px; font-size:22px`.
- `.avatar-group`: `display:flex`.
- `.avatar-group .avatar`: `margin-left:-9px; border:2px solid var(--bg)`.
- `.avatar-group .avatar:first-child`: `margin-left:0`.
- `.chip`: `display:inline-flex; align-items:center; gap:6px; height:26px; padding:0 10px; border:1px solid var(--border-strong); border-radius:var(--r-full); font-size:12px; color:var(--text); background:var(--bg); transition:var(--t)`.
- `.chip:hover`: `background:var(--surface-2)`.
- `.chip .x`: `color:var(--faint); display:grid; place-items:center`.
- `.chip .x:hover`: `color:var(--text)`.
- `.chip.active`: `background:var(--accent); color:var(--on-accent); border-color:var(--accent)`.

Chip removal and selection require external behavior; the `.x` is only styled.

## Progress and skeletons

- `.progress`: `height:5px; border-radius:var(--r-full); background:var(--surface-2); overflow:hidden; width:100%`.
- `.progress > i`: `display:block; height:100%; background:var(--accent); border-radius:inherit; transition:width .3s ease`.
- `.progress.thin`: `height:3px`.
- `.progress.thick`: `height:8px`.
- `.progress.success > i`: `background:var(--success)`.
- `.progress.warn > i`: `background:var(--warn)`.
- `.skeleton`: `background:linear-gradient(90deg,var(--surface-2) 25%,var(--border) 37%,var(--surface-2) 63%); background-size:400% 100%; animation:shimmer 1.4s ease infinite; border-radius:var(--r-xs)`.
- `.sk-line`: `height:10px; margin-bottom:8px`.
- `.sk-title`: `height:14px; width:45%; margin-bottom:12px`.
- `.sk-avatar`: `width:36px; height:36px; border-radius:50%`.
- `.sk-img`: `width:100%; height:120px; border-radius:var(--r-sm)`.
- `.sk-btn`: `width:90px; height:32px; border-radius:var(--r-sm)`.

The shimmer keyframes are specified in Part A. Progress fill width is not assigned by a stylesheet rule and must be supplied separately.

## Alerts and toasts

- `.alert`: `display:flex; gap:12px; padding:14px 16px; border-radius:var(--r); border:1px solid var(--border); background:var(--surface); font-size:13px`.
- `.alert .icon`: `margin-top:1px`.
- `.alert-title`: `font-weight:600; font-size:12.5px; margin-bottom:2px`.
- `.alert-text`: `font-size:12.5px; color:var(--muted)`.
- `.alert-success`: `background:var(--success-bg); border-color:transparent; color:var(--success)`.
- `.alert-success .alert-text`: `color:inherit; opacity:.85`.
- `.alert-warn`: `background:var(--warn-bg); border-color:transparent; color:var(--warn)`.
- `.alert-warn .alert-text`: `color:inherit; opacity:.85`.
- `.alert-danger`: `background:var(--danger-bg); border-color:transparent; color:var(--danger)`.
- `.alert-danger .alert-text`: `color:inherit; opacity:.85`.
- `.alert-info`: `background:var(--info-bg); border-color:transparent; color:var(--info)`.
- `.alert-info .alert-text`: `color:inherit; opacity:.85`.
- `.alert .close`: `margin-left:auto; background:none; border:0; color:inherit; opacity:.5; padding:0; line-height:0`.
- `.alert .close:hover`: `opacity:1`.
- `.toasts`: `position:fixed; right:20px; bottom:20px; z-index:300; display:flex; flex-direction:column; gap:10px; width:min(340px,calc(100vw - 40px))`.
- `.toast`: `display:flex; gap:11px; align-items:flex-start; padding:13px 14px; background:var(--bg); border:1px solid var(--border); border-radius:var(--r); box-shadow:var(--shadow); font-size:12.5px; animation:toastIn .22s ease`.
- `.toast.out`: `animation:toastOut .2s ease forwards`.
- `.toast .icon`: `margin-top:1px`.
- `.toast strong`: `display:block; font-size:12.5px; font-weight:600; margin-bottom:1px`.
- `.toast p`: `color:var(--muted); font-size:12px`.
- `.toast .close`: `margin-left:auto; background:none; border:0; color:var(--faint); padding:0; line-height:0`.
- `.toast .close:hover`: `color:var(--text)`.

Toast keyframes are in Part A. CSS provides entry and class-driven exit animation, but neither lifetime nor DOM removal. No semantic toast variants are declared.

## Modal overlays

- `.overlay`: `position:fixed; inset:0; z-index:200; display:grid; place-items:center; padding:20px; background:rgba(0,0,0,.42); backdrop-filter:blur(3px); opacity:0; visibility:hidden; transition:var(--t)`.
- `.overlay.open`: `opacity:1; visibility:visible`.
- `.modal`: `width:100%; max-width:440px; background:var(--bg); border:1px solid var(--border); border-radius:var(--r-lg); box-shadow:var(--shadow-lg); overflow:hidden; transform:translateY(10px) scale(.98); transition:var(--t)`.
- `.overlay.open .modal`: `transform:none`.
- `.modal-head`: `padding:20px 22px 0`.
- `.modal-head h3`: `font-size:15px; font-weight:600; letter-spacing:-.01em`.
- `.modal-head p`: `font-size:12.5px; color:var(--muted); margin-top:6px`.
- `.modal-body`: `padding:16px 22px; font-size:13px; color:var(--muted)`.
- `.modal-foot`: `padding:14px 22px; display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--border); background:var(--surface)`.
- `.modal-icon`: `width:40px; height:40px; border-radius:var(--r-full); display:grid; place-items:center; background:var(--surface-2); margin-bottom:14px`.
- `.modal-icon.danger`: `background:var(--danger-bg); color:var(--danger)`.

No separate confirmation-dialog CSS exists. Opening is class-driven; focus trapping, scroll locking, and dismissal are not CSS rules.

## Spinners and status blocks

- `.spinner`: `width:18px; height:18px; border-radius:50%; flex:none; border:1.5px solid var(--border-strong); border-top-color:var(--text); animation:spin .7s linear infinite`.
- `.spinner.lg`: `width:28px; height:28px; border-width:2px`.
- `.spinner.sm`: `width:13px; height:13px; border-width:1.5px`.
- `.spinner-btn`: `display:inline-flex; align-items:center; gap:9px; font-size:12.5px; color:var(--muted)`.
- `.empty`: `text-align:center; padding:44px 24px; border:1px dashed var(--border-strong); border-radius:var(--r); background:var(--surface)`.
- `.empty .glyph`: `width:44px; height:44px; border-radius:var(--r); background:var(--surface-2); display:grid; place-items:center; margin:0 auto 14px; color:var(--faint)`.
- `.empty h4`: `font-size:14px; font-weight:600; margin-bottom:5px`.
- `.empty p`: `font-size:12.5px; color:var(--muted); max-width:34ch; margin:0 auto 16px`.
- `.state-error`: `padding:20px; border:1px solid var(--danger); border-radius:var(--r); background:var(--danger-bg); display:flex; gap:14px; align-items:flex-start`.
- `.state-error .icon`: `color:var(--danger); margin-top:2px`.
- `.state-error h4`: `font-size:13px; font-weight:600; color:var(--danger); margin-bottom:3px`.
- `.state-error p`: `font-size:12.5px; color:var(--danger); opacity:.85; margin-bottom:10px`.
- `.state-success`: `padding:20px; border-radius:var(--r); background:var(--success-bg); display:flex; gap:14px; align-items:flex-start`.
- `.state-success .icon`: `color:var(--success); margin-top:2px`.
- `.state-success h4`: `font-size:13px; font-weight:600; color:var(--success); margin-bottom:3px`.
- `.state-success p`: `font-size:12.5px; color:var(--success); opacity:.85`.

## Layout primitives

- `.container`: `width:100%; max-width:640px; margin:0 auto; padding:18px; border:1px dashed var(--border-strong); border-radius:var(--r); font-size:12px; color:var(--faint); text-align:center`.
- `.grid`: `display:grid; gap:12px`.
- `.grid-2`: `grid-template-columns:repeat(2,1fr)`.
- `.grid-3`: `grid-template-columns:repeat(3,1fr)`.
- `.grid-4`: `grid-template-columns:repeat(4,1fr)`.
- `.grid-auto`: `grid-template-columns:repeat(auto-fit,minmax(120px,1fr))`.
- `.grid > div`: `background:var(--surface-2); border-radius:var(--r-sm); padding:16px 10px; text-align:center; font-size:11.5px; color:var(--muted); border:1px solid var(--border)`.
- `.stack`: `display:flex; flex-direction:column; gap:12px`.
- `.hstack`: `display:flex; align-items:center; gap:12px`.
- `.hstack-between`: `display:flex; align-items:center; justify-content:space-between; gap:12px`.
- `.divider`: `border:0; height:1px; background:var(--border); margin:0; width:100%`.
- `.divider-v`: `width:1px; background:var(--border); align-self:stretch`.
- `.divider-label`: `display:flex; align-items:center; gap:12px; color:var(--faint); font-size:11px`.
- `.divider-label::before,.divider-label::after`: `content: ""; flex:1; height:1px; background:var(--border)`.

The `.grid > div` rule applies to every direct div child, including cards and chart cards; its higher specificity overrides their matching single-class properties. It is not limited to illustrative cells.

## Drawer, bottom sheet, and scrim

- `.drawer`: `position:fixed; top:0; right:0; bottom:0; width:min(360px,92vw); z-index:220; background:var(--bg); border-left:1px solid var(--border); transform:translateX(100%); transition:transform .26s cubic-bezier(.4,0,.2,1); display:flex; flex-direction:column`.
- `.drawer.open`: `transform:none`.
- `.drawer-head`: `display:flex; align-items:center; justify-content:space-between; padding:16px 18px; border-bottom:1px solid var(--border)`.
- `.drawer-head h3`: `font-size:14px; font-weight:600`.
- `.drawer-body`: `padding:18px; flex:1; overflow-y:auto`.
- `.drawer-foot`: `padding:14px 18px; border-top:1px solid var(--border); display:flex; gap:8px`.
- `.sheet`: `position:fixed; left:0; right:0; bottom:0; z-index:220; background:var(--bg); border-top:1px solid var(--border); border-radius:var(--r-lg) var(--r-lg) 0 0; transform:translateY(100%); transition:transform .26s cubic-bezier(.4,0,.2,1); padding:10px 20px 26px; max-height:80vh; overflow-y:auto`.
- `.sheet.open`: `transform:none`.
- `.sheet-handle`: `width:36px; height:4px; border-radius:var(--r-full); background:var(--border-strong); margin:6px auto 16px`.
- `.scrim`: `position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:210; opacity:0; visibility:hidden; transition:var(--t); backdrop-filter:blur(2px)`.
- `.scrim.open`: `opacity:1; visibility:visible`.

Drawer and sheet are translated offscreen when closed, not hidden with visibility or display. Their open states and scrim state are separate. The sheet handle has no CSS drag behavior.

## Placeholder media and gallery

- `.ph`: `background-color:var(--surface-2); background-image:repeating-linear-gradient(45deg,transparent 0 9px,rgba(128,128,128,.09) 9px 18px); display:grid; place-items:center; color:var(--faint)`.
- `.gallery`: `display:grid; grid-template-columns:repeat(3,1fr); gap:8px`.
- `.gallery .ph`: `aspect-ratio:1; border-radius:var(--r-sm); transition:var(--t); overflow:hidden`.
- `.gallery .ph:hover`: `transform:scale(1.02); color:var(--muted)`.
- `.gallery .ph:first-child`: `grid-column:span 2; grid-row:span 2; aspect-ratio:auto`.

## Carousel

- `.carousel`: `position:relative; overflow:hidden; border-radius:var(--r); border:1px solid var(--border)`.
- `.carousel-track`: `display:flex; transition:transform .38s cubic-bezier(.4,0,.2,1)`.
- `.carousel-slide`: `min-width:100%; aspect-ratio:16/7; display:grid; place-items:center; color:var(--faint)`.
- `.carousel-nav`: `position:absolute; top:50%; transform:translateY(-50%); width:34px; height:34px; border-radius:50%; border:1px solid var(--border); background:var(--bg); color:var(--text); display:grid; place-items:center; transition:var(--t); box-shadow:var(--shadow-sm)`.
- `.carousel-nav:hover`: `background:var(--surface-2)`.
- `.carousel-nav.prev`: `left:12px`.
- `.carousel-nav.next`: `right:12px`.
- `.carousel-dots`: `display:flex; gap:6px; justify-content:center; padding:12px 0 0`.
- `.carousel-dots button`: `width:6px; height:6px; border-radius:50%; background:var(--border-strong); border:0; padding:0; transition:var(--t)`.
- `.carousel-dots button.active`: `background:var(--text); width:18px; border-radius:var(--r-full)`.

Track transform and active dot require external updates. CSS does not specify automatic cycling, wrapping, or swipe gestures.

## Video and audio presentation

- `.player`: `border:1px solid var(--border); border-radius:var(--r); overflow:hidden; background:var(--bg)`.
- `.player-stage`: `position:relative; aspect-ratio:16/9; display:grid; place-items:center`.
- `.player-stage .play-big`: `width:56px; height:56px; border-radius:50%; background:rgba(255,255,255,.9); border:0; display:grid; place-items:center; color:#111; transition:var(--t); backdrop-filter:blur(6px)`.
- `.player-stage .play-big:hover`: `transform:scale(1.06)`.
- `.player-controls`: `display:flex; align-items:center; gap:12px; padding:10px 14px; border-top:1px solid var(--border); background:var(--bg)`.
- `.player-controls .time`: `font-size:11px; color:var(--faint); font-family:var(--mono); white-space:nowrap`.
- `.track`: `flex:1; height:3px; border-radius:var(--r-full); background:var(--surface-2); position:relative`.
- `.track > i`: `display:block; height:100%; background:var(--text); border-radius:inherit; position:relative; transition:width .2s linear`.
- `.track > i::after`: `content: ""; position:absolute; right:-4px; top:50%; transform:translateY(-50%); width:9px; height:9px; border-radius:50%; background:var(--text); opacity:0; transition:var(--t)`.
- `.track:hover > i::after`: `opacity:1`.
- `.audio`: `display:flex; align-items:center; gap:14px; padding:14px 16px; border:1px solid var(--border); border-radius:var(--r); background:var(--bg); max-width:460px`.
- `.audio .art`: `width:46px; height:46px; border-radius:var(--r-sm); flex:none`.
- `.wave`: `display:flex; align-items:center; gap:2px; height:26px; flex:1`.
- `.wave i`: `flex:1; background:var(--border-strong); border-radius:1px; min-height:3px`.
- `.wave i.on`: `background:var(--text)`.

No playing/paused CSS state or actual media playback behavior is defined. Track width and waveform bar heights are not supplied by these rules. Hover exposes the track knob; dragging is not defined.

## Lightbox

- `.lightbox`: `position:fixed; inset:0; z-index:250; background:rgba(8,8,8,.94); display:grid; place-items:center; padding:40px; opacity:0; visibility:hidden; transition:var(--t)`.
- `.lightbox.open`: `opacity:1; visibility:visible`.
- `.lightbox .lb-content`: `width:min(720px,100%); aspect-ratio:4/3; border-radius:var(--r); background:var(--surface-2); background-image:repeating-linear-gradient(45deg,transparent 0 14px,rgba(128,128,128,.12) 14px 28px); display:grid; place-items:center; color:var(--faint)`.
- `.lightbox .lb-close`: `position:absolute; top:22px; right:22px; width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,.1); border:0; color:#fff; display:grid; place-items:center; transition:var(--t)`.
- `.lightbox .lb-close:hover`: `background:rgba(255,255,255,.2)`.

## Products and prices

- `.product`: `border:1px solid var(--border); border-radius:var(--r); overflow:hidden; background:var(--bg); transition:var(--t); max-width:250px`.
- `.product:hover`: `border-color:var(--border-strong); box-shadow:var(--shadow)`.
- `.product .thumb`: `aspect-ratio:4/3; position:relative`.
- `.product .thumb .fav`: `position:absolute; top:10px; right:10px; width:30px; height:30px; border-radius:50%; background:var(--bg); border:1px solid var(--border); display:grid; place-items:center; color:var(--muted); transition:var(--t)`.
- `.product .thumb .fav:hover`: `color:var(--danger)`.
- `.product .info`: `padding:14px`.
- `.product .name`: `font-size:13px; font-weight:500; margin-bottom:2px`.
- `.product .cat`: `font-size:11.5px; color:var(--faint); margin-bottom:10px`.
- `.product .buy`: `display:flex; align-items:center; justify-content:space-between; gap:10px`.
- `.price`: `display:flex; align-items:baseline; gap:7px`.
- `.price .now`: `font-size:15px; font-weight:600; letter-spacing:-.02em`.
- `.price .was`: `font-size:12px; color:var(--faint); text-decoration:line-through`.
- `.price .off`: `font-size:10.5px; font-weight:600; color:var(--success); background:var(--success-bg); padding:1px 6px; border-radius:var(--r-full)`.

Favorite has hover styling but no selected state.

## Cart and quantity controls

- `.cart`: `border:1px solid var(--border); border-radius:var(--r); background:var(--bg); overflow:hidden; max-width:400px`.
- `.cart-head`: `padding:14px 16px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; font-size:13px; font-weight:600`.
- `.cart-item`: `display:flex; gap:12px; padding:14px 16px; border-bottom:1px solid var(--border)`.
- `.cart-item .thumb`: `width:52px; height:52px; border-radius:var(--r-sm); flex:none`.
- `.cart-item .meta`: `flex:1; min-width:0`.
- `.cart-item .meta .n`: `font-size:12.5px; font-weight:500`.
- `.cart-item .meta .v`: `font-size:11.5px; color:var(--faint)`.
- `.cart-foot`: `padding:14px 16px; background:var(--surface)`.
- `.cart-row`: `display:flex; justify-content:space-between; font-size:12.5px; color:var(--muted); margin-bottom:6px`.
- `.cart-row.total`: `font-size:14px; font-weight:600; color:var(--text); margin:10px 0 14px`.
- `.qty`: `display:inline-flex; align-items:center; border:1px solid var(--border-strong); border-radius:var(--r-sm); overflow:hidden`.
- `.qty button`: `width:28px; height:28px; border:0; background:none; color:var(--muted); display:grid; place-items:center; transition:var(--t); font-size:14px; line-height:1`.
- `.qty button:hover`: `background:var(--surface-2); color:var(--text)`.
- `.qty input`: `width:34px; height:28px; border:0; border-left:1px solid var(--border); border-right:1px solid var(--border); background:none; text-align:center; font-family:inherit; font-size:12.5px; color:var(--text); -moz-appearance:textfield`.
- `.qty input::-webkit-outer-spin-button,.qty input::-webkit-inner-spin-button`: `-webkit-appearance:none; margin:0`.
- `.qty input:focus`: `outline:none; background:var(--surface-2)`.

No increment, decrement, bounds, subtotal calculation, or checkout-specific styling is defined by CSS.

## Ratings and reviews

- `.rating`: `display:inline-flex; align-items:center; gap:2px`.
- `.rating .icon`: `width:14px; height:14px; stroke:none`.
- `.rating .star-on`: `fill:var(--text); color:var(--text)`.
- `.rating .star-off`: `fill:var(--border-strong); color:var(--border-strong)`.
- `.review`: `display:flex; gap:12px; padding:16px 0; border-bottom:1px solid var(--border)`.
- `.review:last-child`: `border-bottom:0`.
- `.review .r-head`: `display:flex; align-items:center; gap:8px; margin-bottom:4px`.
- `.review .r-name`: `font-size:12.5px; font-weight:600`.
- `.review .r-date`: `font-size:11px; color:var(--faint)`.
- `.review p`: `font-size:12.5px; color:var(--muted); margin-top:6px`.

## Calendar

- `.calendar`: `border:1px solid var(--border); border-radius:var(--r); background:var(--bg); padding:16px; max-width:300px; width:100%`.
- `.cal-head`: `display:flex; align-items:center; justify-content:space-between; margin-bottom:14px`.
- `.cal-head .m`: `font-size:13px; font-weight:600`.
- `.cal-grid`: `display:grid; grid-template-columns:repeat(7,1fr); gap:2px`.
- `.cal-grid .dow`: `font-size:10px; color:var(--faint); text-align:center; padding:4px 0; text-transform:uppercase; letter-spacing:.06em`.
- `.cal-grid .day`: `aspect-ratio:1; display:grid; place-items:center; font-size:12px; border-radius:var(--r-xs); color:var(--muted); transition:var(--t); border:0; background:none`.
- `.cal-grid .day:hover`: `background:var(--surface-2); color:var(--text)`.
- `.cal-grid .day.mute`: `color:var(--faint); opacity:.4`.
- `.cal-grid .day.today`: `color:var(--text); font-weight:600; box-shadow:inset 0 0 0 1px var(--border-strong)`.
- `.cal-grid .day.sel`: `background:var(--accent); color:var(--on-accent); font-weight:500`.

Selected styling follows today styling; combined states retain the today inset shadow but use selected background, foreground, and weight. Muted days are not disabled by CSS. Calendar generation, selection changes, and month navigation require external behavior.

## Chat

- `.chat`: `border:1px solid var(--border); border-radius:var(--r); background:var(--bg); display:flex; flex-direction:column; height:400px; max-width:400px; overflow:hidden`.
- `.chat-head`: `display:flex; align-items:center; gap:10px; padding:12px 14px; border-bottom:1px solid var(--border)`.
- `.chat-head .n`: `font-size:13px; font-weight:600`.
- `.chat-head .s`: `font-size:11px; color:var(--success); display:flex; align-items:center; gap:5px`.
- `.chat-head .s::before`: `content: ""; width:6px; height:6px; border-radius:50%; background:var(--success)`.
- `.chat-body`: `flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px`.
- `.bubble`: `max-width:78%; padding:9px 13px; border-radius:var(--r-lg); font-size:12.5px; line-height:1.5`.
- `.bubble.them`: `background:var(--surface-2); color:var(--text); border-bottom-left-radius:var(--r-xs); align-self:flex-start`.
- `.bubble.me`: `background:var(--accent); color:var(--on-accent); border-bottom-right-radius:var(--r-xs); align-self:flex-end`.
- `.bubble .t`: `display:block; font-size:10px; opacity:.55; margin-top:4px`.
- `.chat-input`: `display:flex; gap:8px; padding:12px; border-top:1px solid var(--border); align-items:center`.
- `.chat-input .input`: `height:34px`.

## Map

- `.map`: `position:relative; height:260px; border:1px solid var(--border); border-radius:var(--r); overflow:hidden; background:var(--surface); background-image:linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px); background-size:40px 40px`.
- `.map .road`: `position:absolute; background:var(--border-strong)`.
- `.map .road.h`: `height:6px; left:0; right:0`.
- `.map .road.v`: `width:6px; top:0; bottom:0`.
- `.map .pin`: `position:absolute; left:50%; top:46%; transform:translate(-50%,-100%); width:26px; height:26px; border-radius:50% 50% 50% 0; background:var(--text); rotate:-45deg; display:grid; place-items:center; box-shadow:var(--shadow)`.
- `.map .pin::after`: `content: ""; width:9px; height:9px; border-radius:50%; background:var(--bg); rotate:45deg`.
- `.map .map-ui`: `position:absolute; bottom:12px; right:12px; display:flex; flex-direction:column; border:1px solid var(--border); border-radius:var(--r-sm); overflow:hidden; background:var(--bg)`.
- `.map .map-ui button`: `width:30px; height:30px; border:0; background:var(--bg); color:var(--text); font-size:14px; border-bottom:1px solid var(--border)`.
- `.map .map-ui button:last-child`: `border-bottom:0`.
- `.map .map-ui button:hover`: `background:var(--surface-2)`.

Road cross-axis positions and interactive map behavior are not specified by CSS.

## Code display and rich-text editor

- `.code`: `border:1px solid var(--border); border-radius:var(--r); overflow:hidden; background:var(--bg)`.
- `.code-head`: `display:flex; align-items:center; gap:8px; padding:9px 14px; border-bottom:1px solid var(--border); background:var(--surface)`.
- `.code-head .dots`: `display:flex; gap:5px`.
- `.code-head .dots i`: `width:9px; height:9px; border-radius:50%; background:var(--border-strong); display:block`.
- `.code-head .fname`: `font-size:11.5px; color:var(--muted); font-family:var(--mono); margin-left:6px`.
- `.code pre`: `margin:0; padding:14px 0; overflow-x:auto; font-family:var(--mono); font-size:12px; line-height:1.7`.
- `.code .line`: `display:flex; padding:0 14px`.
- `.code .ln`: `width:24px; text-align:right; color:var(--faint); user-select:none; margin-right:16px; flex:none; font-size:11px`.
- `.tok-k`: `color:var(--info)`.
- `.tok-s`: `color:var(--success)`.
- `.tok-c`: `color:var(--faint); font-style:italic`.
- `.tok-f`: `color:var(--warn)`.
- `.tok-n`: `color:var(--danger)`.
- `.rte`: `border:1px solid var(--border); border-radius:var(--r); overflow:hidden; background:var(--bg)`.
- `.rte-bar`: `display:flex; align-items:center; gap:2px; padding:6px 8px; border-bottom:1px solid var(--border); background:var(--surface); flex-wrap:wrap`.
- `.rte-bar .icon-btn.sm`: `color:var(--muted)`.
- `.rte-bar .icon-btn.sm.active`: `background:var(--surface-2); color:var(--text)`.
- `.rte-area`: `padding:16px; min-height:130px; font-size:13px; line-height:1.65; outline:none`.
- `.rte-area:focus`: `background:var(--bg)`.
- `.rte-area h4`: `font-size:14px; margin-bottom:6px`.
- `.rte-area p`: `color:var(--muted); margin-bottom:10px`.
- `.rte-area ul`: `margin:0 0 10px; padding-left:20px; color:var(--muted)`.

CSS styles code and editing surfaces; it does not enable editing, syntax parsing, or formatting commands.

## Charts

- `.chart-card`: `border:1px solid var(--border); border-radius:var(--r); padding:18px; background:var(--bg)`.
- `.chart-head`: `display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:18px`.
- `.chart-head .v`: `font-size:22px; font-weight:600; letter-spacing:-.03em`.
- `.chart-head .k`: `font-size:11.5px; color:var(--muted)`.
- `.bars`: `display:flex; align-items:flex-end; gap:6px; height:110px`.
- `.bars i`: `flex:1; background:var(--text); border-radius:2px 2px 0 0; opacity:.85; transition:var(--t)`.
- `.bars i:hover`: `opacity:1`.
- `.bars i.dim`: `opacity:.18`.
- `.donut`: `width:110px; height:110px; border-radius:50%; position:relative; flex:none; background:conic-gradient(var(--text) 0 46%, var(--border-strong) 46% 74%, var(--faint) 74% 100%)`.
- `.donut::after`: `content: ""; position:absolute; inset:16px; border-radius:50%; background:var(--bg); display:grid; place-items:center`.
- `.donut-center`: `position:absolute; inset:0; display:grid; place-items:center; z-index:1; font-size:16px; font-weight:600; letter-spacing:-.02em`.

Dim bar opacity wins over hover at equal specificity because it is later. Bar heights are not specified in stylesheet rules. Donut segments are fixed by the gradient; no line-chart CSS selector exists.

## Timeline and stepper

- `.timeline`: `position:relative; padding-left:26px`.
- `.timeline::before`: `content: ""; position:absolute; left:5px; top:6px; bottom:6px; width:1px; background:var(--border)`.
- `.tl-item`: `position:relative; padding-bottom:22px`.
- `.tl-item:last-child`: `padding-bottom:0`.
- `.tl-item::before`: `content: ""; position:absolute; left:-26px; top:5px; width:11px; height:11px; border-radius:50%; background:var(--bg); border:1.5px solid var(--border-strong)`.
- `.tl-item.done::before`: `background:var(--accent); border-color:var(--accent)`.
- `.tl-item.current::before`: `background:var(--bg); border-color:var(--accent); box-shadow:0 0 0 3px var(--surface-2)`.
- `.tl-time`: `font-size:11px; color:var(--faint); font-family:var(--mono)`.
- `.tl-title`: `font-size:13px; font-weight:500; margin:2px 0 2px`.
- `.tl-text`: `font-size:12.5px; color:var(--muted)`.
- `.stepper`: `display:flex; align-items:center; gap:0; flex-wrap:wrap`.
- `.step`: `display:flex; align-items:center; gap:10px`.
- `.step .num`: `width:26px; height:26px; border-radius:50%; display:grid; place-items:center; font-size:11.5px; font-weight:600; border:1px solid var(--border-strong); color:var(--muted); background:var(--bg); flex:none; transition:var(--t)`.
- `.step.active .num`: `background:var(--accent); color:var(--on-accent); border-color:var(--accent)`.
- `.step.done .num`: `background:var(--surface-2); color:var(--text); border-color:var(--border-strong)`.
- `.step .lbl`: `font-size:12.5px; color:var(--muted); white-space:nowrap`.
- `.step.active .lbl`: `color:var(--text); font-weight:500`.
- `.step-line`: `flex:1; height:1px; background:var(--border); min-width:24px; margin:0 12px`.
- `.step-panel`: `padding:20px 0 0; font-size:13px; color:var(--muted)`.

Step panels are not hidden by CSS. Active/done progression requires external coordination; if both classes match, done number styling wins while the active label styling remains.

## Cookie banner

- `.cookie`: `display:flex; align-items:center; gap:16px; padding:16px 20px; border:1px solid var(--border); border-radius:var(--r); background:var(--bg); box-shadow:var(--shadow); flex-wrap:wrap`.
- `.cookie .txt`: `flex:1; min-width:240px`.
- `.cookie .txt strong`: `font-size:13px; display:block; margin-bottom:3px`.
- `.cookie .txt p`: `font-size:12px; color:var(--muted)`.
- `.cookie .acts`: `display:flex; gap:8px`.

No fixed positioning, dismissal state, or consent storage is specified.

## Responsive overrides and navigation toggle

Apply these after the preceding component rules.

At `@media (max-width:1000px)`:

- `.docnav`: `transform:translateX(-100%); transition:transform .24s ease`.
- `.docnav.open`: `transform:none; box-shadow:var(--shadow-lg)`.
- `.docmain`: `margin-left:0; padding:28px 24px 120px`.
- `.nav-toggle`: `display:inline-grid !important`.

At `@media (max-width:720px)`:

- `.grid-3,.grid-4`: `grid-template-columns:repeat(2,1fr)`.
- `.gallery`: `grid-template-columns:repeat(2,1fr)`.
- `.gallery .ph:first-child`: `grid-column:span 2; grid-row:auto`; its earlier `aspect-ratio:auto` remains.
- `.doc-head h1`: `font-size:24px`.

Final non-media rule:

- `.nav-toggle`: `display:none; position:fixed; top:14px; left:14px; z-index:70`.

The important media declaration makes the toggle visible at widths up to 1000px despite the later base rule. At larger widths `.docnav.open` has no dedicated effect. No grid collapses to one column through a media query.

## Conflicts

- **Single border weight versus multiple widths:** introductory copy claims one border weight, accordion copy claims two, and editor sample copy claims unified weights. CSS uses `1px`, `1.5px`, `2px`, and `3px` borders, as well as zero borders. These claims do not describe the enforced rules.
- **Four-step radius claim:** accordion copy describes four steps; root CSS declares five named radii (`4px`, `6px`, `8px`, `14px`, `999px`) and components add literal radii such as `1px`, `2px`, `5px`, and `50%`.
- **Monochrome claim:** the neutral/accent palette is monochrome and accent equals text, but semantic statuses and syntax colors explicitly use green, amber, red, and blue. The complete system is not monochrome.
- **Every color is a variable claim:** several foregrounds, overlays, shadows, and gradient stripes use literal colors. Dark-theme overrides therefore do not replace every color.
- **Single spacing rhythm claim:** CSS contains many literal padding, margin, and gap values and defines no shared spacing variable. The displayed code sample's `--space` and `--radius` declarations are not actual stylesheet tokens; the real radius properties use the `--r` naming family.
- **File upload promises:** file type/size limits and drop-or-browse wording are not enforced by the stylesheet. Only a styled hoverable region exists at the CSS level; no drag state or constraint rule exists.
- **Validation and date-range wording:** sample password rules, character counts, availability messages, and date-range labels do not establish CSS constraints or range-selection behavior. The stylesheet supplies only visual field and message states.
```

## tokens.json

```json
{
  "color": {
    "light": {
      "bg": "#ffffff",
      "surface": "#fafafa",
      "surface-2": "#f2f2f2",
      "border": "#e8e8e8",
      "border-strong": "#d6d6d6",
      "text": "#0f0f0f",
      "muted": "#757575",
      "faint": "#a8a8a8",
      "accent": "#0f0f0f",
      "on-accent": "#ffffff",
      "success": "#157f4a",
      "success-bg": "#eef7f1",
      "warn": "#9a6700",
      "warn-bg": "#fdf6e3",
      "danger": "#c0362c",
      "danger-bg": "#fdefee",
      "info": "#1d5fa8",
      "info-bg": "#eef3fa"
    },
    "dark": {
      "bg": "#0c0c0c",
      "surface": "#141414",
      "surface-2": "#1c1c1c",
      "border": "#242424",
      "border-strong": "#333333",
      "text": "#f5f5f5",
      "muted": "#9a9a9a",
      "faint": "#6b6b6b",
      "accent": "#f5f5f5",
      "on-accent": "#0c0c0c",
      "success": "#4ec98a",
      "success-bg": "#0f2419",
      "warn": "#e0b341",
      "warn-bg": "#241d0b",
      "danger": "#f0736a",
      "danger-bg": "#2a1311",
      "info": "#7aaef0",
      "info-bg": "#0f1a2a"
    }
  },
  "typography": {
    "family": {
      "font": "\"Inter\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif",
      "mono": "ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, monospace"
    },
    "size": [
      "10px",
      "10.5px",
      "11px",
      "11.5px",
      "12px",
      "12.5px",
      "13px",
      "13.5px",
      "14px",
      "15px",
      "16px",
      "22px",
      "24px",
      "30px"
    ],
    "weight": [
      500,
      600
    ],
    "letterSpacing": [
      "-.03em",
      "-.02em",
      "-.01em",
      ".02em",
      ".06em",
      ".1em",
      ".12em",
      ".14em"
    ],
    "lineHeight": [
      0,
      1,
      1.45,
      1.5,
      1.55,
      1.65,
      1.7
    ]
  },
  "radius": {
    "r-xs": "4px",
    "r-sm": "6px",
    "r": "8px",
    "r-lg": "14px",
    "r-full": "999px"
  },
  "shadow": {
    "light": {
      "ring": "0 0 0 3px rgba(15,15,15,.08)",
      "shadow-sm": "0 1px 2px rgba(0,0,0,.05)",
      "shadow": "0 4px 16px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.04)",
      "shadow-lg": "0 24px 60px rgba(0,0,0,.14)"
    },
    "dark": {
      "ring": "0 0 0 3px rgba(245,245,245,.12)",
      "shadow-sm": "0 1px 2px rgba(0,0,0,.05)",
      "shadow": "0 4px 16px rgba(0,0,0,.5), 0 1px 2px rgba(0,0,0,.4)",
      "shadow-lg": "0 24px 60px rgba(0,0,0,.7)"
    }
  },
  "effects": {
    "backdropBlur": [
      "2px",
      "3px",
      "6px"
    ]
  },
  "gradient": {
    "shimmer": "linear-gradient(90deg,var(--surface-2) 25%,var(--border) 37%,var(--surface-2) 63%)",
    "stripeFine": "repeating-linear-gradient(45deg,transparent 0 9px,rgba(128,128,128,.09) 9px 18px)",
    "stripeCoarse": "repeating-linear-gradient(45deg,transparent 0 14px,rgba(128,128,128,.12) 14px 28px)",
    "grid": "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
    "conic": "conic-gradient(var(--text) 0 46%, var(--border-strong) 46% 74%, var(--faint) 74% 100%)"
  },
  "spacing": {
    "observedPositivePx": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      16,
      18,
      20,
      22,
      24,
      26,
      28,
      36,
      40,
      44,
      52,
      56,
      72,
      120,
      140,
      236
    ]
  },
  "grid": {
    "gap": "12px",
    "columns2": "repeat(2,1fr)",
    "columns3": "repeat(3,1fr)",
    "columns4": "repeat(4,1fr)",
    "columnsAuto": "repeat(auto-fit,minmax(120px,1fr))"
  },
  "breakpoint": {
    "max1000": "(max-width:1000px)",
    "max720": "(max-width:720px)"
  },
  "motion": {
    "t": ".16s ease",
    "durations": [
      ".16s",
      ".2s",
      ".22s",
      ".24s",
      ".26s",
      ".3s",
      ".38s",
      ".7s",
      "1.4s"
    ],
    "easings": [
      "ease",
      "linear",
      "cubic-bezier(.4,0,.2,1)"
    ]
  },
  "elevation": {
    "zIndex": [
      1,
      60,
      70,
      80,
      90,
      200,
      210,
      220,
      250,
      300
    ]
  }
}
```

## preview.html

```html
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Minimal UI Kit</title>
<style>
/* ============================================================
 TOKENS
 ============================================================ */
:root{
 --font: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
 --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;

 --bg:#ffffff;
 --surface:#fafafa;
 --surface-2:#f2f2f2;
 --border:#e8e8e8;
 --border-strong:#d6d6d6;
 --text:#0f0f0f;
 --muted:#757575;
 --faint:#a8a8a8;
 --accent:#0f0f0f;
 --on-accent:#ffffff;
 --ring:0 0 0 3px rgba(15,15,15,.08);

 --success:#157f4a; --success-bg:#eef7f1;
 --warn:#9a6700; --warn-bg:#fdf6e3;
 --danger:#c0362c; --danger-bg:#fdefee;
 --info:#1d5fa8; --info-bg:#eef3fa;

 --r-xs:4px; --r-sm:6px; --r:8px; --r-lg:14px; --r-full:999px;
 --shadow-sm:0 1px 2px rgba(0,0,0,.05);
 --shadow:0 4px 16px rgba(0,0,0,.07), 0 1px 2px rgba(0,0,0,.04);
 --shadow-lg:0 24px 60px rgba(0,0,0,.14);
 --t:.16s ease;
}
[data-theme="dark"]{
 --bg:#0c0c0c; --surface:#141414; --surface-2:#1c1c1c;
 --border:#242424; --border-strong:#333333;
 --text:#f5f5f5; --muted:#9a9a9a; --faint:#6b6b6b;
 --accent:#f5f5f5; --on-accent:#0c0c0c;
 --ring:0 0 0 3px rgba(245,245,245,.12);
 --success:#4ec98a; --success-bg:#0f2419;
 --warn:#e0b341; --warn-bg:#241d0b;
 --danger:#f0736a; --danger-bg:#2a1311;
 --info:#7aaef0; --info-bg:#0f1a2a;
 --shadow:0 4px 16px rgba(0,0,0,.5), 0 1px 2px rgba(0,0,0,.4);
 --shadow-lg:0 24px 60px rgba(0,0,0,.7);
}

/* ============================================================
 BASE
 ============================================================ */
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
 margin:0; background:var(--bg); color:var(--text);
 font-family:var(--font); font-size:14px; line-height:1.55;
 -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
 transition:background var(--t), color var(--t);
}
h1,h2,h3,h4,p{margin:0}
a{color:inherit}
button{font-family:inherit}
::selection{background:var(--text);color:var(--bg)}

.icon{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6;
 stroke-linecap:round;stroke-linejoin:round;flex:none;display:block}
.icon-sm{width:14px;height:14px}
.icon-lg{width:22px;height:22px}

/* ============================================================
 DOC SHELL
 ============================================================ */
.docnav{
 position:fixed; inset:0 auto 0 0; width:236px; z-index:60;
 background:var(--bg); border-right:1px solid var(--border);
 padding:22px 14px; overflow-y:auto;
}
.brand{display:flex;align-items:center;gap:10px;padding:0 8px 18px;font-size:13px;letter-spacing:-.01em}
.brand-mark{width:16px;height:16px;border-radius:5px;background:var(--text);display:block}
.brand strong{font-weight:600}
.brand span:last-child{color:var(--muted)}
.docnav nav{display:flex;flex-direction:column;gap:1px}
.docnav nav a{
 display:block;padding:6px 8px;border-radius:var(--r-xs);
 font-size:12.5px;color:var(--muted);text-decoration:none;transition:var(--t);
}
.docnav nav a:hover{background:var(--surface-2);color:var(--text)}
.docnav nav a.active{color:var(--text);background:var(--surface-2);font-weight:500}
.nav-group{padding:16px 8px 6px;font-size:10px;letter-spacing:.12em;
 text-transform:uppercase;color:var(--faint)}

.docmain{margin-left:236px;padding:44px 52px 140px;max-width:1200px}
.doc-head{margin-bottom:56px}
.doc-head h1{font-size:30px;font-weight:600;letter-spacing:-.03em;margin-bottom:8px}
.doc-head p{color:var(--muted);max-width:60ch;font-size:13.5px}
.doc-head .swatches{display:flex;gap:8px;margin-top:20px}
.doc-head .swatches i{width:22px;height:22px;border-radius:6px;display:block;border:1px solid var(--border)}

.section{margin-bottom:72px;scroll-margin-top:24px}
.section > h2{
 font-size:11px;text-transform:uppercase;letter-spacing:.14em;font-weight:600;
 color:var(--muted);border-bottom:1px solid var(--border);
 padding-bottom:12px;margin-bottom:28px;
}
.spec{margin-bottom:36px}
.spec-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;
 color:var(--faint);margin-bottom:10px}
.spec-body{}

.frame{border:1px solid var(--border);border-radius:var(--r);overflow:hidden;background:var(--bg)}
.frame-pad{padding:20px}
.row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.row-tight{gap:6px}
.col{display:flex;flex-direction:column;gap:10px}
.muted{color:var(--muted)}
.faint{color:var(--faint)}
.mono{font-family:var(--mono)}

/* ============================================================
 NAVIGATION
 ============================================================ */
.app-header{
 display:flex;align-items:center;justify-content:space-between;
 height:56px;padding:0 14px;border-bottom:1px solid var(--border);background:var(--bg);
}
.hdr-left,.hdr-right{display:flex;align-items:center;gap:6px}
.logo-mark{width:18px;height:18px;border-radius:5px;background:var(--text);margin:0 4px}
.hdr-title{font-size:13.5px;font-weight:600;letter-spacing:-.01em}

.navbar{
 display:flex;align-items:center;gap:2px;padding:8px 12px;
 border-bottom:1px solid var(--border);background:var(--bg);flex-wrap:wrap;
}
.nav-link{
 padding:7px 12px;border-radius:var(--r-sm);font-size:13px;color:var(--muted);
 text-decoration:none;transition:var(--t);border:0;background:none;:pointer;
}
.nav-link:hover{background:var(--surface-2);color:var(--text)}
.nav-link.active{color:var(--text);background:var(--surface-2);font-weight:500}

.sidebar{width:220px;padding:16px 12px;background:var(--surface);border-right:1px solid var(--border)}
.sb-group{padding:14px 10px 6px;font-size:10px;letter-spacing:.12em;
 text-transform:uppercase;color:var(--faint)}
.sb-item{
 display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:var(--r-sm);
 font-size:13px;color:var(--muted);text-decoration:none;transition:var(--t);
}
.sb-item:hover{background:var(--surface-2);color:var(--text)}
.sb-item.active{background:var(--bg);color:var(--text);font-weight:500;box-shadow:var(--shadow-sm)}
.sb-badge{margin-left:auto;font-size:10px;padding:1px 6px;border-radius:var(--r-full);
 background:var(--surface-2);color:var(--muted)}

.breadcrumbs{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted);flex-wrap:wrap}
.breadcrumbs a{text-decoration:none;transition:var(--t)}
.breadcrumbs a:hover{color:var(--text)}
.breadcrumbs .sep{color:var(--faint)}
.breadcrumbs .current{color:var(--text);font-weight:500}

.tabs{display:flex;gap:26px;border-bottom:1px solid var(--border);overflow-x:auto}
.tab{
 padding:10px 0;font-size:13px;color:var(--muted);:pointer;background:none;
 border:0;border-bottom:1.5px solid transparent;margin-bottom:-1px;transition:var(--t);
 white-space:nowrap;
}
.tab:hover{color:var(--text)}
.tab.active{color:var(--text);border-bottom-color:var(--text);font-weight:500}
.tabpanel{display:none;padding:16px 0;font-size:13px;color:var(--muted)}
.tabpanel.active{display:block}

.pagination{display:flex;align-items:center;gap:4px}
.page{
 min-width:32px;height:32px;padding:0 8px;display:inline-grid;place-items:center;
 border:1px solid transparent;border-radius:var(--r-sm);background:none;color:var(--muted);
 font-size:12.5px;:pointer;transition:var(--t);
}
.page:hover{background:var(--surface-2);color:var(--text)}
.page.active{background:var(--accent);color:var(--on-accent);font-weight:500}
.page[disabled]{opacity:.35;pointer-events:none}

/* ---------- Menus / dropdowns / popover ---------- */
.dropdown{position:relative;display:inline-block}
.menu,.popover{
 position:absolute;top:calc(100% + 6px);left:0;z-index:80;min-width:200px;
 background:var(--bg);border:1px solid var(--border);border-radius:var(--r);
 box-shadow:var(--shadow);padding:6px;
 opacity:0;visibility:hidden;transform:translateY(-4px);
 transition:opacity var(--t), transform var(--t), visibility var(--t);
}
.menu.open,.popover.open{opacity:1;visibility:visible;transform:none}
.menu.right{left:auto;right:0}
.menu-item{
 display:flex;align-items:center;gap:10px;width:100%;padding:7px 10px;border:0;
 background:none;font-size:13px;color:var(--text);border-radius:var(--r-xs);
 :pointer;text-align:left;text-decoration:none;transition:var(--t);
}
.menu-item:hover{background:var(--surface-2)}
.menu-item.danger{color:var(--danger)}
.menu-item .shortcut{margin-left:auto;font-size:11px;color:var(--faint);font-family:var(--mono)}
.menu-sep{height:1px;background:var(--border);margin:6px 2px}
.menu-label{padding:8px 10px 4px;font-size:10px;letter-spacing:.1em;
 text-transform:uppercase;color:var(--faint)}
.popover{min-width:260px;padding:14px;top:calc(100% + 8px)}

/* ============================================================
 FORM CONTROLS
 ============================================================ */
.field{display:flex;flex-direction:column;gap:6px;max-width:320px;width:100%}
.label{font-size:12px;font-weight:500;color:var(--text)}
.label .req{color:var(--danger);margin-left:2px}
.hint{font-size:11.5px;color:var(--faint)}
.input,.textarea,.select{
 width:100%;height:36px;padding:0 12px;border:1px solid var(--border-strong);
 border-radius:var(--r-sm);background:var(--bg);color:var(--text);
 font-family:inherit;font-size:13px;transition:var(--t);appearance:none;
}
.textarea{height:auto;min-height:88px;padding:9px 12px;resize:vertical;line-height:1.55}
.input::placeholder,.textarea::placeholder{color:var(--faint)}
.input:focus,.textarea:focus,.select:focus{
 outline:none;border-color:var(--text);box-shadow:var(--ring);
}
.input:disabled,.textarea:disabled,.select:disabled{background:var(--surface-2);opacity:.6;:not-allowed}
.input.invalid,.textarea.invalid{border-color:var(--danger)}
.input.invalid:focus,.textarea.invalid:focus{box-shadow:0 0 0 3px var(--danger-bg)}
.input.valid,.textarea.valid{border-color:var(--success)}

.select-wrap{position:relative;width:100%}
.select-wrap .select{padding-right:34px;:pointer}
.select-wrap::after{
 content: "";position:absolute;right:12px;top:50%;width:8px;height:8px;
 border-right:1.5px solid var(--muted);border-bottom:1.5px solid var(--muted);
 transform:translateY(-70%) rotate(45deg);pointer-events:none;
}

.search{position:relative;width:100%;max-width:320px}
.search .input{padding-left:36px}
.search .icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);
 color:var(--faint);pointer-events:none}
.search kbd{
 position:absolute;right:8px;top:50%;transform:translateY(-50%);
 font-family:var(--mono);font-size:10px;color:var(--faint);
 border:1px solid var(--border);border-radius:var(--r-xs);padding:1px 5px;background:var(--surface);
}

/* checkbox / radio / switch */
.check{display:inline-flex;align-items:flex-start;gap:9px;:pointer;font-size:13px;user-select:none}
.check input{position:absolute;opacity:0;width:0;height:0}
.box{
 width:16px;height:16px;border:1px solid var(--border-strong);border-radius:var(--r-xs);
 background:var(--bg);flex:none;margin-top:2px;position:relative;transition:var(--t);
}
.check input:checked + .box{background:var(--accent);border-color:var(--accent)}
.check input:checked + .box::after{
 content: "";position:absolute;left:5px;top:2px;width:3.5px;height:7.5px;
 border:solid var(--on-accent);border-width:0 1.5px 1.5px 0;transform:rotate(45deg);
}
.check input:focus-visible + .box{box-shadow:var(--ring)}
.check input:disabled + .box{opacity:.4}
.check input:disabled ~ .check-text{opacity:.45}
.box.round{border-radius:50%}
.check input:checked + .box.round{background:var(--accent);border-color:var(--accent);box-shadow:inset 0 0 0 3px var(--bg)}
.check input:checked + .box.round::after{display:none}

.switch{
 appearance:none;width:36px;height:20px;border-radius:var(--r-full);
 background:var(--border-strong);position:relative;:pointer;
 transition:var(--t);flex:none;border:0;margin:0;
}
.switch::after{
 content: "";position:absolute;top:2px;left:2px;width:16px;height:16px;
 border-radius:50%;background:#fff;transition:var(--t);
 box-shadow:0 1px 2px rgba(0,0,0,.2);
}
.switch:checked{background:var(--accent)}
.switch:checked::after{transform:translateX(16px);background:var(--bg)}
.switch:focus-visible{outline:none;box-shadow:var(--ring)}
.switch-row{display:inline-flex;align-items:center;gap:10px;font-size:13px}

/* file upload */
.dropzone{
 border:1px dashed var(--border-strong);border-radius:var(--r);padding:26px 20px;
 text-align:center;background:var(--surface);transition:var(--t);:pointer;
}
.dropzone:hover{border-color:var(--text);background:var(--surface-2)}
.dropzone .icon{margin:0 auto 10px;color:var(--faint);width:22px;height:22px}
.dropzone strong{font-size:13px;font-weight:500;display:block;margin-bottom:2px}
.dropzone span{font-size:11.5px;color:var(--faint)}

/* slider */
.range{
 appearance:none;width:100%;max-width:320px;height:2px;border-radius:2px;
 background:var(--border-strong);outline:none;:pointer;
}
.range::-webkit-slider-thumb{
 appearance:none;width:15px;height:15px;border-radius:50%;background:var(--accent);
 border:3px solid var(--bg);box-shadow:0 0 0 1px var(--border-strong);:pointer;transition:var(--t);
}
.range::-webkit-slider-thumb:hover{transform:scale(1.12)}
.range::-moz-range-thumb{
 width:15px;height:15px;border-radius:50%;background:var(--accent);
 border:3px solid var(--bg);box-shadow:0 0 0 1px var(--border-strong);:pointer;
}

/* validation */
.msg{display:flex;align-items:flex-start;gap:6px;font-size:11.5px;line-height:1.45}
.msg .icon{width:13px;height:13px;margin-top:2px}
.msg-error{color:var(--danger)}
.msg-success{color:var(--success)}
.msg-hint{color:var(--faint)}

/* ============================================================
 ACTIONS
 ============================================================ */
.btn{
 display:inline-flex;align-items:center;justify-content:center;gap:8px;
 height:36px;padding:0 14px;border-radius:var(--r-sm);border:1px solid transparent;
 background:transparent;color:var(--text);font-size:13px;font-weight:500;
 :pointer;transition:var(--t);white-space:nowrap;text-decoration:none;line-height:1;
}
.btn:focus-visible{outline:none;box-shadow:var(--ring);border-color:var(--text)}
.btn-primary{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}
.btn-primary:hover{opacity:.85}
.btn-secondary{border-color:var(--border-strong);background:var(--bg)}
.btn-secondary:hover{background:var(--surface-2)}
.btn-ghost{color:var(--muted)}
.btn-ghost:hover{background:var(--surface-2);color:var(--text)}
.btn-danger{background:var(--danger);color:#fff;border-color:var(--danger)}
.btn-danger:hover{opacity:.88}
.btn-sm{height:30px;padding:0 10px;font-size:12px}
.btn-lg{height:44px;padding:0 20px;font-size:14px}
.btn[disabled],.btn.disabled{opacity:.38;pointer-events:none}
.btn-block{width:100%}
.btn .icon{width:16px;height:16px}

.icon-btn{
 display:inline-grid;place-items:center;width:36px;height:36px;
 border-radius:var(--r-sm);border:1px solid transparent;background:transparent;
 color:var(--text);:pointer;transition:var(--t);position:relative;
}
.icon-btn:hover{background:var(--surface-2)}
.icon-btn:focus-visible{outline:none;box-shadow:var(--ring);border-color:var(--text)}
.icon-btn.bordered{border-color:var(--border-strong)}
.icon-btn.sm{width:28px;height:28px}
.icon-btn.sm .icon{width:15px;height:15px}
.icon-btn .dot{
 position:absolute;top:7px;right:8px;width:6px;height:6px;border-radius:50%;
 background:var(--danger);border:1.5px solid var(--bg);
}

.fab{
 width:52px;height:52px;border-radius:var(--r-full);background:var(--accent);
 color:var(--on-accent);border:0;display:inline-grid;place-items:center;
 :pointer;box-shadow:var(--shadow);transition:var(--t);
}
.fab:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg)}
.fab.sm{width:42px;height:42px}

.btn-split{display:inline-flex;align-items:stretch;border-radius:var(--r-sm);overflow:hidden;
 border:1px solid var(--accent);background:var(--accent)}
.btn-split .btn{border-radius:0;border:0;background:transparent;color:var(--on-accent)}
.btn-split .btn:hover{background:rgba(255,255,255,.12)}
.btn-split .divider-v{width:1px;background:rgba(255,255,255,.25)}
.btn-split.secondary{border-color:var(--border-strong);background:var(--bg)}
.btn-split.secondary .btn{color:var(--text)}
.btn-split.secondary .btn:hover{background:var(--surface-2)}
.btn-split.secondary .divider-v{background:var(--border)}

.btn-group{display:inline-flex;border:1px solid var(--border-strong);border-radius:var(--r-sm);overflow:hidden}
.btn-group .btn{border-radius:0;border:0;height:34px;color:var(--muted)}
.btn-group .btn + .btn{border-left:1px solid var(--border)}
.btn-group .btn:hover{background:var(--surface-2);color:var(--text)}
.btn-group .btn.active{background:var(--accent);color:var(--on-accent)}

/* ============================================================
 CONTENT DISPLAY
 ============================================================ */
.card{
 border:1px solid var(--border);border-radius:var(--r);background:var(--bg);
 overflow:hidden;transition:var(--t);
}
.card-hover:hover{border-color:var(--border-strong);box-shadow:var(--shadow)}
.card-body{padding:18px}
.card-title{font-size:14px;font-weight:600;letter-spacing:-.01em;margin-bottom:4px}
.card-text{font-size:12.5px;color:var(--muted)}
.card-footer{
 padding:12px 18px;border-top:1px solid var(--border);display:flex;
 align-items:center;justify-content:space-between;gap:10px;background:var(--surface);
}

.list{list-style:none;margin:0;padding:0;border:1px solid var(--border);border-radius:var(--r);overflow:hidden}
.list li{
 display:flex;align-items:center;gap:12px;padding:12px 16px;font-size:13px;
 border-bottom:1px solid var(--border);background:var(--bg);transition:var(--t);
}
.list li:last-child{border-bottom:0}
.list li:hover{background:var(--surface)}
.list .li-main{font-weight:500}
.list .li-sub{font-size:11.5px;color:var(--muted)}
.list .li-end{margin-left:auto;color:var(--faint);font-size:12px}

.table-wrap{border:1px solid var(--border);border-radius:var(--r);overflow:auto;background:var(--bg)}
table.tbl{width:100%;border-collapse:collapse;font-size:12.5px}
table.tbl th{
 text-align:left;font-weight:500;font-size:11px;letter-spacing:.06em;
 text-transform:uppercase;color:var(--faint);padding:11px 16px;
 border-bottom:1px solid var(--border);background:var(--surface);white-space:nowrap;
}
table.tbl td{padding:12px 16px;border-bottom:1px solid var(--border);color:var(--text)}
table.tbl tr:last-child td{border-bottom:0}
table.tbl tbody tr:hover td{background:var(--surface)}
table.tbl th.sortable{:pointer;user-select:none}
table.tbl th.sortable:hover{color:var(--text)}
table.tbl th .sort-ind{opacity:.4;margin-left:4px}

.accordion{border:1px solid var(--border);border-radius:var(--r);overflow:hidden;background:var(--bg)}
.acc-item{border-bottom:1px solid var(--border)}
.acc-item:last-child{border-bottom:0}
.acc-item summary{
 display:flex;align-items:center;justify-content:space-between;gap:12px;
 padding:14px 16px;font-size:13px;font-weight:500;:pointer;
 list-style:none;transition:var(--t);
}
.acc-item summary::-webkit-details-marker{display:none}
.acc-item summary:hover{background:var(--surface)}
.acc-item summary::after{
 content: "";width:7px;height:7px;flex:none;
 border-right:1.5px solid var(--muted);border-bottom:1.5px solid var(--muted);
 transform:rotate(45deg);transition:transform var(--t);margin-top:-4px;
}
.acc-item[open] summary::after{transform:rotate(-135deg);margin-top:2px}
.acc-body{padding:0 16px 16px;font-size:12.5px;color:var(--muted)}

.tip{position:relative;display:inline-flex}
.tip::after{
 content:attr(data-tip);position:absolute;bottom:calc(100% + 9px);left:50%;
 transform:translateX(-50%) translateY(4px);
 background:var(--text);color:var(--bg);font-size:11px;font-weight:500;
 padding:5px 9px;border-radius:var(--r-xs);white-space:nowrap;
 opacity:0;pointer-events:none;transition:var(--t);z-index:90;
}
.tip:hover::after{opacity:1;transform:translateX(-50%)}
.tip.below::after{bottom:auto;top:calc(100% + 9px)}

.badge{
 display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 8px;
 border-radius:var(--r-full);font-size:11px;font-weight:500;
 background:var(--surface-2);color:var(--muted);
}
.badge-solid{background:var(--accent);color:var(--on-accent)}
.badge-success{background:var(--success-bg);color:var(--success)}
.badge-warn{background:var(--warn-bg);color:var(--warn)}
.badge-danger{background:var(--danger-bg);color:var(--danger)}
.badge-info{background:var(--info-bg);color:var(--info)}
.badge-outline{background:transparent;border:1px solid var(--border-strong)}
.badge-dot{width:6px;height:6px;border-radius:50%;background:currentColor}

.avatar{
 width:36px;height:36px;border-radius:50%;background:var(--surface-2);
 color:var(--muted);display:inline-grid;place-items:center;
 font-size:12px;font-weight:600;flex:none;overflow:hidden;
 border:1px solid var(--border);letter-spacing:.02em;
}
.avatar-sm{width:26px;height:26px;font-size:10px}
.avatar-lg{width:48px;height:48px;font-size:15px}
.avatar-xl{width:72px;height:72px;font-size:22px}
.avatar-group{display:flex}
.avatar-group .avatar{margin-left:-9px;border:2px solid var(--bg)}
.avatar-group .avatar:first-child{margin-left:0}

.chip{
 display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;
 border:1px solid var(--border-strong);border-radius:var(--r-full);
 font-size:12px;color:var(--text);background:var(--bg);transition:var(--t);
}
.chip:hover{background:var(--surface-2)}
.chip .x{:pointer;color:var(--faint);display:grid;place-items:center}
.chip .x:hover{color:var(--text)}
.chip.active{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}

.progress{height:5px;border-radius:var(--r-full);background:var(--surface-2);overflow:hidden;width:100%}
.progress > i{display:block;height:100%;background:var(--accent);border-radius:inherit;transition:width .3s ease}
.progress.thin{height:3px}
.progress.thick{height:8px}
.progress.success > i{background:var(--success)}
.progress.warn > i{background:var(--warn)}

.skeleton{
 background:linear-gradient(90deg,var(--surface-2) 25%,var(--border) 37%,var(--surface-2) 63%);
 background-size:400% 100%;animation:shimmer 1.4s ease infinite;border-radius:var(--r-xs);
}
@keyframes shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
.sk-line{height:10px;margin-bottom:8px}
.sk-title{height:14px;width:45%;margin-bottom:12px}
.sk-avatar{width:36px;height:36px;border-radius:50%}
.sk-img{width:100%;height:120px;border-radius:var(--r-sm)}
.sk-btn{width:90px;height:32px;border-radius:var(--r-sm)}

/* ============================================================
 FEEDBACK
 ============================================================ */
.alert{
 display:flex;gap:12px;padding:14px 16px;border-radius:var(--r);
 border:1px solid var(--border);background:var(--surface);font-size:13px;
}
.alert .icon{margin-top:1px}
.alert-title{font-weight:600;font-size:12.5px;margin-bottom:2px}
.alert-text{font-size:12.5px;color:var(--muted)}
.alert-success{background:var(--success-bg);border-color:transparent;color:var(--success)}
.alert-success .alert-text{color:inherit;opacity:.85}
.alert-warn{background:var(--warn-bg);border-color:transparent;color:var(--warn)}
.alert-warn .alert-text{color:inherit;opacity:.85}
.alert-danger{background:var(--danger-bg);border-color:transparent;color:var(--danger)}
.alert-danger .alert-text{color:inherit;opacity:.85}
.alert-info{background:var(--info-bg);border-color:transparent;color:var(--info)}
.alert-info .alert-text{color:inherit;opacity:.85}
.alert .close{margin-left:auto;background:none;border:0;color:inherit;opacity:.5;
 :pointer;padding:0;line-height:0}
.alert .close:hover{opacity:1}

.toasts{
 position:fixed;right:20px;bottom:20px;z-index:300;display:flex;
 flex-direction:column;gap:10px;width:min(340px,calc(100vw - 40px));
}
.toast{
 display:flex;gap:11px;align-items:flex-start;padding:13px 14px;
 background:var(--bg);border:1px solid var(--border);border-radius:var(--r);
 box-shadow:var(--shadow);font-size:12.5px;animation:toastIn .22s ease;
}
.toast.out{animation:toastOut .2s ease forwards}
@keyframes toastIn{from{opacity:0;transform:translateY(10px) scale(.98)}}
@keyframes toastOut{to{opacity:0;transform:translateX(20px)}}
.toast .icon{margin-top:1px}
.toast strong{display:block;font-size:12.5px;font-weight:600;margin-bottom:1px}
.toast p{color:var(--muted);font-size:12px}
.toast .close{margin-left:auto;background:none;border:0;color:var(--faint);:pointer;padding:0;line-height:0}
.toast .close:hover{color:var(--text)}

.overlay{
 position:fixed;inset:0;z-index:200;display:grid;place-items:center;padding:20px;
 background:rgba(0,0,0,.42);backdrop-filter:blur(3px);
 opacity:0;visibility:hidden;transition:var(--t);
}
.overlay.open{opacity:1;visibility:visible}
.modal{
 width:100%;max-width:440px;background:var(--bg);border:1px solid var(--border);
 border-radius:var(--r-lg);box-shadow:var(--shadow-lg);overflow:hidden;
 transform:translateY(10px) scale(.98);transition:var(--t);
}
.overlay.open .modal{transform:none}
.modal-head{padding:20px 22px 0}
.modal-head h3{font-size:15px;font-weight:600;letter-spacing:-.01em}
.modal-head p{font-size:12.5px;color:var(--muted);margin-top:6px}
.modal-body{padding:16px 22px;font-size:13px;color:var(--muted)}
.modal-foot{
 padding:14px 22px;display:flex;justify-content:flex-end;gap:8px;
 border-top:1px solid var(--border);background:var(--surface);
}
.modal-icon{
 width:40px;height:40px;border-radius:var(--r-full);display:grid;place-items:center;
 background:var(--surface-2);margin-bottom:14px;
}
.modal-icon.danger{background:var(--danger-bg);color:var(--danger)}

.spinner{
 width:18px;height:18px;border-radius:50%;flex:none;
 border:1.5px solid var(--border-strong);border-top-color:var(--text);
 animation:spin .7s linear infinite;
}
.spinner.lg{width:28px;height:28px;border-width:2px}
.spinner.sm{width:13px;height:13px;border-width:1.5px}
@keyframes spin{to{transform:rotate(360deg)}}
.spinner-btn{display:inline-flex;align-items:center;gap:9px;font-size:12.5px;color:var(--muted)}

.empty{
 text-align:center;padding:44px 24px;border:1px dashed var(--border-strong);
 border-radius:var(--r);background:var(--surface);
}
.empty .glyph{
 width:44px;height:44px;border-radius:var(--r);background:var(--surface-2);
 display:grid;place-items:center;margin:0 auto 14px;color:var(--faint);
}
.empty h4{font-size:14px;font-weight:600;margin-bottom:5px}
.empty p{font-size:12.5px;color:var(--muted);max-width:34ch;margin:0 auto 16px}

.state-error{
 padding:20px;border:1px solid var(--danger);border-radius:var(--r);
 background:var(--danger-bg);display:flex;gap:14px;align-items:flex-start;
}
.state-error .icon{color:var(--danger);margin-top:2px}
.state-error h4{font-size:13px;font-weight:600;color:var(--danger);margin-bottom:3px}
.state-error p{font-size:12.5px;color:var(--danger);opacity:.85;margin-bottom:10px}

.state-success{
 padding:20px;border-radius:var(--r);background:var(--success-bg);
 display:flex;gap:14px;align-items:flex-start;
}
.state-success .icon{color:var(--success);margin-top:2px}
.state-success h4{font-size:13px;font-weight:600;color:var(--success);margin-bottom:3px}
.state-success p{font-size:12.5px;color:var(--success);opacity:.85}

/* ============================================================
 LAYOUT
 ============================================================ */
.container{
 width:100%;max-width:640px;margin:0 auto;padding:18px;
 border:1px dashed var(--border-strong);border-radius:var(--r);
 font-size:12px;color:var(--faint);text-align:center;
}
.grid{display:grid;gap:12px}
.grid-2{grid-template-columns:repeat(2,1fr)}
.grid-3{grid-template-columns:repeat(3,1fr)}
.grid-4{grid-template-columns:repeat(4,1fr)}
.grid-auto{grid-template-columns:repeat(auto-fit,minmax(120px,1fr))}
.grid > div{
 background:var(--surface-2);border-radius:var(--r-sm);padding:16px 10px;
 text-align:center;font-size:11.5px;color:var(--muted);
 border:1px solid var(--border);
}
.stack{display:flex;flex-direction:column;gap:12px}
.hstack{display:flex;align-items:center;gap:12px}
.hstack-between{display:flex;align-items:center;justify-content:space-between;gap:12px}
.divider{border:0;height:1px;background:var(--border);margin:0;width:100%}
.divider-v{width:1px;background:var(--border);align-self:stretch}
.divider-label{display:flex;align-items:center;gap:12px;color:var(--faint);font-size:11px}
.divider-label::before,.divider-label::after{content: "";flex:1;height:1px;background:var(--border)}

.drawer{
 position:fixed;top:0;right:0;bottom:0;width:min(360px,92vw);z-index:220;
 background:var(--bg);border-left:1px solid var(--border);
 transform:translateX(100%);transition:transform .26s cubic-bezier(.4,0,.2,1);
 display:flex;flex-direction:column;
}
.drawer.open{transform:none}
.drawer-head{
 display:flex;align-items:center;justify-content:space-between;
 padding:16px 18px;border-bottom:1px solid var(--border);
}
.drawer-head h3{font-size:14px;font-weight:600}
.drawer-body{padding:18px;flex:1;overflow-y:auto}
.drawer-foot{padding:14px 18px;border-top:1px solid var(--border);display:flex;gap:8px}

.sheet{
 position:fixed;left:0;right:0;bottom:0;z-index:220;background:var(--bg);
 border-top:1px solid var(--border);border-radius:var(--r-lg) var(--r-lg) 0 0;
 transform:translateY(100%);transition:transform .26s cubic-bezier(.4,0,.2,1);
 padding:10px 20px 26px;max-height:80vh;overflow-y:auto;
}
.sheet.open{transform:none}
.sheet-handle{width:36px;height:4px;border-radius:var(--r-full);background:var(--border-strong);margin:6px auto 16px}

.scrim{
 position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:210;
 opacity:0;visibility:hidden;transition:var(--t);backdrop-filter:blur(2px);
}
.scrim.open{opacity:1;visibility:visible}

/* ============================================================
 MEDIA
 ============================================================ */
.ph{
 background-color:var(--surface-2);
 background-image:repeating-linear-gradient(45deg,transparent 0 9px,rgba(128,128,128,.09) 9px 18px);
 display:grid;place-items:center;color:var(--faint);
}
.gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.gallery .ph{aspect-ratio:1;border-radius:var(--r-sm);:pointer;transition:var(--t);overflow:hidden}
.gallery .ph:hover{transform:scale(1.02);color:var(--muted)}
.gallery .ph:first-child{grid-column:span 2;grid-row:span 2;aspect-ratio:auto}

.carousel{position:relative;overflow:hidden;border-radius:var(--r);border:1px solid var(--border)}
.carousel-track{display:flex;transition:transform .38s cubic-bezier(.4,0,.2,1)}
.carousel-slide{min-width:100%;aspect-ratio:16/7;display:grid;place-items:center;color:var(--faint)}
.carousel-nav{
 position:absolute;top:50%;transform:translateY(-50%);
 width:34px;height:34px;border-radius:50%;border:1px solid var(--border);
 background:var(--bg);color:var(--text);display:grid;place-items:center;
 :pointer;transition:var(--t);box-shadow:var(--shadow-sm);
}
.carousel-nav:hover{background:var(--surface-2)}
.carousel-nav.prev{left:12px}
.carousel-nav.next{right:12px}
.carousel-dots{display:flex;gap:6px;justify-content:center;padding:12px 0 0}
.carousel-dots button{
 width:6px;height:6px;border-radius:50%;background:var(--border-strong);
 border:0;padding:0;:pointer;transition:var(--t);
}
.carousel-dots button.active{background:var(--text);width:18px;border-radius:var(--r-full)}

.player{
 border:1px solid var(--border);border-radius:var(--r);overflow:hidden;background:var(--bg);
}
.player-stage{position:relative;aspect-ratio:16/9;display:grid;place-items:center}
.player-stage .play-big{
 width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.9);
 border:0;display:grid;place-items:center;:pointer;color:#111;
 transition:var(--t);backdrop-filter:blur(6px);
}
.player-stage .play-big:hover{transform:scale(1.06)}
.player-controls{
 display:flex;align-items:center;gap:12px;padding:10px 14px;
 border-top:1px solid var(--border);background:var(--bg);
}
.player-controls .time{font-size:11px;color:var(--faint);font-family:var(--mono);white-space:nowrap}
.track{flex:1;height:3px;border-radius:var(--r-full);background:var(--surface-2);:pointer;position:relative}
.track > i{display:block;height:100%;background:var(--text);border-radius:inherit;position:relative;transition:width .2s linear}
.track > i::after{
 content: "";position:absolute;right:-4px;top:50%;transform:translateY(-50%);
 width:9px;height:9px;border-radius:50%;background:var(--text);opacity:0;transition:var(--t);
}
.track:hover > i::after{opacity:1}

.audio{
 display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--border);
 border-radius:var(--r);background:var(--bg);max-width:460px;
}
.audio .art{
 width:46px;height:46px;border-radius:var(--r-sm);flex:none;
}
.wave{display:flex;align-items:center;gap:2px;height:26px;flex:1}
.wave i{flex:1;background:var(--border-strong);border-radius:1px;min-height:3px}
.wave i.on{background:var(--text)}

.lightbox{
 position:fixed;inset:0;z-index:250;background:rgba(8,8,8,.94);
 display:grid;place-items:center;padding:40px;
 opacity:0;visibility:hidden;transition:var(--t);
}
.lightbox.open{opacity:1;visibility:visible}
.lightbox .lb-content{
 width:min(720px,100%);aspect-ratio:4/3;border-radius:var(--r);
 background:var(--surface-2);
 background-image:repeating-linear-gradient(45deg,transparent 0 14px,rgba(128,128,128,.12) 14px 28px);
 display:grid;place-items:center;color:var(--faint);
}
.lightbox .lb-close{
 position:absolute;top:22px;right:22px;width:38px;height:38px;border-radius:50%;
 background:rgba(255,255,255,.1);border:0;color:#fff;display:grid;place-items:center;
 :pointer;transition:var(--t);
}
.lightbox .lb-close:hover{background:rgba(255,255,255,.2)}

/* ============================================================
 COMMERCE
 ============================================================ */
.product{
 border:1px solid var(--border);border-radius:var(--r);overflow:hidden;
 background:var(--bg);transition:var(--t);max-width:250px;
}
.product:hover{border-color:var(--border-strong);box-shadow:var(--shadow)}
.product .thumb{aspect-ratio:4/3;position:relative}
.product .thumb .fav{
 position:absolute;top:10px;right:10px;width:30px;height:30px;border-radius:50%;
 background:var(--bg);border:1px solid var(--border);display:grid;place-items:center;
 :pointer;color:var(--muted);transition:var(--t);
}
.product .thumb .fav:hover{color:var(--danger)}
.product .info{padding:14px}
.product .name{font-size:13px;font-weight:500;margin-bottom:2px}
.product .cat{font-size:11.5px;color:var(--faint);margin-bottom:10px}
.product .buy{display:flex;align-items:center;justify-content:space-between;gap:10px}

.price{display:flex;align-items:baseline;gap:7px}
.price .now{font-size:15px;font-weight:600;letter-spacing:-.02em}
.price .was{font-size:12px;color:var(--faint);text-decoration:line-through}
.price .off{font-size:10.5px;font-weight:600;color:var(--success);background:var(--success-bg);
 padding:1px 6px;border-radius:var(--r-full)}

.cart{border:1px solid var(--border);border-radius:var(--r);background:var(--bg);overflow:hidden;max-width:400px}
.cart-head{padding:14px 16px;border-bottom:1px solid var(--border);display:flex;
 align-items:center;justify-content:space-between;font-size:13px;font-weight:600}
.cart-item{display:flex;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border)}
.cart-item .thumb{width:52px;height:52px;border-radius:var(--r-sm);flex:none}
.cart-item .meta{flex:1;min-width:0}
.cart-item .meta .n{font-size:12.5px;font-weight:500}
.cart-item .meta .v{font-size:11.5px;color:var(--faint)}
.cart-foot{padding:14px 16px;background:var(--surface)}
.cart-row{display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted);margin-bottom:6px}
.cart-row.total{font-size:14px;font-weight:600;color:var(--text);margin:10px 0 14px}

.qty{display:inline-flex;align-items:center;border:1px solid var(--border-strong);border-radius:var(--r-sm);overflow:hidden}
.qty button{
 width:28px;height:28px;border:0;background:none;color:var(--muted);
 :pointer;display:grid;place-items:center;transition:var(--t);font-size:14px;line-height:1;
}
.qty button:hover{background:var(--surface-2);color:var(--text)}
.qty input{
 width:34px;height:28px;border:0;border-left:1px solid var(--border);border-right:1px solid var(--border);
 background:none;text-align:center;font-family:inherit;font-size:12.5px;color:var(--text);
 -moz-appearance:textfield;
}
.qty input::-webkit-outer-spin-button,.qty input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.qty input:focus{outline:none;background:var(--surface-2)}

.rating{display:inline-flex;align-items:center;gap:2px}
.rating .icon{width:14px;height:14px;stroke:none}
.rating .star-on{fill:var(--text);color:var(--text)}
.rating .star-off{fill:var(--border-strong);color:var(--border-strong)}
.review{display:flex;gap:12px;padding:16px 0;border-bottom:1px solid var(--border)}
.review:last-child{border-bottom:0}
.review .r-head{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.review .r-name{font-size:12.5px;font-weight:600}
.review .r-date{font-size:11px;color:var(--faint)}
.review p{font-size:12.5px;color:var(--muted);margin-top:6px}

/* ============================================================
 SPECIALIZED
 ============================================================ */
.calendar{border:1px solid var(--border);border-radius:var(--r);background:var(--bg);
 padding:16px;max-width:300px;width:100%}
.cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.cal-head .m{font-size:13px;font-weight:600}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.cal-grid .dow{font-size:10px;color:var(--faint);text-align:center;padding:4px 0;
 text-transform:uppercase;letter-spacing:.06em}
.cal-grid .day{
 aspect-ratio:1;display:grid;place-items:center;font-size:12px;border-radius:var(--r-xs);
 color:var(--muted);:pointer;transition:var(--t);border:0;background:none;
}
.cal-grid .day:hover{background:var(--surface-2);color:var(--text)}
.cal-grid .day.mute{color:var(--faint);opacity:.4}
.cal-grid .day.today{color:var(--text);font-weight:600;box-shadow:inset 0 0 0 1px var(--border-strong)}
.cal-grid .day.sel{background:var(--accent);color:var(--on-accent);font-weight:500}

.chat{
 border:1px solid var(--border);border-radius:var(--r);background:var(--bg);
 display:flex;flex-direction:column;height:400px;max-width:400px;overflow:hidden;
}
.chat-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--border)}
.chat-head .n{font-size:13px;font-weight:600}
.chat-head .s{font-size:11px;color:var(--success);display:flex;align-items:center;gap:5px}
.chat-head .s::before{content: "";width:6px;height:6px;border-radius:50%;background:var(--success)}
.chat-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
.bubble{max-width:78%;padding:9px 13px;border-radius:var(--r-lg);font-size:12.5px;line-height:1.5}
.bubble.them{background:var(--surface-2);color:var(--text);border-bottom-left-radius:var(--r-xs);align-self:flex-start}
.bubble.me{background:var(--accent);color:var(--on-accent);border-bottom-right-radius:var(--r-xs);align-self:flex-end}
.bubble .t{display:block;font-size:10px;opacity:.55;margin-top:4px}
.chat-input{display:flex;gap:8px;padding:12px;border-top:1px solid var(--border);align-items:center}
.chat-input .input{height:34px}

.map{
 position:relative;height:260px;border:1px solid var(--border);border-radius:var(--r);
 overflow:hidden;background:var(--surface);
 background-image:
 linear-gradient(var(--border) 1px, transparent 1px),
 linear-gradient(90deg, var(--border) 1px, transparent 1px);
 background-size:40px 40px;
}
.map .road{position:absolute;background:var(--border-strong)}
.map .road.h{height:6px;left:0;right:0}
.map .road.v{width:6px;top:0;bottom:0}
.map .pin{
 position:absolute;left:50%;top:46%;transform:translate(-50%,-100%);
 width:26px;height:26px;border-radius:50% 50% 50% 0;background:var(--text);
 rotate:-45deg;display:grid;place-items:center;box-shadow:var(--shadow);
}
.map .pin::after{content: "";width:9px;height:9px;border-radius:50%;background:var(--bg);rotate:45deg}
.map .map-ui{
 position:absolute;bottom:12px;right:12px;display:flex;flex-direction:column;
 border:1px solid var(--border);border-radius:var(--r-sm);overflow:hidden;background:var(--bg);
}
.map .map-ui button{width:30px;height:30px;border:0;background:var(--bg);color:var(--text);
 :pointer;font-size:14px;border-bottom:1px solid var(--border)}
.map .map-ui button:last-child{border-bottom:0}
.map .map-ui button:hover{background:var(--surface-2)}

.code{
 border:1px solid var(--border);border-radius:var(--r);overflow:hidden;background:var(--bg);
}
.code-head{
 display:flex;align-items:center;gap:8px;padding:9px 14px;
 border-bottom:1px solid var(--border);background:var(--surface);
}
.code-head .dots{display:flex;gap:5px}
.code-head .dots i{width:9px;height:9px;border-radius:50%;background:var(--border-strong);display:block}
.code-head .fname{font-size:11.5px;color:var(--muted);font-family:var(--mono);margin-left:6px}
.code pre{
 margin:0;padding:14px 0;overflow-x:auto;font-family:var(--mono);
 font-size:12px;line-height:1.7;
}
.code .line{display:flex;padding:0 14px}
.code .ln{width:24px;text-align:right;color:var(--faint);user-select:none;
 margin-right:16px;flex:none;font-size:11px}
.tok-k{color:var(--info)}
.tok-s{color:var(--success)}
.tok-c{color:var(--faint);font-style:italic}
.tok-f{color:var(--warn)}
.tok-n{color:var(--danger)}

.rte{border:1px solid var(--border);border-radius:var(--r);overflow:hidden;background:var(--bg)}
.rte-bar{display:flex;align-items:center;gap:2px;padding:6px 8px;border-bottom:1px solid var(--border);
 background:var(--surface);flex-wrap:wrap}
.rte-bar .icon-btn.sm{color:var(--muted)}
.rte-bar .icon-btn.sm.active{background:var(--surface-2);color:var(--text)}
.rte-area{padding:16px;min-height:130px;font-size:13px;line-height:1.65;outline:none}
.rte-area:focus{background:var(--bg)}
.rte-area h4{font-size:14px;margin-bottom:6px}
.rte-area p{color:var(--muted);margin-bottom:10px}
.rte-area ul{margin:0 0 10px;padding-left:20px;color:var(--muted)}

.chart-card{border:1px solid var(--border);border-radius:var(--r);padding:18px;background:var(--bg)}
.chart-head{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px}
.chart-head .v{font-size:22px;font-weight:600;letter-spacing:-.03em}
.chart-head .k{font-size:11.5px;color:var(--muted)}
.bars{display:flex;align-items:flex-end;gap:6px;height:110px}
.bars i{flex:1;background:var(--text);border-radius:2px 2px 0 0;opacity:.85;transition:var(--t)}
.bars i:hover{opacity:1}
.bars i.dim{opacity:.18}
.donut{
 width:110px;height:110px;border-radius:50%;position:relative;flex:none;
 background:conic-gradient(var(--text) 0 46%, var(--border-strong) 46% 74%, var(--faint) 74% 100%);
}
.donut::after{
 content: "";position:absolute;inset:16px;border-radius:50%;background:var(--bg);
 display:grid;place-items:center;
}
.donut-center{
 position:absolute;inset:0;display:grid;place-items:center;z-index:1;
 font-size:16px;font-weight:600;letter-spacing:-.02em;
}

.timeline{position:relative;padding-left:26px}
.timeline::before{content: "";position:absolute;left:5px;top:6px;bottom:6px;width:1px;background:var(--border)}
.tl-item{position:relative;padding-bottom:22px}
.tl-item:last-child{padding-bottom:0}
.tl-item::before{
 content: "";position:absolute;left:-26px;top:5px;width:11px;height:11px;border-radius:50%;
 background:var(--bg);border:1.5px solid var(--border-strong);
}
.tl-item.done::before{background:var(--accent);border-color:var(--accent)}
.tl-item.current::before{background:var(--bg);border-color:var(--accent);box-shadow:0 0 0 3px var(--surface-2)}
.tl-time{font-size:11px;color:var(--faint);font-family:var(--mono)}
.tl-title{font-size:13px;font-weight:500;margin:2px 0 2px}
.tl-text{font-size:12.5px;color:var(--muted)}

.stepper{display:flex;align-items:center;gap:0;flex-wrap:wrap}
.step{display:flex;align-items:center;gap:10px}
.step .num{
 width:26px;height:26px;border-radius:50%;display:grid;place-items:center;
 font-size:11.5px;font-weight:600;border:1px solid var(--border-strong);
 color:var(--muted);background:var(--bg);flex:none;transition:var(--t);
}
.step.active .num{background:var(--accent);color:var(--on-accent);border-color:var(--accent)}
.step.done .num{background:var(--surface-2);color:var(--text);border-color:var(--border-strong)}
.step .lbl{font-size:12.5px;color:var(--muted);white-space:nowrap}
.step.active .lbl{color:var(--text);font-weight:500}
.step-line{flex:1;height:1px;background:var(--border);min-width:24px;margin:0 12px}
.step-panel{padding:20px 0 0;font-size:13px;color:var(--muted)}

.cookie{
 display:flex;align-items:center;gap:16px;padding:16px 20px;
 border:1px solid var(--border);border-radius:var(--r);background:var(--bg);
 box-shadow:var(--shadow);flex-wrap:wrap;
}
.cookie .txt{flex:1;min-width:240px}
.cookie .txt strong{font-size:13px;display:block;margin-bottom:3px}
.cookie .txt p{font-size:12px;color:var(--muted)}
.cookie .acts{display:flex;gap:8px}

/* ============================================================
 RESPONSIVE
 ============================================================ */
@media (max-width:1000px){
 .docnav{transform:translateX(-100%);transition:transform .24s ease}
 .docnav.open{transform:none;box-shadow:var(--shadow-lg)}
 .docmain{margin-left:0;padding:28px 24px 120px}
 .nav-toggle{display:inline-grid !important}
}
@media (max-width:720px){
 .grid-3,.grid-4{grid-template-columns:repeat(2,1fr)}
 .gallery{grid-template-columns:repeat(2,1fr)}
 .gallery .ph:first-child{grid-column:span 2;grid-row:auto}
 .doc-head h1{font-size:24px}
}
.nav-toggle{display:none;position:fixed;top:14px;left:14px;z-index:70}
</style>
</head>
<body>

<!-- ============================================================
 ICON SPRITE
 ============================================================ -->
<svg style="display:none" aria-hidden="true">
 <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></symbol>
 <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
 <symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>
 <symbol id="i-chev-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
 <symbol id="i-chev-right" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></symbol>
 <symbol id="i-chev-left" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></symbol>
 <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></symbol>
 <symbol id="i-check" viewBox="0 0 24 24"><path d="m20 6-11 11-5-5"/></symbol>
 <symbol id="i-menu" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></symbol>
 <symbol id="i-bell" viewBox="0 0 24 24"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></symbol>
 <symbol id="i-user" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></symbol>
 <symbol id="i-home" viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></symbol>
 <symbol id="i-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 11 4.6a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 19.4 11a2 2 0 1 1 0 4z"/></symbol>
 <symbol id="i-heart" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></symbol>
 <symbol id="i-star" viewBox="0 0 24 24"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></symbol>
 <symbol id="i-trash" viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></symbol>
 <symbol id="i-edit" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></symbol>
 <symbol id="i-more" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></symbol>
 <symbol id="i-upload" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></symbol>
 <symbol id="i-play" viewBox="0 0 24 24"><path d="M6 3.5 20 12 6 20.5z" fill="currentColor" stroke="none"/></symbol>
 <symbol id="i-pause" viewBox="0 0 24 24"><path d="M8 4h3v16H8zM13 4h3v16h-3z" fill="currentColor" stroke="none"/></symbol>
 <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></symbol>
 <symbol id="i-moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></symbol>
 <symbol id="i-cart" viewBox="0 0 24 24"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/></symbol>
 <symbol id="i-filter" viewBox="0 0 24 24"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></symbol>
 <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></symbol>
 <symbol id="i-warn" viewBox="0 0 24 24"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></symbol>
 <symbol id="i-error" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></symbol>
 <symbol id="i-check-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></symbol>
 <symbol id="i-image" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></symbol>
 <symbol id="i-mail" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></symbol>
 <symbol id="i-lock" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></symbol>
 <symbol id="i-eye" viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></symbol>
 <symbol id="i-send" viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></symbol>
 <symbol id="i-paperclip" viewBox="0 0 24 24"><path d="M21.4 11.05 12.25 20.2a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.65 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.83l8.49-8.48"/></symbol>
 <symbol id="i-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></symbol>
 <symbol id="i-list" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></symbol>
 <symbol id="i-bold" viewBox="0 0 24 24"><path d="M6 4h7a4 4 0 0 1 0 8H6zM6 12h8a4 4 0 0 1 0 8H6z"/></symbol>
 <symbol id="i-italic" viewBox="0 0 24 24"><path d="M19 4h-9M14 20H5M15 4 9 20"/></symbol>
 <symbol id="i-underline" viewBox="0 0 24 24"><path d="M6 3v7a6 6 0 0 0 12 0V3M4 21h16"/></symbol>
 <symbol id="i-link" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></symbol>
 <symbol id="i-volume" viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></symbol>
 <symbol id="i-expand" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></symbol>
</svg>

<!-- ============================================================
 DOC NAV
 ============================================================ -->
<button class="icon-btn nav-toggle" id="navToggle" style="background:var(--bg);border:1px solid var(--border)">
 <svg class="icon"><use href="#i-menu"/></svg>
</button>

<aside class="docnav" id="docnav">
 <div class="brand">
 <span class="brand-mark"></span>
 <span><strong>Minimal</strong> <span>UI Kit</span></span>
 </div>
 <nav>
 <a href="#navigation">Navigation</a>
 <a href="#forms">Inputs &amp; Forms</a>
 <a href="#actions">Actions</a>
 <a href="#content">Content Display</a>
 <a href="#feedback">Feedback &amp; Status</a>
 <a href="#layout">Layout</a>
 <a href="#media">Media</a>
 <a href="#commerce">Commerce</a>
 <a href="#specialized">Specialized</a>
 </nav>
 <button class="btn btn-secondary btn-sm" id="themeToggle" style="width:100%;margin-top:18px">
 <svg class="icon"><use href="#i-moon"/></svg><span id="themeLabel">Dark mode</span>
 </button>
</aside>

<!-- ============================================================
 MAIN
 ============================================================ -->
<main class="docmain">

 <div class="doc-head">
 <h1>Minimal UI Kit</h1>
 <p>A monochrome, whitespace-first component library. Every element shares one
 spacing rhythm, one border weight, one radius scale, and a single accent —
 the text color itself.</p>
 <div class="swatches">
 <i style="background:var(--bg)"></i>
 <i style="background:var(--surface-2)"></i>
 <i style="background:var(--border-strong)"></i>
 <i style="background:var(--muted)"></i>
 <i style="background:var(--text)"></i>
 </div>
 </div>

 <!-- ==========================================================
 NAVIGATION
 ========================================================== -->
 <section class="section" id="navigation">
 <h2>Navigation</h2>

 <div class="spec">
 <div class="spec-label">Header</div>
 <div class="spec-body">
 <div class="frame">
 <header class="app-header">
 <div class="hdr-left">
 <button class="icon-btn"><svg class="icon"><use href="#i-menu"/></svg></button>
 <span class="logo-mark"></span>
 <span class="hdr-title">Acme</span>
 </div>
 <div class="hdr-right">
 <button class="icon-btn"><svg class="icon"><use href="#i-search"/></svg></button>
 <button class="icon-btn">
 <svg class="icon"><use href="#i-bell"/></svg><span class="dot"></span>
 </button>
 <div class="avatar avatar-sm">AR</div>
 </div>
 </header>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Navbar</div>
 <div class="spec-body">
 <div class="frame">
 <nav class="navbar">
 <a class="nav-link active" href="#">Overview</a>
 <a class="nav-link" href="#">Projects</a>
 <a class="nav-link" href="#">Reports</a>
 <a class="nav-link" href="#">Team</a>
 <a class="nav-link" href="#">Settings</a>
 </nav>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Sidebar</div>
 <div class="spec-body">
 <div class="frame" style="display:flex;min-height:280px">
 <aside class="sidebar">
 <a class="sb-item active" href="#">
 <svg class="icon icon-sm"><use href="#i-home"/></svg> Dashboard
 </a>
 <a class="sb-item" href="#">
 <svg class="icon icon-sm"><use href="#i-grid"/></svg> Projects
 <span class="sb-badge">12</span>
 </a>
 <a class="sb-item" href="#">
 <svg class="icon icon-sm"><use href="#i-mail"/></svg> Messages
 <span class="sb-badge">3</span>
 </a>
 <div class="sb-group">Workspace</div>
 <a class="sb-item" href="#">
 <svg class="icon icon-sm"><use href="#i-user"/></svg> Members
 </a>
 <a class="sb-item" href="#">
 <svg class="icon icon-sm"><use href="#i-settings"/></svg> Settings
 </a>
 </aside>
 <div style="flex:1;padding:24px;background:var(--bg)">
 <div class="skeleton sk-title"></div>
 <div class="skeleton sk-line" style="width:80%"></div>
 <div class="skeleton sk-line" style="width:65%"></div>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Breadcrumbs</div>
 <div class="spec-body">
 <nav class="breadcrumbs">
 <a href="#">Home</a>
 <span class="sep">/</span>
 <a href="#">Projects</a>
 <span class="sep">/</span>
 <a href="#">Design system</a>
 <span class="sep">/</span>
 <span class="current">Components</span>
 </nav>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Tabs</div>
 <div class="spec-body" data-tabs>
 <div class="tabs">
 <button class="tab active" data-tab="t1">Overview</button>
 <button class="tab" data-tab="t2">Activity</button>
 <button class="tab" data-tab="t3">Members</button>
 <button class="tab" data-tab="t4">Settings</button>
 </div>
 <div class="tabpanel active" data-panel="t1">A calm summary of everything happening in this workspace.</div>
 <div class="tabpanel" data-panel="t2">Recent commits, comments, and status changes appear here.</div>
 <div class="tabpanel" data-panel="t3">Four members have access to this project.</div>
 <div class="tabpanel" data-panel="t4">Rename, archive, or transfer ownership of the project.</div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Pagination</div>
 <div class="spec-body">
 <div class="pagination">
 <button class="page" disabled><svg class="icon icon-sm"><use href="#i-chev-left"/></svg></button>
 <button class="page">1</button>
 <button class="page active">2</button>
 <button class="page">3</button>
 <button class="page">4</button>
 <span class="page" style="pointer-events:none">…</span>
 <button class="page">12</button>
 <button class="page"><svg class="icon icon-sm"><use href="#i-chev-right"/></svg></button>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Menus &amp; Dropdown menus</div>
 <div class="spec-body">
 <div class="row">
 <div class="dropdown">
 <button class="btn btn-secondary" data-menu="menu-1">
 Actions <svg class="icon icon-sm"><use href="#i-chev-down"/></svg>
 </button>
 <div class="menu" id="menu-1">
 <div class="menu-label">File</div>
 <button class="menu-item"><svg class="icon icon-sm"><use href="#i-edit"/></svg> Rename <span class="shortcut">⌘R</span></button>
 <button class="menu-item"><svg class="icon icon-sm"><use href="#i-upload"/></svg> Export <span class="shortcut">⌘E</span></button>
 <button class="menu-item"><svg class="icon icon-sm"><use href="#i-link"/></svg> Copy link</button>
 <div class="menu-sep"></div>
 <button class="menu-item danger"><svg class="icon icon-sm"><use href="#i-trash"/></svg> Delete</button>
 </div>
 </div>

 <div class="dropdown">
 <button class="icon-btn bordered" data-menu="menu-2">
 <svg class="icon"><use href="#i-more"/></svg>
 </button>
 <div class="menu right" id="menu-2" style="min-width:170px">
 <button class="menu-item">Duplicate</button>
 <button class="menu-item">Move to…</button>
 <div class="menu-sep"></div>
 <button class="menu-item danger">Archive</button>
 </div>
 </div>
 </div>
 </div>
 </div>
 </section>

 <!-- ==========================================================
 FORMS
 ========================================================== -->
 <section class="section" id="forms">
 <h2>Inputs &amp; Forms</h2>

 <div class="spec">
 <div class="spec-label">Text field</div>
 <div class="spec-body">
 <div class="row" style="align-items:flex-start;gap:20px">
 <div class="field">
 <label class="label">Full name</label>
 <input class="input" placeholder="Jane Cooper">
 <span class="hint">As it appears on your ID.</span>
 </div>
 <div class="field">
 <label class="label">Email <span class="req">*</span></label>
 <input class="input" type="email" value="jane@acme.co">
 </div>
 <div class="field">
 <label class="label">Disabled</label>
 <input class="input" value="Read only" disabled>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Textarea</div>
 <div class="spec-body">
 <div class="field" style="max-width:420px">
 <label class="label">Description</label>
 <textarea class="textarea" placeholder="Write a short description…"></textarea>
 <span class="hint">0 / 280 characters</span>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Search box</div>
 <div class="spec-body">
 <div class="search">
 <svg class="icon icon-sm"><use href="#i-search"/></svg>
 <input class="input" placeholder="Search components…">
 <kbd>⌘K</kbd>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Checkbox / Radio button</div>
 <div class="spec-body">
 <div class="row" style="gap:36px;align-items:flex-start">
 <div class="col" style="gap:12px">
 <label class="check"><input type="checkbox" checked><span class="box"></span><span class="check-text">Email notifications</span></label>
 <label class="check"><input type="checkbox"><span class="box"></span><span class="check-text">SMS notifications</span></label>
 <label class="check"><input type="checkbox" disabled><span class="box"></span><span class="check-text">Push (unavailable)</span></label>
 </div>
 <div class="col" style="gap:12px">
 <label class="check"><input type="radio" name="r1" checked><span class="box round"></span><span class="check-text">Monthly billing</span></label>
 <label class="check"><input type="radio" name="r1"><span class="box round"></span><span class="check-text">Annual billing</span></label>
 <label class="check"><input type="radio" name="r1" disabled><span class="box round"></span><span class="check-text">Enterprise</span></label>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Toggle / Switch</div>
 <div class="spec-body">
 <div class="col" style="gap:14px">
 <label class="switch-row"><input class="switch" type="checkbox" checked> Public profile</label>
 <label class="switch-row"><input class="switch" type="checkbox"> Two-factor authentication</label>
 <label class="switch-row"><input class="switch" type="checkbox" disabled> Beta features</label>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Select menu</div>
 <div class="spec-body">
 <div class="row" style="align-items:flex-start;gap:20px">
 <div class="field">
 <label class="label">Country</label>
 <div class="select-wrap">
 <select class="select">
 <option>United States</option>
 <option>United Kingdom</option>
 <option>Germany</option>
 <option>Japan</option>
 </select>
 </div>
 </div>
 <div class="field">
 <label class="label">Disabled</label>
 <div class="select-wrap">
 <select class="select" disabled><option>Not available</option></select>
 </div>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Date picker</div>
 <div class="spec-body">
 <div class="row" style="align-items:flex-start;gap:20px">
 <div class="field">
 <label class="label">Start date</label>
 <input class="input" type="date" value="2025-01-14">
 </div>
 <div class="field">
 <label class="label">Date range</label>
 <input class="input" type="date">
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">File upload</div>
 <div class="spec-body">
 <div class="dropzone" style="max-width:440px">
 <svg class="icon"><use href="#i-upload"/></svg>
 <strong>Drop files here or click to browse</strong>
 <span>PNG, JPG, PDF up to 10 MB</span>
 <input type="file" hidden>
 </div>
 <p class="hint" id="fileName" style="margin-top:8px">No file selected</p>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Slider</div>
 <div class="spec-body">
 <div class="col" style="gap:16px;max-width:320px">
 <div>
 <div class="hstack-between" style="margin-bottom:8px">
 <span class="label">Opacity</span>
 <span class="hint mono" id="sliderVal">64%</span>
 </div>
 <input class="range" type="range" min="0" max="100" value="64"
>
 </div>
 <div>
 <div class="hstack-between" style="margin-bottom:8px">
 <span class="label">Radius</span>
 <span class="hint mono">8px</span>
 </div>
 <input class="range" type="range" min="0" max="24" value="8">
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Form validation messages</div>
 <div class="spec-body">
 <div class="row" style="align-items:flex-start;gap:20px">
 <div class="field">
 <label class="label">Email</label>
 <input class="input invalid" value="jane@">
 <span class="msg msg-error">
 <svg class="icon"><use href="#i-error"/></svg>
 Enter a valid email address.
 </span>
 </div>
 <div class="field">
 <label class="label">Username</label>
 <input class="input valid" value="jane.cooper">
 <span class="msg msg-success">
 <svg class="icon"><use href="#i-check-circle"/></svg>
 Username is available.
 </span>
 </div>
 <div class="field">
 <label class="label">Password</label>
 <input class="input" type="password" value="secret">
 <span class="msg msg-hint">
 <svg class="icon"><use href="#i-info"/></svg>
 At least 8 characters, one number.
 </span>
 </div>
 </div>
 </div>
 </div>
 </section>

 <!-- ==========================================================
 ACTIONS
 ========================================================== -->
 <section class="section" id="actions">
 <h2>Actions</h2>

 <div class="spec">
 <div class="spec-label">Button</div>
 <div class="spec-body">
 <div class="row">
 <button class="btn btn-primary">Primary</button>
 <button class="btn btn-secondary">Secondary</button>
 <button class="btn btn-ghost">Ghost</button>
 <button class="btn btn-danger">Danger</button>
 <button class="btn btn-primary" disabled>Disabled</button>
 </div>
 <div class="row" style="margin-top:14px">
 <button class="btn btn-primary btn-sm">Small</button>
 <button class="btn btn-primary">Default</button>
 <button class="btn btn-primary btn-lg">Large</button>
 </div>
 <div class="row" style="margin-top:14px">
 <button class="btn btn-primary"><svg class="icon"><use href="#i-plus"/></svg> New project</button>
 <button class="btn btn-secondary"><svg class="icon"><use href="#i-upload"/></svg> Import</button>
 <button class="btn btn-ghost">Cancel</button>
 </div>
 <div style="margin-top:14px;max-width:320px">
 <button class="btn btn-primary btn-block">Full width button</button>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Icon button</div>
 <div class="spec-body">
 <div class="row">
 <button class="icon-btn"><svg class="icon"><use href="#i-search"/></svg></button>
 <button class="icon-btn bordered"><svg class="icon"><use href="#i-settings"/></svg></button>
 <button class="icon-btn"><svg class="icon"><use href="#i-heart"/></svg></button>
 <button class="icon-btn">
 <svg class="icon"><use href="#i-bell"/></svg><span class="dot"></span>
 </button>
 <button class="icon-btn bordered"><svg class="icon"><use href="#i-more"/></svg></button>
 <button class="icon-btn" disabled style="opacity:.35"><svg class="icon"><use href="#i-trash"/></svg></button>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Floating action button</div>
 <div class="spec-body">
 <div class="row" style="gap:18px">
 <button class="fab"><svg class="icon icon-lg"><use href="#i-plus"/></svg></button>
 <button class="fab sm"><svg class="icon"><use href="#i-edit"/></svg></button>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Split button</div>
 <div class="spec-body">
 <div class="row" style="gap:18px">
 <div class="btn-split">
 <button class="btn">Save</button>
 <span class="divider-v"></span>
 <button class="btn" style="padding:0 10px"><svg class="icon icon-sm"><use href="#i-chev-down"/></svg></button>
 </div>
 <div class="btn-split secondary">
 <button class="btn">Export</button>
 <span class="divider-v"></span>
 <button class="btn" style="padding:0 10px"><svg class="icon icon-sm"><use href="#i-chev-down"/></svg></button>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Button group</div>
 <div class="spec-body">
 <div class="btn-group">
 <button class="btn active">Day</button>
 <button class="btn">Week</button>
 <button class="btn">Month</button>
 <button class="btn">Year</button>
 </div>
 <div class="btn-group" style="margin-left:14px">
 <button class="btn"><svg class="icon icon-sm"><use href="#i-bold"/></svg></button>
 <button class="btn"><svg class="icon icon-sm"><use href="#i-italic"/></svg></button>
 <button class="btn"><svg class="icon icon-sm"><use href="#i-underline"/></svg></button>
 </div>
 </div>
 </div>
 </section>

 <!-- ==========================================================
 CONTENT DISPLAY
 ========================================================== -->
 <section class="section" id="content">
 <h2>Content Display</h2>

 <div class="spec">
 <div class="spec-label">Card</div>
 <div class="spec-body">
 <div class="grid grid-3" style="max-width:760px">
 <div class="card card-hover">
 <div class="ph" style="height:110px"><svg class="icon icon-lg"><use href="#i-image"/></svg></div>
 <div class="card-body">
 <div class="card-title">Design tokens</div>
 <div class="card-text">Spacing, radius, and type scales in one place.</div>
 </div>
 <div class="card-footer">
 <span class="hint">Updated 2h ago</span>
 <button class="btn btn-ghost btn-sm">Open</button>
 </div>
 </div>
 <div class="card card-hover">
 <div class="card-body">
 <div class="card-title">Simple card</div>
 <div class="card-text">A card without media, for plain content blocks.</div>
 </div>
 </div>
 <div class="card card-hover">
 <div class="card-body">
 <div class="hstack-between" style="margin-bottom:12px">
 <div class="avatar">JC</div>
 <span class="badge badge-success"><i class="badge-dot"></i> Active</span>
 </div>
 <div class="card-title">Jane Cooper</div>
 <div class="card-text">Product designer · Berlin</div>
 </div>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">List</div>
 <div class="spec-body">
 <ul class="list" style="max-width:480px">
 <li>
 <div class="avatar avatar-sm">AR</div>
 <div>
 <div class="li-main">Amelia Ray</div>
 <div class="li-sub">amelia@acme.co</div>
 </div>
 <span class="li-end">Owner</span>
 </li>
 <li>
 <div class="avatar avatar-sm">JC</div>
 <div>
 <div class="li-main">Jane Cooper</div>
 <div class="li-sub">jane@acme.co</div>
 </div>
 <span class="li-end">Editor</span>
 </li>
 <li>
 <div class="avatar avatar-sm">MK</div>
 <div>
 <div class="li-main">Marcus Kim</div>
 <div class="li-sub">marcus@acme.co</div>
 </div>
 <span class="li-end">Viewer</span>
 </li>
 </ul>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Table</div>
 <div class="spec-body">
 <div class="table-wrap" style="max-width:680px">
 <table class="tbl">
 <thead>
 <tr><th>Name</th><th>Status</th><th>Role</th><th>Last active</th></tr>
 </thead>
 <tbody>
 <tr><td>Amelia Ray</td><td><span class="badge badge-success">Active</span></td><td>Owner</td><td class="muted">2 min ago</td></tr>
 <tr><td>Jane Cooper</td><td><span class="badge badge-success">Active</span></td><td>Editor</td><td class="muted">1 hour ago</td></tr>
 <tr><td>Marcus Kim</td><td><span class="badge">Invited</span></td><td>Viewer</td><td class="muted">—</td></tr>
 <tr><td>Priya Nair</td><td><span class="badge badge-warn">Pending</span></td><td>Editor</td><td class="muted">3 days ago</td></tr>
 </tbody>
 </table>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Data grid</div>
 <div class="spec-body">
 <div class="table-wrap" style="max-width:720px">
 <table class="tbl" id="dataGrid">
 <thead>
 <tr>
 <th style="width:36px"><input type="checkbox" class="checkbox" style="appearance:none;width:15px;height:15px;border:1px solid var(--border-strong);border-radius:4px;background:var(--bg)"></th>
 <th class="sortable" data-col="0">Project <span class="sort-ind">↕</span></th>
 <th class="sortable" data-col="1">Owner <span class="sort-ind">↕</span></th>
 <th class="sortable" data-col="2">Progress <span class="sort-ind">↕</span></th>
 <th>Status</th>
 <th style="width:40px"></th>
 </tr>
 </thead>
 <tbody>
 <tr><td><input type="checkbox" class="checkbox"></td><td>Atlas</td><td>Amelia Ray</td><td><div class="progress" style="width:80px"><i style="width:72%"></i></div></td><td><span class="badge badge-success">On track</span></td><td><button class="icon-btn sm"><svg class="icon icon-sm"><use href="#i-more"/></svg></button></td></tr>
 <tr><td><input type="checkbox" class="checkbox"></td><td>Beacon</td><td>Jane Cooper</td><td><div class="progress" style="width:80px"><i style="width:40%"></i></div></td><td><span class="badge badge-warn">At risk</span></td><td><button class="icon-btn sm"><svg class="icon icon-sm"><use href="#i-more"/></svg></button></td></tr>
 <tr><td><input type="checkbox" class="checkbox"></td><td>Cobalt</td><td>Marcus Kim</td><td><div class="progress" style="width:80px"><i style="width:95%"></i></div></td><td><span class="badge badge-success">On track</span></td><td><button class="icon-btn sm"><svg class="icon icon-sm"><use href="#i-more"/></svg></button></td></tr>
 <tr><td><input type="checkbox" class="checkbox"></td><td>Delta</td><td>Priya Nair</td><td><div class="progress" style="width:80px"><i style="width:12%"></i></div></td><td><span class="badge badge-danger">Blocked</span></td><td><button class="icon-btn sm"><svg class="icon icon-sm"><use href="#i-more"/></svg></button></td></tr>
 </tbody>
 </table>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Accordion</div>
 <div class="spec-body">
 <div class="accordion" style="max-width:560px">
 <details class="acc-item" open>
 <summary>What is the minimal design system?</summary>
 <div class="acc-body">A restrained set of tokens — one accent, two border weights, a four-step radius scale — that keeps interfaces quiet and legible.</div>
 </details>
 <details class="acc-item">
 <summary>How do I add a new component?</summary>
 <div class="acc-body">Compose existing primitives first. Only introduce a new token when no combination of the current scale works.</div>
 </details>
 <details class="acc-item">
 <summary>Is dark mode supported?</summary>
 <div class="acc-body">Yes — every color is a CSS variable, so themes swap by changing a single attribute on the root element.</div>
 </details>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Tooltip</div>
 <div class="spec-body">
 <div class="row" style="gap:24px">
 <span class="tip" data-tip="Copy to clipboard">
 <button class="icon-btn bordered"><svg class="icon"><use href="#i-link"/></svg></button>
 </span>
 <span class="tip" data-tip="Add to favourites">
 <button class="icon-btn bordered"><svg class="icon"><use href="#i-heart"/></svg></button>
 </span>
 <span class="tip below" data-tip="Tooltip below">
 <button class="btn btn-secondary btn-sm">Hover me</button>
 </span>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Popover</div>
 <div class="spec-body">
 <div class="dropdown">
 <button class="btn btn-secondary" data-pop="pop-1">
 <svg class="icon"><use href="#i-filter"/></svg> Filters
 </button>
 <div class="popover" id="pop-1">
 <div class="label" style="margin-bottom:10px">Status</div>
 <div class="col" style="gap:9px;margin-bottom:16px">
 <label class="check"><input type="checkbox" checked><span class="box"></span><span class="check-text">Active</span></label>
 <label class="check"><input type="checkbox"><span class="box"></span><span class="check-text">Archived</span></label>
 </div>
 <div class="divider" style="margin-bottom:14px"></div>
 <div class="hstack" style="justify-content:flex-end">
 <button class="btn btn-ghost btn-sm" data-close-pop>Reset</button>
 <button class="btn btn-primary btn-sm" data-close-pop>Apply</button>
 </div>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Badge</div>
 <div class="spec-body">
 <div class="row">
 <span class="badge">Default</span>
 <span class="badge badge-solid">Solid</span>
 <span class="badge badge-outline">Outline</span>
 <span class="badge badge-success"><i class="badge-dot"></i> Active</span>
 <span class="badge badge-warn"><i class="badge-dot"></i> Pending</span>
 <span class="badge badge-danger"><i class="badge-dot"></i> Failed</span>
 <span class="badge badge-info"><i class="badge-dot"></i> Info</span>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Avatar</div>
 <div class="spec-body">
 <div class="row" style="gap:14px">
 <div class="avatar avatar-sm">AR</div>
 <div class="avatar">JC</div>
 <div class="avatar avatar-lg">MK</div>
 <div class="avatar avatar-xl">PN</div>
 <div class="avatar-group" style="margin-left:12px">
 <div class="avatar avatar-sm">AR</div>
 <div class="avatar avatar-sm">JC</div>
 <div class="avatar avatar-sm">MK</div>
 <div class="avatar avatar-sm" style="font-size:10px">+7</div>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Tag / Chip</div>
 <div class="spec-body">
 <div class="row">
 <span class="chip active">All</span>
 <span class="chip">Design</span>
 <span class="chip">Engineering</span>
 <span class="chip">
 Research
 <span class="x"><svg class="icon icon-sm"><use href="#i-x"/></svg></span>
 </span>
 <span class="chip">
 <svg class="icon icon-sm"><use href="#i-star"/></svg> Favourites
 </span>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Progress bar</div>
 <div class="spec-body">
 <div class="col" style="gap:18px;max-width:420px">
 <div>
 <div class="hstack-between" style="margin-bottom:7px"><span class="hint">Uploading…</span><span class="hint mono">64%</span></div>
 <div class="progress"><i style="width:64%"></i></div>
 </div>
 <div class="progress thin"><i style="width:32%"></i></div>
 <div class="progress thick success"><i style="width:88%"></i></div>
 <div class="progress warn"><i style="width:45%"></i></div>
 <div class="progress"><i style="width:100%"></i></div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Skeleton loader</div>
 <div class="spec-body">
 <div class="row" style="align-items:flex-start;gap:32px">
 <div style="width:260px">
 <div class="hstack" style="gap:12px;margin-bottom:16px">
 <div class="skeleton sk-avatar"></div>
 <div style="flex:1">
 <div class="skeleton sk-line" style="width:60%"></div>
 <div class="skeleton sk-line" style="width:40%;margin-bottom:0"></div>
 </div>
 </div>
 <div class="skeleton sk-img"></div>
 <div class="skeleton sk-line" style="margin-top:14px"></div>
 <div class="skeleton sk-line" style="width:80%"></div>
 </div>
 <div style="width:260px">
 <div class="skeleton sk-title"></div>
 <div class="skeleton sk-line"></div>
 <div class="skeleton sk-line"></div>
 <div class="skeleton sk-line" style="width:50%"></div>
 <div class="skeleton sk-btn" style="margin-top:16px"></div>
 </div>
 </div>
 </div>
 </div>
 </section>

 <!-- ==========================================================
 FEEDBACK
 ========================================================== -->
 <section class="section" id="feedback">
 <h2>Feedback &amp; Status</h2>

 <div class="spec">
 <div class="spec-label">Alert</div>
 <div class="spec-body">
 <div class="col" style="gap:10px;max-width:560px">
 <div class="alert alert-success">
 <svg class="icon"><use href="#i-check-circle"/></svg>
 <div><div class="alert-title">Changes saved</div><div class="alert-text">Your profile has been updated.</div></div>
 <button class="close"><svg class="icon icon-sm"><use href="#i-x"/></svg></button>
 </div>
 <div class="alert alert-info">
 <svg class="icon"><use href="#i-info"/></svg>
 <div><div class="alert-title">New version available</div><div class="alert-text">Reload to get the latest features.</div></div>
 </div>
 <div class="alert alert-warn">
 <svg class="icon"><use href="#i-warn"/></svg>
 <div><div class="alert-title">Trial ends in 3 days</div><div class="alert-text">Add a payment method to continue.</div></div>
 </div>
 <div class="alert alert-danger">
 <svg class="icon"><use href="#i-error"/></svg>
 <div><div class="alert-title">Payment failed</div><div class="alert-text">Your card was declined. Try another method.</div></div>
 <button class="close"><svg class="icon icon-sm"><use href="#i-x"/></svg></button>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Toast notification</div>
 <div class="spec-body">
 <div class="row">
 <button class="btn btn-secondary" data-toast="success">Success toast</button>
 <button class="btn btn-secondary" data-toast="info">Info toast</button>
 <button class="btn btn-secondary" data-toast="error">Error toast</button>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Modal dialog</div>
 <div class="spec-body">
 <button class="btn btn-primary" data-open="modal-demo">Open modal</button>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Confirmation dialog</div>
 <div class="spec-body">
 <button class="btn btn-danger" data-open="confirm-demo">Delete project</button>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Loading spinner</div>
 <div class="spec-body">
 <div class="row" style="gap:28px">
 <div class="spinner sm"></div>
 <div class="spinner"></div>
 <div class="spinner lg"></div>
 <span class="spinner-btn"><span class="spinner sm"></span> Loading results…</span>
 <button class="btn btn-secondary" disabled style="gap:9px">
 <span class="spinner sm"></span> Saving
 </button>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Empty state</div>
 <div class="spec-body">
 <div class="empty" style="max-width:520px">
 <div class="glyph"><svg class="icon icon-lg"><use href="#i-grid"/></svg></div>
 <h4>No projects yet</h4>
 <p>Projects keep your work organised. Create your first one to get started.</p>
 <button class="btn btn-primary"><svg class="icon"><use href="#i-plus"/></svg> New project</button>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Error state</div>
 <div class="spec-body">
 <div class="state-error" style="max-width:520px">
 <svg class="icon icon-lg"><use href="#i-warn"/></svg>
 <div>
 <h4>Couldn't load your data</h4>
 <p>We hit a network error while fetching the dashboard. Check your connection and try again.</p>
 <button class="btn btn-secondary btn-sm">Retry</button>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Success message</div>
 <div class="spec-body">
 <div class="state-success" style="max-width:520px">
 <svg class="icon icon-lg"><use href="#i-check-circle"/></svg>
 <div>
 <h4>Payment received</h4>
 <p>Your subscription to the Pro plan is now active. A receipt has been emailed to you.</p>
 </div>
 </div>
 </div>
 </div>
 </section>

 <!-- ==========================================================
 LAYOUT
 ========================================================== -->
 <section class="section" id="layout">
 <h2>Layout</h2>

 <div class="spec">
 <div class="spec-label">Container</div>
 <div class="spec-body">
 <div class="container">Container · max-width 640px · centred</div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Grid</div>
 <div class="spec-body">
 <div class="col" style="gap:12px;max-width:640px">
 <div class="grid grid-4"><div>1</div><div>2</div><div>3</div><div>4</div></div>
 <div class="grid grid-3"><div>1</div><div>2</div><div>3</div></div>
 <div class="grid grid-2"><div>1</div><div>2</div></div>
 <div class="grid grid-auto"><div>A</div><div>B</div><div>C</div><div>D</div><div>E</div></div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Stack</div>
 <div class="spec-body">
 <div class="stack" style="max-width:280px">
 <div class="card"><div class="card-body">Stacked item one</div></div>
 <div class="card"><div class="card-body">Stacked item two</div></div>
 <div class="card"><div class="card-body">Stacked item three</div></div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Divider</div>
 <div class="spec-body" style="max-width:480px">
 <p class="muted" style="font-size:13px">Content above the divider.</p>
 <hr class="divider" style="margin:16px 0">
 <p class="muted" style="font-size:13px">Content below the divider.</p>
 <div class="divider-label" style="margin-top:20px">or continue with</div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Drawer</div>
 <div class="spec-body">
 <button class="btn btn-secondary" data-open="drawer-demo">Open drawer</button>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Bottom sheet</div>
 <div class="spec-body">
 <button class="btn btn-secondary" data-open="sheet-demo">Open bottom sheet</button>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Responsive columns</div>
 <div class="spec-body">
 <div class="grid grid-auto" style="max-width:640px">
 <div style="padding:26px 10px">auto-fit</div>
 <div style="padding:26px 10px">min 120px</div>
 <div style="padding:26px 10px">wraps</div>
 <div style="padding:26px 10px">as needed</div>
 <div style="padding:26px 10px">fluid</div>
 </div>
 </div>
 </div>
 </section>

 <!-- ==========================================================
 MEDIA
 ========================================================== -->
 <section class="section" id="media">
 <h2>Media</h2>

 <div class="spec">
 <div class="spec-label">Image gallery</div>
 <div class="spec-body">
 <div class="gallery" style="max-width:520px">
 <div class="ph" data-lightbox><svg class="icon icon-lg"><use href="#i-image"/></svg></div>
 <div class="ph" data-lightbox><svg class="icon"><use href="#i-image"/></svg></div>
 <div class="ph" data-lightbox><svg class="icon"><use href="#i-image"/></svg></div>
 <div class="ph" data-lightbox><svg class="icon"><use href="#i-image"/></svg></div>
 <div class="ph" data-lightbox><svg class="icon"><use href="#i-image"/></svg></div>
 </div>
 <p class="hint" style="margin-top:10px">Click any tile to open the lightbox.</p>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Carousel</div>
 <div class="spec-body" style="max-width:560px">
 <div class="carousel" data-carousel>
 <div class="carousel-track">
 <div class="carousel-slide ph"><svg class="icon icon-lg"><use href="#i-image"/></svg></div>
 <div class="carousel-slide ph"><span class="mono" style="font-size:12px">Slide 02</span></div>
 <div class="carousel-slide ph"><span class="mono" style="font-size:12px">Slide 03</span></div>
 </div>
 <button class="carousel-nav prev" data-car-prev><svg class="icon icon-sm"><use href="#i-chev-left"/></svg></button>
 <button class="carousel-nav next" data-car-next><svg class="icon icon-sm"><use href="#i-chev-right"/></svg></button>
 </div>
 <div class="carousel-dots" data-car-dots></div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Video player</div>
 <div class="spec-body" style="max-width:560px">
 <div class="player" data-player>
 <div class="player-stage ph">
 <button class="play-big" data-play-btn><svg class="icon icon-lg"><use href="#i-play"/></svg></button>
 </div>
 <div class="player-controls">
 <button class="icon-btn sm" data-play-btn><svg class="icon icon-sm"><use href="#i-play"/></svg></button>
 <span class="time" data-time>0:00 / 3:24</span>
 <div class="track"><i style="width:0%" data-progress></i></div>
 <button class="icon-btn sm"><svg class="icon icon-sm"><use href="#i-volume"/></svg></button>
 <button class="icon-btn sm"><svg class="icon icon-sm"><use href="#i-expand"/></svg></button>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Audio player</div>
 <div class="spec-body">
 <div class="audio">
 <div class="art ph"><svg class="icon"><use href="#i-star"/></svg></div>
 <button class="icon-btn bordered"><svg class="icon icon-sm"><use href="#i-play"/></svg></button>
 <div style="flex:1;min-width:0">
 <div style="font-size:12.5px;font-weight:500">Ambient Study Loop</div>
 <div class="hint" style="margin-bottom:6px">Sable · 3:24</div>
 <div class="wave" id="wave"></div>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Lightbox</div>
 <div class="spec-body">
 <button class="btn btn-secondary" data-open-lb>Open lightbox</button>
 </div>
 </div>
 </section>

 <!-- ==========================================================
 COMMERCE
 ========================================================== -->
 <section class="section" id="commerce">
 <h2>Commerce</h2>

 <div class="spec">
 <div class="spec-label">Product card &amp; Price display</div>
 <div class="spec-body">
 <div class="row" style="align-items:flex-start;gap:18px">
 <div class="product">
 <div class="thumb ph">
 <button class="fav"><svg class="icon icon-sm"><use href="#i-heart"/></svg></button>
 </div>
 <div class="info">
 <div class="name">Linen Overshirt</div>
 <div class="cat">Outerwear</div>
 <div class="buy">
 <div class="price">
 <span class="now">$128</span>
 <span class="was">$160</span>
 <span class="off">−20%</span>
 </div>
 <button class="icon-btn bordered"><svg class="icon icon-sm"><use href="#i-cart"/></svg></button>
 </div>
 </div>
 </div>

 <div class="product">
 <div class="thumb ph">
 <button class="fav"><svg class="icon icon-sm"><use href="#i-heart"/></svg></button>
 </div>
 <div class="info">
 <div class="name">Merino Crew</div>
 <div class="cat">Knitwear</div>
 <div class="buy">
 <div class="price"><span class="now">$94</span></div>
 <button class="icon-btn bordered"><svg class="icon icon-sm"><use href="#i-cart"/></svg></button>
 </div>
 </div>
 </div>

 <div class="col" style="gap:16px">
 <div class="price"><span class="now" style="font-size:24px">$128.00</span><span class="was" style="font-size:14px">$160.00</span></div>
 <div class="price"><span class="now">$128</span><span class="off">Save $32</span></div>
 <div class="price"><span class="now">$0</span><span class="hint">Free</span></div>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Quantity selector</div>
 <div class="spec-body">
 <div class="row" style="gap:20px">
 <div class="qty" data-qty>
 <button data-qty-dec><svg class="icon icon-sm"><use href="#i-minus"/></svg></button>
 <input type="number" value="1" min="1" max="99" readonly>
 <button data-qty-inc><svg class="icon icon-sm"><use href="#i-plus"/></svg></button>
 </div>
 <div class="qty">
 <button><svg class="icon icon-sm"><use href="#i-minus"/></svg></button>
 <input type="number" value="12" readonly>
 <button><svg class="icon icon-sm"><use href="#i-plus"/></svg></button>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Shopping cart</div>
 <div class="spec-body">
 <div class="cart">
 <div class="cart-head">
 <span>Your cart</span>
 <span class="badge">3 items</span>
 </div>
 <div class="cart-item">
 <div class="thumb ph"></div>
 <div class="meta">
 <div class="n">Linen Overshirt</div>
 <div class="v">Sand · Medium</div>
 </div>
 <div class="col" style="align-items:flex-end;gap:8px">
 <span style="font-size:12.5px;font-weight:500">$128</span>
 <div class="qty"><button><svg class="icon icon-sm"><use href="#i-minus"/></svg></button><input value="1" readonly><button><svg class="icon icon-sm"><use href="#i-plus"/></svg></button></div>
 </div>
 </div>
 <div class="cart-item">
 <div class="thumb ph"></div>
 <div class="meta">
 <div class="n">Merino Crew</div>
 <div class="v">Charcoal · Large</div>
 </div>
 <div class="col" style="align-items:flex-end;gap:8px">
 <span style="font-size:12.5px;font-weight:500">$94</span>
 <div class="qty"><button><svg class="icon icon-sm"><use href="#i-minus"/></svg></button><input value="2" readonly><button><svg class="icon icon-sm"><use href="#i-plus"/></svg></button></div>
 </div>
 </div>
 <div class="cart-foot">
 <div class="cart-row"><span>Subtotal</span><span>$316.00</span></div>
 <div class="cart-row"><span>Shipping</span><span>Free</span></div>
 <div class="cart-row total"><span>Total</span><span>$316.00</span></div>
 <button class="btn btn-primary btn-block">Checkout</button>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Checkout form</div>
 <div class="spec-body">
 <div class="card" style="max-width:460px">
 <div class="card-body">
 <div class="card-title" style="margin-bottom:18px">Shipping details</div>
 <div class="stack" style="gap:14px">
 <div class="field" style="max-width:none">
 <label class="label">Email</label>
 <input class="input" type="email" placeholder="you@example.com">
 </div>
 <div class="row" style="gap:12px">
 <div class="field" style="flex:1;max-width:none">
 <label class="label">First name</label>
 <input class="input">
 </div>
 <div class="field" style="flex:1;max-width:none">
 <label class="label">Last name</label>
 <input class="input">
 </div>
 </div>
 <div class="field" style="max-width:none">
 <label class="label">Address</label>
 <input class="input">
 </div>
 <div class="row" style="gap:12px">
 <div class="field" style="flex:1;max-width:none">
 <label class="label">City</label>
 <input class="input">
 </div>
 <div class="field" style="width:110px;max-width:none">
 <label class="label">ZIP</label>
 <input class="input">
 </div>
 </div>
 <button class="btn btn-primary btn-block" style="margin-top:6px">Pay $316.00</button>
 </div>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Rating &amp; review</div>
 <div class="spec-body">
 <div class="row" style="align-items:flex-start;gap:40px">
 <div>
 <div style="font-size:32px;font-weight:600;letter-spacing:-.03em;line-height:1.1">4.6</div>
 <div class="rating" style="margin:8px 0 6px">
 <svg class="icon star-on"><use href="#i-star"/></svg>
 <svg class="icon star-on"><use href="#i-star"/></svg>
 <svg class="icon star-on"><use href="#i-star"/></svg>
 <svg class="icon star-on"><use href="#i-star"/></svg>
 <svg class="icon star-off"><use href="#i-star"/></svg>
 </div>
 <div class="hint">Based on 128 reviews</div>
 </div>

 <div style="flex:1;min-width:280px;max-width:420px">
 <div class="review">
 <div class="avatar avatar-sm">JC</div>
 <div>
 <div class="r-head">
 <span class="r-name">Jane Cooper</span>
 <span class="r-date">2 days ago</span>
 </div>
 <div class="rating">
 <svg class="icon star-on"><use href="#i-star"/></svg>
 <svg class="icon star-on"><use href="#i-star"/></svg>
 <svg class="icon star-on"><use href="#i-star"/></svg>
 <svg class="icon star-on"><use href="#i-star"/></svg>
 <svg class="icon star-on"><use href="#i-star"/></svg>
 </div>
 <p>Beautiful fabric and the fit is exactly as described. Would buy again.</p>
 </div>
 </div>
 <div class="review">
 <div class="avatar avatar-sm">MK</div>
 <div>
 <div class="r-head">
 <span class="r-name">Marcus Kim</span>
 <span class="r-date">1 week ago</span>
 </div>
 <div class="rating">
 <svg class="icon star-on"><use href="#i-star"/></svg>
 <svg class="icon star-on"><use href="#i-star"/></svg>
 <svg class="icon star-on"><use href="#i-star"/></svg>
 <svg class="icon star-off"><use href="#i-star"/></svg>
 <svg class="icon star-off"><use href="#i-star"/></svg>
 </div>
 <p>Good quality, though it runs slightly large. Size down if you're between sizes.</p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 </section>

 <!-- ==========================================================
 SPECIALIZED
 ========================================================== -->
 <section class="section" id="specialized">
 <h2>Specialized</h2>

 <div class="spec">
 <div class="spec-label">Calendar</div>
 <div class="spec-body">
 <div class="calendar" id="calendar"></div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Chat window</div>
 <div class="spec-body">
 <div class="chat">
 <div class="chat-head">
 <div class="avatar avatar-sm">AR</div>
 <div style="flex:1">
 <div class="n">Amelia Ray</div>
 <div class="s">Online</div>
 </div>
 <button class="icon-btn sm"><svg class="icon icon-sm"><use href="#i-more"/></svg></button>
 </div>
 <div class="chat-body">
 <div class="bubble them">Hey! Did you get a chance to look at the new tokens?<span class="t">09:41</span></div>
 <div class="bubble me">Yes — the radius scale feels much calmer now.<span class="t">09:42</span></div>
 <div class="bubble them">Great. I'll push the spacing updates this afternoon.<span class="t">09:43</span></div>
 <div class="bubble me">Perfect, thanks 👍<span class="t">09:44</span></div>
 </div>
 <div class="chat-input">
 <button class="icon-btn sm"><svg class="icon icon-sm"><use href="#i-paperclip"/></svg></button>
 <input class="input" placeholder="Message…">
 <button class="icon-btn" style="background:var(--accent);color:var(--on-accent)">
 <svg class="icon icon-sm"><use href="#i-send"/></svg>
 </button>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Map</div>
 <div class="spec-body" style="max-width:560px">
 <div class="map">
 <div class="road h" style="top:32%"></div>
 <div class="road h" style="top:68%"></div>
 <div class="road v" style="left:26%"></div>
 <div class="road v" style="left:74%"></div>
 <div class="pin"></div>
 <div class="map-ui">
 <button>+</button>
 <button>−</button>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Code editor</div>
 <div class="spec-body" style="max-width:600px">
 <div class="code">
 <div class="code-head">
 <span class="dots"><i></i><i></i><i></i></span>
 <span class="fname">tokens.css</span>
 </div>
 <pre><div class="line"><span class="ln">1</span><span><span class="tok-c">/* Minimal design tokens */</span></span></div><div class="line"><span class="ln">2</span><span><span class="tok-k">:root</span> {</span></div><div class="line"><span class="ln">3</span><span> <span class="tok-f">--space</span>: <span class="tok-n">8px</span>;</span></div><div class="line"><span class="ln">4</span><span> <span class="tok-f">--radius</span>: <span class="tok-n">8px</span>;</span></div><div class="line"><span class="ln">5</span><span> <span class="tok-f">--border</span>: <span class="tok-s">#e8e8e8</span>;</span></div><div class="line"><span class="ln">6</span><span> <span class="tok-f">--text</span>: <span class="tok-s">#0f0f0f</span>;</span></div><div class="line"><span class="ln">7</span><span>}</span></div></pre>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Rich-text editor</div>
 <div class="spec-body" style="max-width:600px">
 <div class="rte">
 <div class="rte-bar">
 <button class="icon-btn sm"><svg class="icon icon-sm"><use href="#i-bold"/></svg></button>
 <button class="icon-btn sm"><svg class="icon icon-sm"><use href="#i-italic"/></svg></button>
 <button class="icon-btn sm"><svg class="icon icon-sm"><use href="#i-underline"/></svg></button>
 <span class="divider-v" style="height:18px;margin:0 6px"></span>
 <button class="icon-btn sm active"><svg class="icon icon-sm"><use href="#i-list"/></svg></button>
 <button class="icon-btn sm"><svg class="icon icon-sm"><use href="#i-link"/></svg></button>
 <button class="icon-btn sm"><svg class="icon icon-sm"><use href="#i-image"/></svg></button>
 </div>
 <div class="rte-area" contenteditable="true">
 <h4>Release notes — v2.4</h4>
 <p>This release focuses on simplification: fewer tokens, tighter spacing, and a calmer default palette.</p>
 <ul>
 <li>Unified border weights across all components</li>
 <li>New skeleton loader primitives</li>
 <li>Dark mode contrast fixes</li>
 </ul>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Charts</div>
 <div class="spec-body">
 <div class="grid grid-2" style="max-width:760px">
 <div class="chart-card">
 <div class="chart-head">
 <div>
 <div class="k">Revenue</div>
 <div class="v">$48,210</div>
 </div>
 <span class="badge badge-success">+12.4%</span>
 </div>
 <div class="bars">
 <i style="height:38%"></i><i style="height:52%"></i><i style="height:44%"></i>
 <i style="height:70%"></i><i style="height:58%"></i><i style="height:82%"></i>
 <i style="height:64%"></i><i style="height:90%"></i><i style="height:72%"></i>
 <i class="dim" style="height:48%"></i><i class="dim" style="height:60%"></i><i class="dim" style="height:36%"></i>
 </div>
 </div>

 <div class="chart-card">
 <div class="chart-head">
 <div>
 <div class="k">Traffic sources</div>
 <div class="v">12.8k</div>
 </div>
 </div>
 <div class="hstack" style="gap:26px">
 <div class="donut">
 <div class="donut-center">46%</div>
 </div>
 <div class="col" style="gap:9px;font-size:12px">
 <span class="hstack" style="gap:8px"><i style="width:9px;height:9px;border-radius:2px;background:var(--text);display:block"></i> Organic</span>
 <span class="hstack" style="gap:8px"><i style="width:9px;height:9px;border-radius:2px;background:var(--border-strong);display:block"></i> Referral</span>
 <span class="hstack" style="gap:8px"><i style="width:9px;height:9px;border-radius:2px;background:var(--faint);display:block"></i> Direct</span>
 </div>
 </div>
 </div>

 <div class="chart-card" style="grid-column:span 2">
 <div class="chart-head">
 <div>
 <div class="k">Sessions over time</div>
 <div class="v">3,482</div>
 </div>
 <div class="btn-group">
 <button class="btn btn-sm active">7d</button>
 <button class="btn btn-sm">30d</button>
 <button class="btn btn-sm">90d</button>
 </div>
 </div>
 <svg viewBox="0 0 600 140" width="100%" height="140" preserveAspectRatio="none" style="display:block">
 <defs>
 <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stop-color="currentColor" stop-opacity=".14"/>
 <stop offset="100%" stop-color="currentColor" stop-opacity="0"/>
 </linearGradient>
 </defs>
 <g style="color:var(--text)">
 <path d="M0,110 L50,96 L100,104 L150,72 L200,84 L250,52 L300,66 L350,38 L400,54 L450,30 L500,44 L550,22 L600,34 L600,140 L0,140 Z" fill="url(#areaFill)"/>
 <path d="M0,110 L50,96 L100,104 L150,72 L200,84 L250,52 L300,66 L350,38 L400,54 L450,30 L500,44 L550,22 L600,34"
 fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
 </g>
 </svg>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Timeline</div>
 <div class="spec-body" style="max-width:420px">
 <div class="timeline">
 <div class="tl-item done">
 <div class="tl-time">09:12</div>
 <div class="tl-title">Order placed</div>
 <div class="tl-text">Confirmation sent to jane@acme.co</div>
 </div>
 <div class="tl-item done">
 <div class="tl-time">11:40</div>
 <div class="tl-title">Payment captured</div>
 <div class="tl-text">$316.00 via Visa ending 4242</div>
 </div>
 <div class="tl-item current">
 <div class="tl-time">14:05</div>
 <div class="tl-title">Preparing shipment</div>
 <div class="tl-text">Your order is being packed</div>
 </div>
 <div class="tl-item">
 <div class="tl-time">—</div>
 <div class="tl-title">Out for delivery</div>
 <div class="tl-text">Estimated in 2 days</div>
 </div>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Stepper / Wizard</div>
 <div class="spec-body" style="max-width:640px" data-stepper>
 <div class="stepper">
 <div class="step active" data-step="1"><span class="num">1</span><span class="lbl">Account</span></div>
 <span class="step-line"></span>
 <div class="step" data-step="2"><span class="num">2</span><span class="lbl">Company</span></div>
 <span class="step-line"></span>
 <div class="step" data-step="3"><span class="num">3</span><span class="lbl">Billing</span></div>
 <span class="step-line"></span>
 <div class="step" data-step="4"><span class="num">4</span><span class="lbl">Done</span></div>
 </div>
 <div class="step-panel" data-step-panel>Step 1 — Create your account credentials.</div>
 <div class="row" style="margin-top:18px">
 <button class="btn btn-secondary btn-sm" data-step-prev>Back</button>
 <button class="btn btn-primary btn-sm" data-step-next>Continue</button>
 </div>
 </div>
 </div>

 <div class="spec">
 <div class="spec-label">Cookie-consent banner</div>
 <div class="spec-body">
 <div class="cookie" style="max-width:720px">
 <div class="txt">
 <strong>We use cookies</strong>
 <p>We use cookies to analyse traffic and improve your experience. You can accept all, or keep only what's essential.</p>
 </div>
 <div class="acts">
 <button class="btn btn-ghost btn-sm">Essential only</button>
 <button class="btn btn-secondary btn-sm">Preferences</button>
 <button class="btn btn-primary btn-sm">Accept all</button>
 </div>
 </div>
 </div>
 </div>
 </section>

</main>

<!-- ============================================================
 OVERLAYS
 ============================================================ -->
<div class="scrim" id="scrim"></div>

<!-- Modal -->
<div class="overlay" id="modal-demo">
 <div class="modal">
 <div class="modal-head">
 <h3>Invite teammates</h3>
 <p>Anyone you invite will get access to this workspace immediately.</p>
 </div>
 <div class="modal-body">
 <div class="field" style="max-width:none">
 <label class="label">Email addresses</label>
 <input class="input" placeholder="name@company.com, …">
 <span class="hint">Separate multiple addresses with commas.</span>
 </div>
 </div>
 <div class="modal-foot">
 <button class="btn btn-ghost" data-close>Cancel</button>
 <button class="btn btn-primary" data-close>Send invites</button>
 </div>
 </div>
</div>

<!-- Confirm -->
<div class="overlay" id="confirm-demo">
 <div class="modal" style="max-width:400px">
 <div class="modal-head">
 <div class="modal-icon danger"><svg class="icon"><use href="#i-trash"/></svg></div>
 <h3>Delete this project?</h3>
 <p>This action cannot be undone. All files, comments, and history will be permanently removed.</p>
 </div>
 <div class="modal-foot">
 <button class="btn btn-secondary" data-close>Cancel</button>
 <button class="btn btn-danger" data-close>Delete project</button>
 </div>
 </div>
</div>

<!-- Drawer -->
<div class="drawer" id="drawer-demo">
 <div class="drawer-head">
 <h3>Notifications</h3>
 <button class="icon-btn sm" data-close><svg class="icon icon-sm"><use href="#i-x"/></svg></button>
 </div>
 <div class="drawer-body">
 <ul class="list">
 <li><div class="avatar avatar-sm">AR</div><div><div class="li-main">Amelia commented</div><div class="li-sub">2 minutes ago</div></div></li>
 <li><div class="avatar avatar-sm">MK</div><div><div class="li-main">Marcus merged a pull request</div><div class="li-sub">1 hour ago</div></div></li>
 <li><div class="avatar avatar-sm">JC</div><div><div class="li-main">Jane updated the design tokens</div><div class="li-sub">Yesterday</div></div></li>
 </ul>
 </div>
 <div class="drawer-foot">
 <button class="btn btn-secondary btn-block" data-close>Close</button>
 </div>
</div>

<!-- Bottom sheet -->
<div class="sheet" id="sheet-demo">
 <div class="sheet-handle"></div>
 <h3 style="font-size:15px;font-weight:600;margin-bottom:6px">Share project</h3>
 <p class="hint" style="margin-bottom:18px">Choose how you'd like to share this project with your team.</p>
 <div class="stack" style="gap:8px">
 <button class="menu-item" style="padding:12px;border:1px solid var(--border)"><svg class="icon icon-sm"><use href="#i-link"/></svg> Copy link</button>
 <button class="menu-item" style="padding:12px;border:1px solid var(--border)"><svg class="icon icon-sm"><use href="#i-mail"/></svg> Invite by email</button>
 <button class="menu-item" style="padding:12px;border:1px solid var(--border)"><svg class="icon icon-sm"><use href="#i-upload"/></svg> Export as file</button>
 </div>
 <button class="btn btn-secondary btn-block" style="margin-top:14px" data-close>Cancel</button>
</div>

<!-- Lightbox -->
<div class="lightbox" id="lightbox">
 <button class="lb-close" data-lb-close><svg class="icon"><use href="#i-x"/></svg></button>
 <div class="lb-content">
 <svg class="icon" style="width:36px;height:36px"><use href="#i-image"/></svg>
 </div>
</div>

<!-- Toasts -->
<div class="toasts" id="toasts"></div>

<script>
/* ============================================================
 THEME
 ============================================================ */
const root = document.documentElement;
document.getElementById('themeToggle').addEventListener('click', () => {
 const dark = root.getAttribute('data-theme') === 'dark';
 root.setAttribute('data-theme', dark ? 'light' : 'dark');
 document.getElementById('themeLabel').textContent = dark ? 'Dark mode' : 'Light mode';
 document.querySelector('#themeToggle use').setAttribute('href', dark ? '#i-moon' : '#i-sun');
});

/* ============================================================
 MOBILE NAV
 ============================================================ */
document.getElementById('navToggle').addEventListener('click', () => {
 document.getElementById('docnav').classList.toggle('open');
});
document.querySelectorAll('.docnav nav a').forEach(a => {
 a.addEventListener('click', () => document.getElementById('docnav').classList.remove('open'));
});

/* Active section highlight */
const navLinks = [...document.querySelectorAll('.docnav nav a')];
const sections = navLinks.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
const io = new IntersectionObserver(entries => {
 entries.forEach(e => {
 if (e.isIntersecting) {
 navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
 }
 });
}, { rootMargin: '-10% 0px -80% 0px' });
sections.forEach(s => io.observe(s));

/* ============================================================
 DROPDOWNS / POPOVERS
 ============================================================ */
document.addEventListener('click', e => {
 const trigger = e.target.closest('[data-menu], [data-pop]');
 const id = trigger ? (trigger.dataset.menu || trigger.dataset.pop) : null;

 document.querySelectorAll('.menu.open, .popover.open').forEach(el => {
 if (el.id !== id) el.classList.remove('open');
 });

 if (trigger) {
 const panel = document.getElementById(id);
 panel.classList.toggle('open');
 }
});
document.querySelectorAll('[data-close-pop]').forEach(b =>
 b.addEventListener('click', e => e.target.closest('.popover').classList.remove('open'))
);

/* ============================================================
 TABS
 ============================================================ */
document.querySelectorAll('[data-tabs]').forEach(group => {
 group.querySelectorAll('.tab').forEach(tab => {
 tab.addEventListener('click', () => {
 group.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
 group.querySelectorAll('.tabpanel').forEach(p => p.classList.remove('active'));
 tab.classList.add('active');
 group.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('active');
 });
 });
});

/* ============================================================
 OVERLAYS (modal, confirm, drawer, sheet)
 ============================================================ */
const scrim = document.getElementById('scrim');
function closeAllOverlays() {
 document.querySelectorAll('.overlay.open, .drawer.open, .sheet.open').forEach(el => el.classList.remove('open'));
 scrim.classList.remove('open');
}
document.querySelectorAll('[data-open]').forEach(btn => {
 btn.addEventListener('click', () => {
 const el = document.getElementById(btn.dataset.open);
 el.classList.add('open');
 if (!el.classList.contains('overlay')) scrim.classList.add('open');
 });
});
document.querySelectorAll('[data-close]').forEach(btn =>
 btn.addEventListener('click', closeAllOverlays)
);
scrim.addEventListener('click', closeAllOverlays);
document.querySelectorAll('.overlay').forEach(ov =>
 ov.addEventListener('click', e => { if (e.target === ov) closeAllOverlays(); })
);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllOverlays(); });

/* ============================================================
 TOASTS
 ============================================================ */
const toastHost = document.getElementById('toasts');
const toastConfig = {
 success: { icon: '#i-check-circle', title: 'Changes saved', text: 'Your settings were updated successfully.', color: 'var(--success)' },
 info: { icon: '#i-info', title: 'Heads up', text: 'A new version is available to install.', color: 'var(--info)' },
 error: { icon: '#i-error', title: 'Something broke',text: 'We couldn\'t reach the server. Retry?', color: 'var(--danger)' }
};
function showToast(type) {
 const cfg = toastConfig[type] || toastConfig.info;
 const el = document.createElement('div');
 el.className = 'toast';
 el.innerHTML = `
 <svg class="icon" style="color:${cfg.color}"><use href="${cfg.icon}"/></svg>
 <div style="flex:1">
 <strong>${cfg.title}</strong>
 <p>${cfg.text}</p>
 </div>
 <button class="close"><svg class="icon icon-sm"><use href="#i-x"/></svg></button>`;
 toastHost.appendChild(el);
 const remove = () => {
 el.classList.add('out');
 setTimeout(() => el.remove(), 200);
 };
 el.querySelector('.close').addEventListener('click', remove);
 setTimeout(remove, 4200);
}
document.querySelectorAll('[data-toast]').forEach(b =>
 b.addEventListener('click', () => showToast(b.dataset.toast))
);

/* ============================================================
 QUANTITY SELECTORS
 ============================================================ */
document.querySelectorAll('[data-qty]').forEach(q => {
 const input = q.querySelector('input');
 q.querySelector('[data-qty-inc]').addEventListener('click', () => {
 input.value = Math.min(+input.max || 99, +input.value + 1);
 });
 q.querySelector('[data-qty-dec]').addEventListener('click', () => {
 input.value = Math.max(+input.min || 1, +input.value - 1);
 });
});

/* ============================================================
 CAROUSEL
 ============================================================ */
document.querySelectorAll('[data-carousel]').forEach(car => {
 const track = car.querySelector('.carousel-track');
 const slides = track.children.length;
 const dotsHost = car.parentElement.querySelector('[data-car-dots]');
 let index = 0;

 for (let i = 0; i < slides; i++) {
 const d = document.createElement('button');
 d.addEventListener('click', () => go(i));
 dotsHost.appendChild(d);
 }
 const dots = [...dotsHost.children];

 function go(i) {
 index = (i + slides) % slides;
 track.style.transform = `translateX(-${index * 100}%)`;
 dots.forEach((d, n) => d.classList.toggle('active', n === index));
 }
 car.querySelector('[data-car-prev]').addEventListener('click', () => go(index - 1));
 car.querySelector('[data-car-next]').addEventListener('click', () => go(index + 1));
 go(0);
});

/* ============================================================
 VIDEO PLAYER (mock)
 ============================================================ */
document.querySelectorAll('[data-player]').forEach(p => {
 let playing = false, pct = 0, timer = null;
 const progress = p.querySelector('[data-progress]');
 const time = p.querySelector('[data-time]');
 const stageBtn = p.querySelector('.player-stage [data-play-btn]');
 const barBtn = p.querySelector('.player-controls [data-play-btn]');

 function fmt(s) {
 const m = Math.floor(s / 60), ss = Math.floor(s % 60).toString().padStart(2, '0');
 return `${m}:${ss}`;
 }
 function render() {
 progress.style.width = pct + '%';
 time.textContent = `${fmt(pct / 100 * 204)} / 3:24`;
 const use = playing ? '#i-pause' : '#i-play';
 stageBtn.style.display = playing ? 'none' : 'grid';
 barBtn.querySelector('use').setAttribute('href', use);
 }
 function toggle() {
 playing = !playing;
 if (playing) {
 timer = setInterval(() => {
 pct = Math.min(100, pct + 0.6);
 if (pct >= 100) { pct = 0; playing = false; clearInterval(timer); }
 render();
 }, 80);
 } else {
 clearInterval(timer);
 }
 render();
 }
 stageBtn.addEventListener('click', toggle);
 barBtn.addEventListener('click', toggle);
 render();
});

/* ============================================================
 AUDIO WAVEFORM
 ============================================================ */
const wave = document.getElementById('wave');
if (wave) {
 const heights = [8,14,20,11,18,24,10,16,22,9,15,20,12,18,7,13,19,10];
 heights.forEach((h, i) => {
 const b = document.createElement('i');
 b.style.height = h + 'px';
 if (i < 9) b.classList.add('on');
 wave.appendChild(b);
 });
}

/* ============================================================
 LIGHTBOX
 ============================================================ */
const lightbox = document.getElementById('lightbox');
document.querySelectorAll('[data-lightbox]').forEach(el =>
 el.addEventListener('click', () => lightbox.classList.add('open'))
);
document.querySelector('[data-lb-close]').addEventListener('click', () => lightbox.classList.remove('open'));
lightbox.addEventListener('click', e => { if (e.target === lightbox) lightbox.classList.remove('open'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') lightbox.classList.remove('open'); });
document.querySelector('[data-open-lb]').addEventListener('click', () => lightbox.classList.add('open'));

/* ============================================================
 CALENDAR
 ============================================================ */
(function renderCalendar() {
 const host = document.getElementById('calendar');
 if (!host) return;
 const now = new Date();
 const y = now.getFullYear(), m = now.getMonth();
 const monthName = now.toLocaleString('en-US', { month: 'long' });
 const firstDay = new Date(y, m, 1).getDay();
 const daysInMonth = new Date(y, m + 1, 0).getDate();
 const prevMonthDays = new Date(y, m, 0).getDate();

 let html = `
 <div class="cal-head">
 <button class="icon-btn sm"><svg class="icon icon-sm"><use href="#i-chev-left"/></svg></button>
 <span class="m">${monthName} ${y}</span>
 <button class="icon-btn sm"><svg class="icon icon-sm"><use href="#i-chev-right"/></svg></button>
 </div>
 <div class="cal-grid">
 ${['S','M','T','W','T','F','S'].map(d => `<div class="dow">${d}</div>`).join('')}`;

 for (let i = firstDay - 1; i >= 0; i--) {
 html += `<button class="day mute">${prevMonthDays - i}</button>`;
 }
 for (let d = 1; d <= daysInMonth; d++) {
 const cls = d === now.getDate() ? 'day today' : 'day';
 html += `<button class="${cls}">${d}</button>`;
 }
 const total = firstDay + daysInMonth;
 const trailing = (7 - (total % 7)) % 7;
 for (let d = 1; d <= trailing; d++) {
 html += `<button class="day mute">${d}</button>`;
 }
 html += '</div>';
 host.innerHTML = html;

 host.querySelectorAll('.day').forEach(day => {
 day.addEventListener('click', () => {
 host.querySelectorAll('.day.sel').forEach(d => d.classList.remove('sel'));
 if (!day.classList.contains('mute')) day.classList.add('sel');
 });
 });
})();

/* ============================================================
 STEPPER
 ============================================================ */
document.querySelectorAll('[data-stepper]').forEach(s => {
 const steps = [...s.querySelectorAll('.step')];
 const panel = s.querySelector('[data-step-panel]');
 const labels = [
 'Step 1 — Create your account credentials.',
 'Step 2 — Tell us about your company.',
 'Step 3 — Add a payment method.',
 'Step 4 — You\'re all set. Review and confirm.'
 ];
 let current = 0;

 function render() {
 steps.forEach((st, i) => {
 st.classList.toggle('active', i === current);
 st.classList.toggle('done', i < current);
 });
 panel.textContent = labels[current];
 }
 s.querySelector('[data-step-next]').addEventListener('click', () => {
 current = Math.min(steps.length - 1, current + 1); render();
 });
 s.querySelector('[data-step-prev]').addEventListener('click', () => {
 current = Math.max(0, current - 1); render();
 });
 render();
});

/* ============================================================
 DATA GRID SORT
 ============================================================ */
(function () {
 const table = document.getElementById('dataGrid');
 if (!table) return;
 const tbody = table.querySelector('tbody');

 table.querySelectorAll('th.sortable').forEach(th => {
 let asc = true;
 th.addEventListener('click', () => {
 const idx = +th.dataset.col + 1;
 const rows = [...tbody.querySelectorAll('tr')];
 rows.sort((a, b) => {
 const av = a.children[idx].textContent.trim();
 const bv = b.children[idx].textContent.trim();
 const an = parseFloat(av), bn = parseFloat(bv);
 const cmp = (!isNaN(an) && !isNaN(bn)) ? an - bn : av.localeCompare(bv);
 return asc ? cmp : -cmp;
 });
 rows.forEach(r => tbody.appendChild(r));
 asc = !asc;
 table.querySelectorAll('.sort-ind').forEach(i => i.textContent = '↕');
 th.querySelector('.sort-ind').textContent = asc ? '↑' : '↓';
 });
 });
})();
</script>
</body>
</html>
```
