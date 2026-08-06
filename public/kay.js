window.ECOMMO_CONFIG = { quickNavigateOnly: true };

(function () {
  if (window.__ecommoTeardown) { try { window.__ecommoTeardown(); } catch (e) {} }

var ECOMMO_BUILD = '748654bf';

var PREVIEW_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n  <path class="nav-preview-eye-outline" d="M2.4 12C4.2 7.7 7.8 5.4 12 5.4C16.2 5.4 19.8 7.7 21.6 12C19.8 16.3 16.2 18.6 12 18.6C7.8 18.6 4.2 16.3 2.4 12Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>\n  <circle class="nav-preview-eye-pupil" cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/>\n</svg>\n';

  // ── CONFIG ────────────────────────────────────────────────────────────────
  var CFG = {
    siteName:      'KAY',
    primaryColor:  '#1c1c1c',
    cardSelector:  '[data-product-id]',
    imageSelector: 'img.js-lazyload',
    linkSelector:  'a.thumb',
    cardIdAttr:    'data-product-id',
    getName:       function(card, img) { return img ? img.alt : ''; },
    getPrice:      null,
    upgradeImage:  function(src) { return src.replace('_0_260.jpg', '_0_800.jpg'); },
    creditCardName: 'Kay Jewelers Credit Card',
    deliveryText:  'Delivery by Thurs, June 18 — Order within 3 hours',
    sizes:         ['6', '6.5', '7', '7.5', '8'],
    previewEnabled: true,
    dislikeEnabled: true,
    interestEnabled: true,
    debug: true,   // demo/testing convenience — logs on by default, no ?ecommodebug needed
    // The real grid-item wrapper (participates in the site's layout) is one
    // level above the [data-product-id] div — hide that, not the inner div,
    // so the grid actually collapses instead of leaving an empty slot.
    dislikeHideSelector: 'app-product-grid-item-akron',
    // Kay's own "N Results" element — rewritten to subtract disliked items
    // ("4 Results" with 3 disliked becomes "1 Results (3 Removed)"). It's an
    // id, not a class, and also contains a visually-hidden sr-only span.
    resultsMessageSelector: '#plp-results-message',
    // The whole inline results-count block — hidden once the sticky row takes
    // over, so the count isn't shown twice (once in normal flow, once fixed).
    resultsMessageContainerSelector: 'app-custom-plp-result',
    // Anchor used to find the fixed Filter By / Sort By bar — we insert our
    // own "N Results (M Removed)" row as its first child, so it's always
    // fixed on screen the same way that bar already is.
    filterButtonSelector: '.filter-button',
    previewSvg: PREVIEW_SVG,
    previewClass: 'kay-preview',
    previewLabel: 'Quick preview',
    // Metal swatches (AMAS/Signet platform).
    swatchSelector:        '.available-swatch-image',
    swatchControlSelector: 'input[type="radio"]',
    swatchIconSelector:    'img.visual-radio',
    galleryUrl: 'https://www.kay.com/engagement-rings?icid=MM:ENGAGEMENT:ALL',
    // OCC product API for item-page enrichment (images, description, sizes,
    // price, interactive variant selectors) — same backend as Jared, just a
    // different basesite. Confirmed working directly against a live product.
    productApi: {
      origin:   'https://ecomapi.jewels.com',
      basesite: 'kay',
      fields:   'FULL,images(FULL),variantOptions,price(DEFAULT),description',
      lang:     'en',
      curr:     'USD',
    },
  };


// ecommo-navigate/engine/* — generic sheet engine, split into ordered partials.
// לא לשנות את הלוגיקה הגנרית — כל ההתאמה לאתר נעשית דרך CFG בלבד.
// build.mjs / build.ps1 משרשרים את engine/*.js לפי שם הקובץ → sites/<site>.js
//
// סדר הקבצים חשוב: הצהרות פונקציה עולות (hoisted) אבל פקודות top-level
// (var P, mainCss, יצירת ה-badge, וקריאת enable()) רצות לפי הסדר המספרי.
//
// CFG חייב להכיל:
//   siteName, primaryColor, cardSelector, imageSelector, linkSelector,
//   cardIdAttr, getName, getPrice, upgradeImage, creditCardName,
//   deliveryText, sizes  (ראה <site>/config.js)

  // ── Runtime config override — flip demo-only toggles from the console
  // WITHOUT a rebuild. Set this BEFORE pasting/loading the site script:
  //   window.ECOMMO_CONFIG = { quickNavigateOnly: true };
  // Shallow-merged into CFG — anything not set here keeps whatever
  // <site>/config.js already configured.
  if (window.ECOMMO_CONFIG) Object.assign(CFG, window.ECOMMO_CONFIG);

  // "Quick Navigate Only" demo mode (CFG.quickNavigateOnly / window.ECOMMO_CONFIG
  // above) — keeps the core gallery→popup View Transition plus dislike/
  // swatches/PDP exactly as usual, but hides the two floating entry icons
  // (catch-up: 066-interest.js, cardstack: 067-cardstack.js) and stops the
  // gallery eye from ever being painted "interesting". Interest DATA
  // collection itself (dwell/interactions/scoring) is untouched — only its
  // user-facing surface is suppressed.
  function quickNavigateOnly() { return !!CFG.quickNavigateOnly; }

  // "Cards Only" demo mode (CFG.cardsOnly / window.ECOMMO_CONFIG) — the
  // opposite trim: hides the gallery's per-card preview eye
  // (`.nav-card-preview`, the only entry point into the popup from a gallery
  // tap — 06-events.js addCardPreviewButtons()) and the catch-up icon
  // (066-interest.js), leaving the cardstack icon (067-cardstack.js) as the
  // sole floating entry point. Independent of quickNavigateOnly — the two
  // can combine, though together they'd hide every icon.
  function cardsOnly() { return !!CFG.cardsOnly; }

  var P = CFG.primaryColor || '#1c1c1c';

  // ── Main CSS (injected on enable, removed on disable) ──────────────────────
  var mainCss = `
    #nav-sheet-overlay { display: none; }

    ::view-transition-group(product-hero) {
      animation-duration: 400ms;
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    ::view-transition-old(product-hero),
    ::view-transition-new(product-hero) {
      animation-duration: 400ms;
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    ::view-transition-old(root),
    ::view-transition-new(root) { animation-duration: 0ms; }

    #nav-sheet {
      position: fixed; inset: 0; z-index: 9999;
      background: #fff; overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      transform: translateX(100%);
      transition: transform 380ms cubic-bezier(0.4, 0, 0.2, 1);
      padding-bottom: 84px;
    }
    #nav-sheet.open { transform: translateX(0); }
    #nav-sheet-handle { display: none; }

    #nav-sheet-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px 8px; border-bottom: 1px solid #e8e8e8;
      position: sticky; top: 0; background: #fff; z-index: 1;
    }
    #nav-sheet-back {
      font-size: 28px; color: ${P}; background: none; border: none;
      cursor: pointer; padding: 0 4px 0 0; line-height: 1;
      font-family: Georgia, serif;
    }
    #nav-sheet-logo {
      font-size: 22px; font-weight: 800; letter-spacing: 4px;
      color: ${P}; font-family: Georgia, 'Times New Roman', serif;
    }
    #nav-sheet-metals { display: none; margin-bottom: 16px; }
    #nav-sheet-metals .nav-metal-label { font-size: 13px; color: ${P}; margin: 0 0 10px; }
    #nav-sheet-metals .nav-metal-key { font-weight: 700; }
    #nav-sheet-metals .nav-metal-val { font-weight: 400; }
    #nav-sheet-metals .nav-metal-list {
      display: flex; gap: 12px; flex-wrap: wrap; align-items: center;
    }
    #nav-sheet-metals .nav-metal {
      width: 30px; height: 30px; padding: 0; border: none; border-radius: 50%;
      box-shadow: 0 0 0 1px #d0d0d0; background: none !important; cursor: pointer;
      overflow: hidden; flex-shrink: 0; transition: box-shadow 120ms ease;
    }
    #nav-sheet-metals .nav-metal:hover,
    #nav-sheet-metals .nav-metal:focus,
    #nav-sheet-metals .nav-metal:active { outline: none !important; background: none !important; }
    #nav-sheet-metals .nav-metal img {
      width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 50%;
    }
    #nav-sheet-metals .nav-metal.selected { box-shadow: 0 0 0 2px #fff, 0 0 0 3px ${P}; }

    /* ── Item-page variant selectors (metal / shape / carat / quality) ── */
    .nav-var { margin-bottom: 18px; }
    .nav-var-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin: 0 0 10px; }
    .nav-var-label { font-size: 13px; color: ${P}; margin: 0; }
    .nav-var-key { font-weight: 700; }
    .nav-var-val { font-weight: 400; }
    .nav-var-link { font-size: 12px; color: #555; text-decoration: underline; cursor: pointer; flex-shrink: 0; }
    .nav-var-list { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-start; }
    .nav-var-row { display: flex; gap: 10px; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 2px; }

    #nav-sheet-variants .nav-var-opt {
      padding: 0; border: none; background: none !important; cursor: pointer;
      font: inherit; color: ${P} !important; flex-shrink: 0;
      transition: box-shadow 120ms ease;
    }
    #nav-sheet-variants .nav-var-opt:focus,
    #nav-sheet-variants .nav-var-opt:active { outline: none !important; background: none !important; }
    #nav-sheet-variants .nav-var-opt.np,
    #nav-sheet-variants .nav-var-opt.oos { opacity: 0.32; pointer-events: none; }
    #nav-sheet-variants .nav-var-opt.pending { pointer-events: none; }

    /* metal: round color chip + karat caption below */
    .nav-var-metal { display: inline-flex; flex-direction: column; align-items: center; gap: 4px; width: 44px; }
    .nav-var-metal .nav-var-swatch {
      position: relative; width: 40px; height: 40px; border-radius: 50%; overflow: hidden;
      box-shadow: 0 0 0 1px #d0d0d0 !important;
    }
    .nav-var-metal.selected .nav-var-swatch { box-shadow: 0 0 0 2px #fff, 0 0 0 3px #555 !important; }
    .nav-var-metal .nav-var-swatch img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .nav-var-cap { font-size: 11px; color: #555; text-align: center; }
    /* unavailable metal: diagonal slash (like the item page), not just dimming */
    #nav-sheet-variants .nav-var-metal.np,
    #nav-sheet-variants .nav-var-metal.oos { opacity: 1; pointer-events: none; }
    .nav-var-metal.np .nav-var-swatch img,
    .nav-var-metal.oos .nav-var-swatch img { opacity: .5; }
    .nav-var-metal.np .nav-var-swatch::after,
    .nav-var-metal.oos .nav-var-swatch::after {
      content: ''; position: absolute; top: 50%; left: 50%;
      width: 150%; height: 2px; background: #ffffff;
      transform: translate(-50%, -50%) rotate(-45deg);
    }

    /* shape: rounded-square outline box */
    .nav-var-shape {
      width: 46px; height: 46px; border-radius: 10px; box-shadow: 0 0 0 1px #cfcfcf !important;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .nav-var-shape.selected { box-shadow: 0 0 0 2px ${P} !important; }
    .nav-var-shape img { width: 26px; height: 26px; object-fit: contain; display: block; }

    /* pill: bordered rounded-rect (carat weight / quality grades) */
    .nav-var-pill {
      min-width: 48px; height: 48px; padding: 0 12px; border-radius: 10px;
      box-shadow: 0 0 0 1px #cfcfcf !important; font-size: 14px;
      display: inline-flex; align-items: center; justify-content: center; white-space: nowrap;
    }
    .nav-var-pill.selected { box-shadow: 0 0 0 2px ${P} !important; }

    /* quality: selected-detail card + grade pills */
    .nav-var-qcard {
      position: relative; box-shadow: 0 0 0 2px ${P} !important; border-radius: 10px;
      padding: 14px 16px; margin-bottom: 12px;
    }
    .nav-var-qgrade { font-size: 15px; font-weight: 600; margin-bottom: 6px; color: ${P}; }
    .nav-var-qline { font-size: 12.5px; color: #444; line-height: 1.5; }
    .nav-var-qprice {
      position: absolute; top: 12px; right: 14px; font-size: 12px; font-weight: 600;
      background: #eef6ef; color: #2c2823; border-radius: 12px; padding: 3px 10px;
    }

    /* loading skeletons — sized to match the real rows so nothing jumps */
    @keyframes ecommo-shimmer { from { background-position: -300px 0; } to { background-position: 300px 0; } }
    .nav-skel-el {
      background: #ececec; background-image: linear-gradient(90deg, #ececec 25%, #f4f4f4 50%, #ececec 75%);
      background-size: 300px 100%; animation: ecommo-shimmer 1.2s infinite linear; border-radius: 6px;
    }
    .nav-skel-row { margin-bottom: 18px; }
    .nav-skel-lbl { display: block; height: 13px; width: 96px; margin-bottom: 10px; }
    .nav-skel-chips { display: flex; gap: 12px; }
    .nav-skel-chip { width: 48px; height: 48px; border-radius: 10px; flex-shrink: 0; }
    .nav-skel-card { display: block; height: 88px; border-radius: 10px; }
    .nav-skel-line { display: block; height: 11px; margin-bottom: 8px; }
    #nav-sheet-desc .nav-skel-line:last-child { margin-bottom: 0; }

    #nav-sheet-desc { font-size: 12.5px; color: #444; line-height: 1.6; margin-bottom: 16px; }
    #nav-sheet-desc ul { padding-left: 18px; margin: 6px 0; }

    #nav-sheet-img-wrap { position: relative; background: #fff; aspect-ratio: 1; overflow: hidden; }
    #nav-sheet-img { width: 100%; height: 100%; object-fit: contain; display: block; padding: 20px; }

    #nav-sheet-imgcount {
      position: absolute; left: 12px; bottom: 12px; z-index: 3;
      opacity: 0; transition: opacity 300ms ease;
      background: rgba(0,0,0,.6); color: #fff;
      font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 11px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif; letter-spacing: .3px;
      pointer-events: none;
    }
    #nav-sheet-progress {
      position: absolute; left: 0; right: 0; bottom: 0; z-index: 3;
      height: 3px; background: #eee; pointer-events: none;
      opacity: 0; transition: opacity 300ms ease;
    }
    #nav-sheet-progress > span {
      display: block; height: 100%; width: 0;
      background: ${P}; transition: transform 200ms ease;
    }

    #nav-sheet-wish {
      font-size: 24px; color: ${P}; background: none;
      border: none; cursor: pointer; padding: 0; line-height: 1;
    }
    #nav-sheet-info { padding: 0 16px; }
    #nav-sheet-name { font-size: 15px; font-weight: 600; line-height: 1.4; color: ${P}; margin-bottom: 10px; margin-top: 2px; }
    #nav-sheet-price-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 16px; }
    #nav-sheet-price { font-size: 22px; font-weight: 700; color: ${P}; }
    #nav-sheet-orig  { font-size: 14px; color: #aaa; text-decoration: line-through; }
    .nav-sheet-divider { height: 1px; background: #efefef; margin: 4px 0 14px; }

    #nav-sheet-sizes { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 18px; }
    .nav-sheet-size-btn {
      min-width: 48px; height: 48px; padding: 0 8px;
      border: 1.5px solid #ccc; background: #fff;
      font-size: 13px; cursor: pointer; border-radius: 3px;
      color: ${P}; font-family: inherit;
    }
    .nav-sheet-size-btn.selected { border-color: ${P}; background: ${P}; color: #fff; }

    #nav-sheet-add {
      width: 100%; height: 50px; background: ${P}; color: #fff;
      border: none; font-size: 15px; font-weight: 700; cursor: pointer;
      border-radius: 3px; font-family: inherit; margin-bottom: 12px;
    }
    #nav-sheet-financing { font-size: 11.5px; color: #555; margin-bottom: 14px; line-height: 1.5; }
    #nav-sheet-financing a { color: ${P}; text-decoration: underline; }

    .nav-sheet-info-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; font-size: 12.5px; color: #333; }
    .nav-sheet-info-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }

    #nav-sheet-full {
      display: block; text-align: center;
      font-size: 13px; color: #555; text-decoration: underline;
      margin-top: 14px; padding: 10px 0;
      cursor: pointer; background: none; border: none;
      font-family: inherit; width: 100%;
    }
    #nav-sheet-sticky {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 10000;
      display: none; align-items: stretch;
      background: #fff; border: 1px solid #d3d3d3;
      border-radius: 20px 20px 0 0;
    }
    #nav-sheet-sticky.open { display: flex; }

    .item-nav__btn {
      flex: 1 1 0; min-width: 0;
      display: flex; align-items: center; gap: 3px;
      padding: 10px 6px; background: none; border: none; cursor: pointer;
      font: inherit; text-align: left;
      -webkit-tap-highlight-color: transparent;
      transition: transform 120ms ease, background-color 120ms ease;
    }
    .item-nav__btn--next { justify-content: flex-end; }
    /* Defensive reset for base + focus only, so the host site can't recolor/
       outline our buttons or leave a stuck background after tap. The press
       feedback below is intentional and reverts on release. */
    #nav-sheet-sticky .item-nav__btn,
    #nav-sheet-sticky .item-nav__btn:focus,
    #nav-sheet-sticky .item-nav__btn:focus-visible {
      background: none !important;
      outline: none !important;
      box-shadow: none !important;
      border: none !important;
      transform: none !important;
      filter: none !important;
      border-radius: 0 18px 0 0;
    }
    /* Press feedback (reverts when the tap ends). Hover only on hover devices. */
    @media (hover: hover) {
      #nav-sheet-sticky .item-nav__btn:hover { background: #F3F1EC !important; }
    }
    #nav-sheet-sticky .item-nav__btn:active {
      transform: scale(0.97) !important; background: #f8f8f8 !important;
    }
    #nav-sheet-sticky .item-nav__btn:disabled { opacity: 0.38 !important; pointer-events: none; }
    #nav-sheet-sticky .item-nav__btn--prev { border-radius: 18px 0 0 0 !important; }

    .item-nav__chevron { width: 19px; height: 19px; flex-shrink: 0; color: #8A8579; }
    .item-nav__thumb {
      width: 38px; height: 38px; flex-shrink: 0;
      border-radius: 9px; object-fit: cover; background: #F2EFE9;
      border: 1px solid #d3d3d3;
    }
    .item-nav__text { flex: 1; min-width: 0; overflow: hidden; margin-inline-start: 7px; }
    .item-nav__text--end { text-align: right; margin-inline-start: 0; margin-inline-end: 7px; }
    .item-nav__label { display: block; font-size: 13px; color: #1b1b1b; }
    .item-nav__title {
      display: block; font-size: 12px; font-weight: 500; color: #9c9c9c;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .item-nav__divider { width: 1px; margin: 8px 0; background: #d3d3d3; }

    #nav-sheet-counter { font-size: 11px; color: #888; min-width: 40px; text-align: right; }

    #nav-sheet-slide.slide-exit-left  { transform: translateX(-15%); opacity: 0; transition: transform 150ms ease, opacity 150ms ease; }
    #nav-sheet-slide.slide-exit-right { transform: translateX(15%);  opacity: 0; transition: transform 150ms ease, opacity 150ms ease; }
    #nav-sheet-slide.slide-enter {
      transform: translateX(0); opacity: 1;
      transition: transform 220ms cubic-bezier(0.25,0.46,0.45,0.94), opacity 150ms ease;
    }

    /* ── Gallery card interest indicator (reuses the preview eye icon) ── */
    /* Only "interesting" ever changes the eye's look — merely having opened
       a product isn't shown as its own state. The whole eye fills in, with
       the pupil punched out in white so it stays recognizable as an eye
       instead of a solid blob. */
    .nav-card-preview.nav-preview-interesting .nav-preview-eye-outline { fill: currentColor; }
    .nav-card-preview.nav-preview-interesting .nav-preview-eye-pupil { fill: #fff; }
    /* Same tint used for #nav-catchup-icon.viewing — same color, same meaning
       ("this one's interesting"), wherever it shows up. !important since
       addCardPreviewButtons() (06-events.js) sets an inline background-color
       copied from the site's own wishlist icon. */
    .nav-card-preview.nav-preview-interesting {
      color: #e26e77 !important; background: #fdecee !important;
    }

    /* ── "Catch up" icon — jump into browsing only interesting items ── */
    /* z-index above both #nav-sheet (9999) and #nav-sheet-sticky (10000) so
       it stays visible/clickable while the popup is open, not just the gallery.
       Same bottom offset (96px, clearing the sticky Prev/Next bar's height)
       in both the gallery and the popup — one fixed spot everywhere, not two. */
    #nav-catchup-icon {
      position: fixed; bottom: 96px; left: 16px; z-index: 10001;
      width: 44px; height: 44px; border-radius: 50%; padding: 0;
      display: flex; align-items: center; justify-content: center;
      background: #fff; color: #888; border: 1.5px solid #ddd;
      box-shadow: 0 2px 10px rgba(0,0,0,.18); cursor: pointer;
      transition: transform 150ms ease, background 150ms ease, color 150ms ease,
                  border-color 150ms ease;
    }
    #nav-catchup-icon:active { transform: scale(0.94); }
    #nav-catchup-icon.disabled { opacity: .35; cursor: default; pointer-events: none; }
    /* Softer than .active — reuses the same color already used for the
       gallery/sheet "interesting" eye (.nav-preview-interesting) elsewhere,
       just a light tint/outline here rather than a solid fill. Declared
       before .active so an actual catch-up session (stronger state) still
       wins if somehow both classes are present at once. */
    #nav-catchup-icon.viewing { background: #fdecee; border-color: #e26e77; color: #e26e77; }
    #nav-catchup-icon.active { background: ${P}; border-color: ${P}; color: #fff; }
    #nav-catchup-icon svg { width: 22px; height: 22px; display: block; }

    /* "New item added" flash — #nav-catchup-icon is already position:fixed,
       so it's already a containing block for this absolutely-positioned
       corner dot. Not a persistent count anymore: hidden (opacity 0) by
       default, briefly shown as a "+" when the interesting count goes up,
       then faded back out — see updateCatchUpIcon(). */
    #nav-catchup-badge {
      display: flex; position: absolute; top: -4px; right: -4px;
      min-width: 18px; height: 18px; padding: 0 4px; box-sizing: border-box;
      border-radius: 9px; background: #c0392b; color: #fff;
      font-size: 12px; font-weight: 700; line-height: 1;
      align-items: center; justify-content: center;
      box-shadow: 0 1px 3px rgba(0,0,0,.3);
      opacity: 0; pointer-events: none; user-select: none;
      transition: opacity 300ms ease;
    }
    #nav-catchup-badge.show { opacity: 1; }
    @keyframes ecommo-catchup-bump {
      0% { transform: scale(1); }
      35% { transform: scale(1.45); }
      65% { transform: scale(0.9); }
      100% { transform: scale(1); }
    }
    #nav-catchup-badge.bump { animation: ecommo-catchup-bump 320ms ease; }

    /* ── "New item" entry icon — browse the whole gallery, like/dislike ── */
    /* Same fixed corner as #nav-catchup-icon, stacked directly above it
       (52px further up — 44px icon + 8px gap) so both float in the same
       spot without overlapping. Distinct glyph (cards, not the eye) so it
       reads as a different feature at a glance. */
    #nav-cardstack-icon {
      position: fixed; bottom: 148px; left: 16px; z-index: 10001;
      width: 44px; height: 44px; border-radius: 50%; padding: 0;
      display: flex; align-items: center; justify-content: center;
      background: #fff; color: #888; border: 1.5px solid #ddd;
      box-shadow: 0 2px 10px rgba(0,0,0,.18); cursor: pointer;
      transition: transform 150ms ease;
    }
    #nav-cardstack-icon:active { transform: scale(0.94); }
    /* Nothing left to browse — hide entirely rather than fade (unlike
       #nav-catchup-icon.disabled below, which stays visible-but-dimmed). */
    #nav-cardstack-icon.disabled { display: none; }
    #nav-cardstack-icon svg { width: 22px; height: 22px; display: block; }

    /* ── Swipeable card-stack overlay — shared by "catch up" (interesting
       items, 066-interest.js) and the generic gallery browse (067-cardstack.js);
       only one can ever be open at a time, so one overlay serves both. ── */
    /* z-index above #nav-sheet-sticky (10000) and both entry icons (10001) so
       it covers absolutely everything, including an already-open product popup. */
    #nav-swipestack-overlay {
      display: none; position: fixed; inset: 0; z-index: 10002;
      background: rgba(0,0,0,.55);
      align-items: center; justify-content: center;
    }
    #nav-swipestack-overlay.open { display: flex; }
    #nav-swipestack-close {
      position: absolute; top: 16px; right: 16px; z-index: 2;
      width: 36px; height: 36px; border-radius: 50%; padding: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,.9); border: none; color: #333;
      font-size: 16px; cursor: pointer;
    }
    #nav-swipestack-track { position: relative; width: 82vw; max-width: 320px; height: 60vh; max-height: 460px; }
    #nav-swipestack-done { display: none; color: #fff; font-size: 18px; font-weight: 600; text-align: center; }
    #nav-swipestack-overlay.done #nav-swipestack-track { display: none; }
    #nav-swipestack-overlay.done #nav-swipestack-done { display: block; }

    .nav-swipestack-card {
      position: absolute; inset: 0; border-radius: 16px; overflow: hidden;
      background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,.35);
      display: flex; flex-direction: column; touch-action: pan-y;
    }
    .nav-swipestack-card img { width: 100%; flex: 1; object-fit: cover; display: block; background: #f5f5f5; }
    .nav-swipestack-card-info { padding: 12px 14px; }
    .nav-swipestack-card-name { font-size: 14px; font-weight: 600; color: #1c1c1c; }
    .nav-swipestack-card-price-row { display: flex; align-items: baseline; gap: 7px; margin-top: 4px; }
    .nav-swipestack-card-price { font-size: 15px; font-weight: 700; color: #1c1c1c; }
    .nav-swipestack-card-orig { font-size: 12px; color: #999; text-decoration: line-through; }
    /* Same "X% off" pill everywhere a price shows a discount — the popup
       (#nav-sheet-off) and the swipe-stack card share this one class. */
    .nav-price-off-badge {
      display: inline-block; font-size: 11px; font-weight: 700;
      color: #1a7f4e; background: #e6f7ee; border-radius: 999px;
      padding: 2px 7px; line-height: 1.3;
    }
    .nav-price-off-badge:empty { display: none; }
    /* Top card: slight resting tilt so it reads as a held card, not a flat
       rectangle (matched in JS via SWIPESTACK_TILT for the drag/fly-off
       transforms, which override this inline while dragging). Cards behind:
       translateY bigger than the scale-shrink, so each one's bottom edge
       visibly pokes out past the card in front — inset:0 + scale alone (no
       extra translate) stays fully hidden behind the front card, which was
       the original bug (no visible peek). */
    .nav-swipestack-card[data-depth="0"] { z-index: 3; transform: rotate(-3deg); }
    .nav-swipestack-card[data-depth="1"] { z-index: 2; transform: translateY(18px) scale(0.97); opacity: .85; }
    .nav-swipestack-card[data-depth="2"] { z-index: 1; transform: translateY(32px) scale(0.94); opacity: .6; }

    /* Full-card colored overlay + label while dragging — opacity is driven
       entirely from JS (ramps to 1 exactly at the commit threshold), these
       rules just set the "what would happen" look. Right = positive (green),
       left = negative (red) — same colors regardless of which feature is
       driving (KEEP/REMOVE vs LIKE/SKIP), only the label text differs. */
    .nav-swipestack-card-hint {
      position: absolute; inset: 0; z-index: 5;
      display: flex; align-items: center; justify-content: center;
      font-size: 28px; font-weight: 800; color: #fff; letter-spacing: 2px;
      opacity: 0; pointer-events: none;
    }
    .nav-swipestack-hint-right { background: rgba(52,199,89,.85); }
    .nav-swipestack-hint-left { background: rgba(192,57,43,.85); }
  `;

  // ── Badge CSS (persistent — the toggle control lives in both states) ───────
  var badgeCss = `
    #nav-ecommo-badge {
      position: fixed; top: 12px; right: 12px; z-index: 99999;
      box-sizing: border-box;
      background: #fff; color: #000; border: 1px solid #000;
      padding: 7px 10px;
      border-radius: 22px; font-size: 12px; font-weight: 600;
      display: flex; align-items: center; gap: 9px;
      box-shadow: 0 2px 8px rgba(0,0,0,.25);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      letter-spacing: .3px; cursor: pointer; user-select: none;
      animation: ecommo-fadein 300ms ease;
    }
    #nav-ecommo-badge.hidden { display: none; }
    #nav-ecommo-switch {
      position: relative; flex-shrink: 0;
      width: 38px; height: 22px; border-radius: 11px;
      background: #6b7075; transition: background 200ms ease;
    }
    #nav-ecommo-badge.enabled #nav-ecommo-switch { background: rgb(52, 199, 89); }
    #nav-ecommo-switch .nav-ecommo-knob {
      position: absolute; top: 2px; left: 2px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.35);
      transition: transform 200ms cubic-bezier(0.4,0,0.2,1);
    }
    #nav-ecommo-badge.enabled #nav-ecommo-switch .nav-ecommo-knob { transform: translateX(16px); }
    #nav-ecommo-hide {
      display: inline-flex !important; align-items: center; justify-content: center;
      width: 20px; height: 20px;
      min-width: 20px !important; min-height: 20px !important;
      background: none; border: none; color: #000; opacity: .7;
      cursor: pointer; padding: 0; flex-shrink: 0; line-height: 1;
    }
    #nav-ecommo-hide:hover { opacity: 1; }
    #nav-ecommo-hide svg { display: block; width: 16px; height: 16px; }
    #nav-ecommo-close {
      background: none; border: none; color: #000;
      font-size: 16px; cursor: pointer; padding: 0 0 0 2px;
      line-height: 1; opacity: .7; flex-shrink: 0;
      position: relative; top: -1px;
    }
    #nav-ecommo-close:hover { opacity: 1; }
    @keyframes ecommo-fadein {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Debug-only interest ranking panel (no UI toggle anymore — reachable
       only via window.__ecommoInterest from the console) ── */
    #nav-ecommo-interest-panel {
      display: none;
      position: fixed; left: 12px; right: 12px; bottom: 0; z-index: 99998;
      box-sizing: border-box; overflow: hidden;
      background: #fff; color: #000; border: 1px solid #000; border-bottom: none;
      border-radius: 10px 10px 0 0; box-shadow: 0 -2px 8px rgba(0,0,0,.25);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11px;
    }
    #nav-ecommo-interest-panel.open { display: block; }
    #nav-ecommo-interest-title {
      background: #fff;
      padding: 8px 10px; font-weight: 700; font-size: 12px; border-bottom: 1px solid #eee;
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
    }
    #nav-ecommo-interest-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    #nav-ecommo-interest-collapse {
      background: none; border: none; color: #000; opacity: .6;
      cursor: pointer; padding: 0; line-height: 1; font-size: 18px; font-family: Georgia, serif;
    }
    #nav-ecommo-interest-collapse:hover { opacity: 1; }
    #nav-ecommo-interest-clear {
      background: none; border: none; color: #000; opacity: .6;
      cursor: pointer; padding: 0; line-height: 1;
    }
    #nav-ecommo-interest-clear:hover { opacity: 1; }
    #nav-ecommo-interest-clear svg { display: block; width: 14px; height: 14px; }
    /* ~5 item rows before scrolling kicks in (header row + 5 × ~32px thumbnail row) */
    #nav-ecommo-interest-body { padding: 4px 8px 8px; max-height: 190px; overflow-y: auto; }

    .nav-ecommo-interest-empty { padding: 10px 2px; color: #777; }
    .nav-ecommo-interest-table { width: 100%; border-collapse: collapse; }
    .nav-ecommo-interest-table tbody tr { cursor: pointer; }
    .nav-ecommo-interest-table tbody tr:active { background: #f5f5f5; }
    .nav-ecommo-interest-table th, .nav-ecommo-interest-table td {
      padding: 4px 5px; text-align: left; border-bottom: 1px solid #f0f0f0; white-space: nowrap;
    }
    .nav-ecommo-interest-name { max-width: 70px; overflow: hidden; text-overflow: ellipsis; }
    .nav-ecommo-interest-table td.nav-ecommo-interest-thumb { padding: 3px 4px 3px 0; }
    .nav-ecommo-interest-thumb img {
      display: block; width: 26px; height: 26px; object-fit: cover;
      border-radius: 4px; background: #f2f2f2;
    }
    .nav-ecommo-interest-table tr.nav-ecommo-interest-removed td { text-decoration: line-through; color: #aaa; }
  `;
  var badgeStyleEl = document.createElement('style');
  badgeStyleEl.id = 'nav-ecommo-badge-style';
  badgeStyleEl.textContent = badgeCss;
  document.head.appendChild(badgeStyleEl);


  // ── State + element references ─────────────────────────────────────────────
  var enabled  = false;
  var styleEl  = null;
  var overlay  = null;
  var sheet    = null;
  var sticky   = null;

  var currentUrl = '';
  var savedScrollY = 0;
  var savedCardImg = null;
  var savedCardId = null;
  var allCards         = [];
  var currentCardIndex = -1;
  var isNavigating     = false;
  var swipeStartX      = 0;
  var swipeStartY      = 0;
  var swipeAxisLocked  = null;
  var previewObserver  = null;
  var isLoadingMore    = false;
  var lastTrigger      = null;   // element to restore focus to when the popup closes
  var altReqId         = 0;
  var productImages    = [];
  var imgIndex         = 0;
  var imgAnimId        = 0;   // cancels a stale image slide when swiped quickly

  // ── Observability ──────────────────────────────────────────────────────────
  // BUILD_ID is injected by the build (content hash); 'dev' when run unbuilt.
  // Verbose logs are off unless CFG.debug is set or the URL has ?ecommodebug.
  var BUILD_ID = (typeof ECOMMO_BUILD !== 'undefined') ? ECOMMO_BUILD : 'dev';
  var DEBUG = !!(CFG && CFG.debug) || /[?&]ecommodebug\b/i.test(location.search || '');
  function log() {
    if (!DEBUG) return;
    try { console.log.apply(console, ['[ecommo]'].concat([].slice.call(arguments))); } catch (e) {}
  }


  // ── Sheet: extract data, populate, open, close ─────────────────────────────
  function extractCardData(card) {
    var img  = card.querySelector(CFG.imageSelector);
    var link = card.querySelector(CFG.linkSelector) || card.querySelector('a');
    var src  = img ? img.src : '';
    if (src && CFG.upgradeImage) src = CFG.upgradeImage(src);
    var url  = link ? link.href : '';
    var name = CFG.getName ? CFG.getName(card, img) : (img ? img.alt : '');

    var price = '', original = '';
    if (CFG.getPrice) {
      var p = CFG.getPrice(card);
      price = p.price || '';
      original = p.original || '';
    } else {
      // Match on each element's OWN direct text node, not "leaf elements only" —
      // real sites often place a price as bare text right alongside a sibling
      // badge/link element (e.g. Kay: "$449.99" text + a separate "25% off"
      // child span in the same wrapper), so a leaf-only scan finds nothing.
      var priceRe = /[\$\€\£]\s?[\d][\d,]*(?:\.\d+)?/;
      var isStrikethrough = function(el) {
        var node = el;
        while (node) {
          var s = getComputedStyle(node);
          if (s.textDecorationLine.indexOf('line-through') !== -1) return true;
          if (/original|was-price|compare-?at|strike/i.test(node.className || '')) return true;
          if (node === card) break;
          node = node.parentElement;
        }
        return false;
      };
      Array.from(card.querySelectorAll('*')).forEach(function(el) {
        var ownText = Array.from(el.childNodes)
          .filter(function(n) { return n.nodeType === 3; })
          .map(function(n) { return n.textContent; }).join(' ');
        var m = ownText.match(priceRe);
        if (!m) return;
        var t = m[0].replace(/\s+/g, '');
        if (isStrikethrough(el)) original = t;
        else if (!price) price = t;
      });
    }
    return { src: src, url: url, name: name, price: price, original: original, id: card.getAttribute(CFG.cardIdAttr) || null };
  }

  // Shared price-string helpers — used by both the popup (renderInfo) and the
  // catch-up card stack (066-interest.js), so "X% off" always comes from the
  // same math instead of re-scraping a differently-marked-up badge per site.
  function priceToNumber(str) {
    if (!str) return NaN;
    var m = String(str).match(/[\d,]+(?:\.\d+)?/);
    return m ? parseFloat(m[0].replace(/,/g, '')) : NaN;
  }
  function discountPercent(price, original) {
    var p = priceToNumber(price), o = priceToNumber(original);
    if (!p || !o || o <= p) return null;
    return Math.round((1 - p / o) * 100);
  }

  // Single writer for the name / price / strikethrough / financing region.
  // Used by both the gallery path (populateSheet) and the PDP path (applyPdp).
  function renderInfo(vm) {
    document.getElementById('nav-sheet-name').textContent = vm.name || '';
    document.getElementById('nav-sheet-price').textContent = vm.price || '';
    document.getElementById('nav-sheet-orig').textContent = vm.original || '';
    var pct = discountPercent(vm.price, vm.original);
    var offEl = document.getElementById('nav-sheet-off');
    if (offEl) offEl.textContent = pct ? (pct + '% off') : '';

    var priceNum = priceToNumber(vm.price);
    var finEl = document.getElementById('nav-sheet-financing');
    if (priceNum && CFG.creditCardName) {
      var monthly = Math.ceil(priceNum / 18);
      finEl.innerHTML = 'As low as <strong>$' + monthly + '/mo</strong> with ' + CFG.creditCardName + '. <a href="#">Apply Now</a>';
    } else {
      finEl.textContent = '';
    }
  }

  // Single writer for the size buttons. Used by both the gallery path
  // (hardcoded CFG.sizes) and the PDP path (real ringSizes). The click handler
  // is delegated once in enable().
  function renderSizes(sizes, selected) {
    var sizesEl = document.getElementById('nav-sheet-sizes');
    if (!sizesEl) return;
    sizesEl.innerHTML = (sizes || []).map(function(s) {
      var label = String(s);
      return '<button class="nav-sheet-size-btn' + (String(selected) === label ? ' selected' : '') + '">' + label + '</button>';
    }).join('');
  }

  function populateSheet(data) {
    renderInfo({ name: data.name, price: data.price, original: data.original });
    var sizes = CFG.sizes || ['6', '6.5', '7', '7.5', '8'];
    renderSizes(sizes, sizes[2]);
  }

  // Fade an element in. Forces a reflow so the opacity:0 state paints before
  // transitioning to 1 (otherwise the browser skips the animation).
  function fadeInEl(el, fromTransform, toTransform) {
    if (!el) return;
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.style.transform = fromTransform;
    void el.offsetHeight;
    requestAnimationFrame(function() {
      el.style.transition = 'opacity 320ms ease, transform 320ms ease';
      el.style.opacity = '1';
      el.style.transform = toTransform;
    });
  }

  // Fade the product info in as the popup opens. (The metals overlay fades
  // itself via renderSwatches, matching the image counter.)
  function fadeInInfo() {
    fadeInEl(document.getElementById('nav-sheet-info'), 'translateY(6px)', 'translateY(0)');
  }

  // Single "show this gallery item" reset: fills the popup from the gallery
  // card's data and drops any prior PDP enrichment (variants/description), so a
  // previous item can never linger on open or navigate. loadPdp() then enriches.
  function showGalleryData(data) {
    trackInterestOpen(data);
    populateSheet(data);
    if (pdpEnabled()) {
      var code = pdpCurrentCode();
      if (code && pdpCache[code]) {
        // Already fetched — render the full item data straight from cache, so
        // there's no gallery→cache flash on re-open. (Image handled by the morph.)
        applyPdpContent(pdpCache[code]);
      } else {
        // Not cached yet — instant metals from the gallery card as an interim.
        renderGalleryVariants();
      }
    } else {
      renderSwatches();   // DOM-metals row (sites without productApi)
      clearPdp();
    }
  }

  function openSheet(data) {
    currentUrl = data.url;
    var heroImg = document.getElementById('nav-sheet-img');
    heroImg.style.opacity = '0';
    heroImg.alt = data.name;
    heroImg.src = '';
    requestAnimationFrame(function() {
      heroImg.src = data.src;
      heroImg.onload = function() {
        heroImg.style.transition = 'opacity 200ms ease';
        heroImg.style.opacity = '1';
      };
    });
    showGalleryData(data);
    loadProductImages(data.src);
    var pdpCard = allCards[currentCardIndex];
    if (pdpCard) loadPdp(pdpCard.getAttribute(CFG.cardIdAttr));
    savedScrollY = window.scrollY;
    overlay.classList.add('open');
    sheet.classList.add('open');
    sticky.classList.add('open');
    document.body.style.overflow = 'hidden';
    fadeInInfo();
    focusSheet();
  }

  // a11y: move focus into the dialog on open; restore to the trigger on close.
  function focusSheet() {
    var b = document.getElementById('nav-sheet-back');
    if (!b) return;
    try { b.focus({ preventScroll: true }); } catch (e) { b.focus(); }
  }
  function restoreTriggerFocus() {
    if (lastTrigger && lastTrigger.focus) {
      try { lastTrigger.focus({ preventScroll: true }); } catch (e) {}
    }
    lastTrigger = null;
  }

  function closeSheet() {
    endDwell();
    allCards = []; currentCardIndex = -1; isNavigating = false; swipeAxisLocked = null;
    catchUpMode = false;   // next open (a normal card tap) must see the full gallery list again
    updateCatchUpIcon();
    altReqId++; pdpReqId++;
    productImages = []; imgIndex = 0;
    updateImageUI();
    if (typeof clearPdp === 'function') clearPdp();
    var heroImg = document.getElementById('nav-sheet-img');

    if (document.startViewTransition && savedCardId) {
      document.body.style.overflow = '';
      window.scrollTo({ top: savedScrollY, behavior: 'instant' });

      var freshCard = document.querySelector(CFG.cardSelector + '[' + CFG.cardIdAttr + '="' + savedCardId + '"]');
      if (freshCard) {
        savedCardImg = freshCard.querySelector(CFG.imageSelector) || savedCardImg;
      }

      heroImg.style.viewTransitionName = 'product-hero';

      var closeCleanup = function() {
        if (savedCardImg) savedCardImg.style.viewTransitionName = '';
        heroImg.style.viewTransitionName = '';
        sheet.style.transition = '';
        sticky.style.transition = '';
        savedCardImg = null;
        savedCardId = null;
        restoreTriggerFocus();
      };

      document.startViewTransition(function() {
        heroImg.style.viewTransitionName = '';
        savedCardImg.style.viewTransitionName = 'product-hero';
        sheet.style.transition = 'none';
        sticky.style.transition = 'none';
        overlay.classList.remove('open');
        sheet.classList.remove('open');
        sticky.classList.remove('open');
        sheet.scrollTop = 0;
      }).finished.then(closeCleanup, closeCleanup);
    } else {
      overlay.classList.remove('open');
      sheet.classList.remove('open');
      sticky.classList.remove('open');
      document.body.style.overflow = '';
      sheet.scrollTop = 0;
      window.scrollTo({ top: savedScrollY, behavior: 'instant' });
      savedCardImg = null;
      restoreTriggerFocus();
    }
  }


  // ── Swipe navigation (between gallery products) ────────────────────────────
  function refreshAllCards() {
    var currentCardId = savedCardId || (allCards[currentCardIndex] ? allCards[currentCardIndex].getAttribute(CFG.cardIdAttr) : null);
    // "Catch up" mode (066-interest.js) scopes Next/Prev to interesting items
    // only, highest-scoring first — everything else about navigation
    // (sticky bar, swipe, view-transition) is unchanged, it just walks a
    // different list.
    allCards = catchUpMode
      ? interestingIdsSorted().map(findCardById).filter(Boolean)
      : Array.from(document.querySelectorAll(CFG.cardSelector));
    if (currentCardId) {
      var idx = allCards.findIndex(function(card) {
        return card.getAttribute(CFG.cardIdAttr) === currentCardId;
      });
      if (idx >= 0) currentCardIndex = idx;
    }
  }

  function findLoadMoreButton() {
    if (CFG.loadMoreSelector) {
      var button = document.querySelector(CFG.loadMoreSelector);
      if (button && !button.disabled && button.getAttribute('aria-disabled') !== 'true') return button;
    }

    var candidates = Array.from(document.querySelectorAll('button, [role="button"], a'));
    for (var i = 0; i < candidates.length; i++) {
      var button = candidates[i];
      if (button.disabled || button.getAttribute('aria-disabled') === 'true') continue;
      var text = (button.textContent || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (!text) continue;
      if (text.indexOf('load more') !== -1 || text.indexOf('show more') !== -1 || text.indexOf('view more') !== -1) return button;
      if (/^more( products| results)?$/.test(text)) return button;
      if (/more products?$/.test(text)) return button;
      if (/more results?$/.test(text)) return button;
    }

    return document.querySelector('.load-more, .btn-load-more, .show-more, .more-btn, [data-load-more]');
  }

  function waitForMoreCards(oldCount, callback) {
    var finished = false;
    var observer = new MutationObserver(function() {
      if (finished) return;
      if (document.querySelectorAll(CFG.cardSelector).length > oldCount) {
        finished = true;
        observer.disconnect();
        clearTimeout(timeoutId);
        callback(true);
      }
    });

    var timeoutId = setTimeout(function() {
      if (finished) return;
      finished = true;
      observer.disconnect();
      callback(false);
    }, 4000);

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function loadMoreCardsAndContinue(direction) {
    if (isLoadingMore) return false;
    var button = findLoadMoreButton();
    if (!button) return false;

    var oldCount = document.querySelectorAll(CFG.cardSelector).length;
    isLoadingMore = true;
    button.click();
    updateNavUI();

    waitForMoreCards(oldCount, function(success) {
      isLoadingMore = false;
      refreshAllCards();
      updateNavUI();
      // NOTE: do NOT auto-advance after loading more items. The gallery
      // should only append new cards; navigation (advance) remains manual
      // and will occur when the user presses the next/prev controls.
    });

    return true;
  }

  function cardName(card) {
    if (!card) return '';
    var img = card.querySelector(CFG.imageSelector);
    return (CFG.getName ? CFG.getName(card, img) : (img ? img.alt : '')) || '';
  }

  function cardThumb(card) {
    if (!card) return '';
    var img = card.querySelector(CFG.imageSelector);
    return img ? img.src : '';
  }

  // Transparent 1x1 gif — placeholder src so the thumb shows its tint box
  // (no broken-image icon) when there's no adjacent item.
  var BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

  // Fill a Prev/Next button with the adjacent product's title + thumbnail.
  // Keep both slots reserved when there's no adjacent item (first/last product)
  // so the layout stays in place: title keeps its line (nbsp), thumb stays as
  // the placeholder tint box.
  function setNavButton(nameEl, thumbEl, card) {
    if (nameEl) nameEl.textContent = cardName(card) || ' ';
    if (thumbEl) thumbEl.src = cardThumb(card) || BLANK_IMG;
  }

  // Prefetch (optional): warm the browser cache for the adjacent item's hero
  // image on hover/focus, so clicking Prev/Next transitions instantly.
  var prefetched = {};
  function prefetchAdjacent(direction) {
    var card = allCards[currentCardIndex + (direction === 'next' ? 1 : -1)];
    if (!card) return;
    var img = card.querySelector(CFG.imageSelector);
    if (!img || !img.src) return;
    var src = CFG.upgradeImage ? CFG.upgradeImage(img.src) : img.src;
    if (prefetched[src]) return;
    prefetched[src] = true;
    var pre = new Image();
    pre.src = src;
  }

  function updateNavUI() {
    var counter = document.getElementById('nav-sheet-counter');
    var prevBtn = document.getElementById('nav-sheet-sticky-prev');
    var nextBtn = document.getElementById('nav-sheet-sticky-next');
    if (allCards.length > 1) {
      counter.style.visibility = 'visible';
      counter.textContent = (currentCardIndex + 1) + ' / ' + allCards.length;
    } else {
      counter.style.visibility = 'hidden';
    }

    // Show the adjacent products' title + thumbnail in the Prev / Next buttons.
    setNavButton(
      document.getElementById('nav-sheet-sticky-prev-name'),
      document.getElementById('nav-sheet-sticky-prev-thumb'),
      allCards[currentCardIndex - 1]
    );
    setNavButton(
      document.getElementById('nav-sheet-sticky-next-name'),
      document.getElementById('nav-sheet-sticky-next-thumb'),
      allCards[currentCardIndex + 1]
    );
    prevBtn.disabled = (currentCardIndex <= 0) || isLoadingMore;
    // In catch-up mode, reaching the end just means "you're done" — a site
    // "load more" button existing elsewhere on the page is irrelevant to
    // this fixed, already-known list.
    nextBtn.disabled = ((currentCardIndex >= allCards.length - 1) && (catchUpMode || !findLoadMoreButton())) || isLoadingMore;

    // Auto-load more items when the sheet is open and the preview is on the
    // last currently-loaded card. This triggers the same load-more action
    // used by the gallery button, but only once per load cycle. Skipped
    // entirely in catch-up mode (see nextBtn.disabled comment above).
    try {
      var sheetEl = document.getElementById('nav-sheet');
      if (!catchUpMode && sheetEl && sheetEl.classList.contains('open') && allCards.length && currentCardIndex >= allCards.length - 1) {
        var loadBtn = findLoadMoreButton();
        if (loadBtn && !isLoadingMore) {
          // Don't advance index here — loadMoreCardsAndContinue will refresh
          // the list and continue navigation when appropriate.
          loadMoreCardsAndContinue('next');
        }
      }
    } catch (e) { /* ignore DOM issues */ }
  }

  function navigateSheet(direction) {
    if (isNavigating) return;
    var nextIndex = currentCardIndex + (direction === 'next' ? 1 : -1);
    if (nextIndex < 0) return;
    if (nextIndex >= allCards.length) {
      // Catch-up mode's list is a fixed set of already-known interesting
      // items, not a paginated gallery — never trigger the site's own
      // "load more" from here (reaching the end just means you're done).
      if (!catchUpMode && direction === 'next' && loadMoreCardsAndContinue(direction)) return;
      return;
    }
    isNavigating = true;

    var slideEl = document.getElementById('nav-sheet-slide');
    var heroImg = document.getElementById('nav-sheet-img');
    var exitClass = direction === 'next' ? 'slide-exit-left' : 'slide-exit-right';
    slideEl.classList.add(exitClass);

    setTimeout(function() {
      currentCardIndex = nextIndex;
      var nextCard = allCards[currentCardIndex];
      savedCardId  = nextCard.getAttribute(CFG.cardIdAttr);
      savedCardImg = nextCard.querySelector(CFG.imageSelector) || null;

      // Scroll the gallery card into view. Temporarily unlock body scroll since
      // we set overflow: hidden on the sheet open. Capture the scroll position
      // after the smooth scroll completes (~400ms buffer).
      var wasHidden = document.body.style.overflow === 'hidden';
      if (wasHidden) document.body.style.overflow = '';
      if (nextCard.scrollIntoView) {
        nextCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // Capture scroll position after smooth scroll finishes.
        setTimeout(function() { savedScrollY = window.scrollY; }, 450);
      }
      if (wasHidden) document.body.style.overflow = 'hidden';

      var data = extractCardData(nextCard);
      currentUrl = data.url;
      log('navigate ->', savedCardId);
      showGalleryData(data);                            // reset to new gallery item (drops prev PDP data)
      loadPdp(savedCardId);

      heroImg.style.transition = 'none';
      heroImg.style.opacity = '0';
      heroImg.alt = data.name;
      heroImg.src = '';

      slideEl.classList.remove(exitClass);
      slideEl.style.transition = 'none';
      slideEl.style.transform  = direction === 'next' ? 'translateX(15%)' : 'translateX(-15%)';
      slideEl.style.opacity    = '0';
      void slideEl.offsetWidth;

      sheet.scrollTop = 0;

      requestAnimationFrame(function() {
        slideEl.style.transition = '';
        slideEl.style.transform  = '';
        slideEl.style.opacity    = '';
        slideEl.classList.add('slide-enter');

        var expectedSrc = data.src;
        heroImg.src = expectedSrc;
        heroImg.onload = function() {
          if (heroImg.src.indexOf(expectedSrc.split('/').pop()) === -1) return;
          heroImg.style.transition = 'opacity 200ms ease';
          heroImg.style.opacity = '1';
        };
        loadProductImages(data.src);
      });

      updateNavUI();

      setTimeout(function() {
        slideEl.classList.remove('slide-enter');
        isNavigating = false;
      }, 280);

    }, 160);
  }


  // ── Lifestyle / extra images (PDP-style gallery inside the popup) ──────────
  // The PDP's extra shots share the gallery image URL with a higher index:
  //   .../V-<id>_0_800.jpg  →  _1_, _2_, _3_ ...
  // We load them as plain <img> (no fetch) and probe sequentially until one 404s.
  function buildAltUrl(heroSrc, i) {
    if (CFG.altImageUrl) return CFG.altImageUrl(heroSrc, i);
    return heroSrc.replace(/_0_/, '_' + i + '_');
  }

  function updateImageUI() {
    var counter = document.getElementById('nav-sheet-imgcount');
    var bar = document.getElementById('nav-sheet-progress');
    if (!counter || !bar) return;
    if (productImages.length > 1) {
      counter.textContent = (imgIndex + 1) + ' / ' + productImages.length;
      // Fixed-width thumb (one segment) that slides to the current image.
      bar.firstChild.style.width = (100 / productImages.length) + '%';
      bar.firstChild.style.transform = 'translateX(' + (imgIndex * 100) + '%)';
      // Fade in (opacity transition — display can't animate).
      counter.style.opacity = '1';
      bar.style.opacity = '1';
    } else {
      counter.style.opacity = '0';
      bar.style.opacity = '0';
    }
  }

  // Directional slide between a product's images. Preloads the target and only
  // swaps src once it's ready, so there's no wrong-image flash. dir: 'next'
  // slides left, 'prev' slides right.
  function showProductImage(idx, dir) {
    if (idx < 0 || idx >= productImages.length || idx === imgIndex) return;
    trackInterestInteraction(interestAnchorId, 'image');
    imgIndex = idx;
    updateImageUI();
    var src = productImages[idx];
    var hero = document.getElementById('nav-sheet-img');
    if (!hero) return;
    var myAnim = ++imgAnimId;
    var d = (dir === 'prev') ? 1 : -1;   // next → out to left, prev → out to right

    // 1) slide the current image out in the swipe direction
    hero.style.transition = 'transform 160ms ease, opacity 160ms ease';
    hero.style.transform = 'translateX(' + (d * 35) + '%)';
    hero.style.opacity = '0';

    setTimeout(function () {
      if (myAnim !== imgAnimId) return;
      // 2) swap to the new image while it's invisible + parked on the far side
      hero.src = src;
      hero.style.transition = 'none';
      hero.style.transform = 'translateX(' + (-d * 35) + '%)';
      void hero.offsetWidth;
      // 3) slide/fade in ONLY once the new image is actually decoded, so the
      //    old frame never shows during the fade-in (no prev-image flash).
      var slideIn = function () {
        if (myAnim !== imgAnimId) return;
        hero.style.transition = 'transform 220ms cubic-bezier(0.25,0.46,0.45,0.94), opacity 200ms ease';
        hero.style.transform = 'translateX(0)';
        hero.style.opacity = '1';
      };
      if (hero.decode) hero.decode().then(slideIn, slideIn);
      else slideIn();
    }, 160);
  }

  function loadProductImages(heroSrc) {
    // Show only the hero until the full set is known, so the counter/bar don't
    // resize and jump while images are still being discovered.
    productImages = [heroSrc];
    imgIndex = 0;
    updateImageUI();

    // When the PDP API is configured, the full image list (incl. lifestyle)
    // comes from the product data — skip the URL probing.
    if (pdpEnabled()) return;

    var myReq = ++altReqId;       // cancels any in-flight probe from a previous product
    var max = CFG.maxAltImages || 8;
    var collected = [heroSrc];    // built up off-screen, committed once at the end

    function finalize() {
      if (myReq !== altReqId) return;            // product changed mid-probe — discard
      productImages = collected;
      imgIndex = 0;
      updateImageUI();                           // single update with the final count
    }

    function probe(i) {
      if (i > max) return finalize();
      var url = buildAltUrl(heroSrc, i);
      if (!url || url === heroSrc) return finalize();
      var test = new Image();
      test.onload = function() {
        if (myReq !== altReqId) return;
        if (test.naturalWidth < 2) return finalize();  // 1px placeholder = no more images
        collected.push(url);
        probe(i + 1);
      };
      test.onerror = function() { finalize(); };        // gap reached — commit what we have
      test.src = url;
    }
    probe(1);
  }


  // ── Event handlers (named so they can be detached on disable) ──────────────
  function onTouchStart(e) {
    if (isNavigating) return;
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
    swipeAxisLocked = null;
  }
  function onTouchMove(e) {
    if (isNavigating || swipeAxisLocked === 'v') return;
    var dx = e.touches[0].clientX - swipeStartX;
    var dy = e.touches[0].clientY - swipeStartY;
    if (swipeAxisLocked === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      swipeAxisLocked = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
      if (swipeAxisLocked === 'v') trackInterestInteraction(interestAnchorId, 'scroll');
    }
    if (swipeAxisLocked === 'h') e.preventDefault();
  }
  // Dialog a11y: Escape closes; focus can't wander to the page behind.
  function onSheetKeydown(e) {
    if (!sheet || !sheet.classList.contains('open')) return;
    if (e.key === 'Escape' || e.keyCode === 27) { e.preventDefault(); closeSheet(); }
  }
  function onSheetFocusGuard(e) {
    if (!sheet || !sheet.classList.contains('open')) return;
    var t = e.target;
    if (sheet.contains(t) || (sticky && sticky.contains(t)) || (badge && badge.contains(t))) return;
    var back = document.getElementById('nav-sheet-back');
    if (back) back.focus();
  }

  function onTouchEnd(e) {
    if (isNavigating || swipeAxisLocked !== 'h') return;
    var dx = e.changedTouches[0].clientX - swipeStartX;
    if (Math.abs(dx) < 60 || productImages.length <= 1) return;
    // Swipe pages through this product's images (item navigation is via the
    // Prev/Next buttons). Swipe left → next image, right → previous, wrapping.
    if (dx < 0) showProductImage((imgIndex + 1) % productImages.length, 'next');
    else showProductImage((imgIndex - 1 + productImages.length) % productImages.length, 'prev');
  }

  // Shared by the gallery card's preview button and the catch-up icon
  // (066-interest.js's createCatchUpIcon) — same eye markup everywhere so it
  // reads as one consistent visual language for "interest".
  function previewSvgMarkup() {
    return CFG.previewSvg || (typeof PREVIEW_SVG !== 'undefined' ? PREVIEW_SVG : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path class="nav-preview-eye-outline" d="M12 5C7 5 2.73 8.11 1 12C2.73 15.89 7 19 12 19C17 19 21.27 15.89 23 12C21.27 8.11 17 5 12 5Z" stroke="currentColor" stroke-width="1.75" fill="none"/><circle class="nav-preview-eye-pupil" cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="white"/></svg>');
  }

  function addCardPreviewButtons() {
    if (CFG.previewEnabled === false || cardsOnly()) return;
    var svg = previewSvgMarkup();
    var extraClass = CFG.previewClass || '';
    var label = CFG.previewLabel || 'Quick preview';

    Array.from(document.querySelectorAll(CFG.cardSelector)).forEach(function(card) {
      if (card.querySelector('.nav-card-preview')) return;

      var favCandidates = Array.from(card.querySelectorAll('button, a, [role="button"]'));
      var favEl = favCandidates.find(function(el) {
        var txt = (el.textContent || '').trim().toLowerCase();
        var htmlLower = (el.innerHTML || '').toLowerCase();
        if (!txt && !htmlLower) return false;
        if (txt.indexOf('wish') !== -1 || txt.indexOf('fav') !== -1 || txt.indexOf('favorite') !== -1 || txt.indexOf('wishlist') !== -1) return true;
        if (htmlLower.indexOf('&#9825;') !== -1 || htmlLower.indexOf('&#9829;') !== -1) return true;
        if (/[♥♡]/.test(txt + htmlLower)) return true;
        return false;
      }) || card.querySelector('.favorite, .fav, .wish, .js-wish, .btn-favorite, [data-fav], [data-wish]');

      if (!favEl) return;

      var favParent = favEl.parentElement;
      if (!favParent) return;
      favParent.style.display = 'inline-flex';
      favParent.style.float = 'right';
      favParent.style.gap = '5px';

      var preview = document.createElement('button');
      preview.type = 'button';
      preview.className = ('nav-card-preview ' + extraClass).trim();
      preview.title = label;
      preview.setAttribute('aria-label', label);
      preview.innerHTML = svg;
      preview.style.display = 'inline-flex';
      preview.style.alignItems = 'center';
      preview.style.justifyContent = 'center';
      preview.style.textAlign = 'center';
      preview.style.verticalAlign = 'middle';

      if (favEl.tagName === 'BUTTON' || favEl.tagName === 'A') {
        favEl.style.display = 'inline-flex';
        favEl.style.alignItems = 'center';
        favEl.style.justifyContent = 'center';
      }

      var fs = getComputedStyle(favEl);
      if (fs.width && fs.width !== '0px' && fs.width !== 'auto') preview.style.width = fs.width;
      if (fs.height && fs.height !== '0px' && fs.height !== 'auto') preview.style.height = fs.height;
      if (fs.padding) preview.style.padding = fs.padding;
      if (fs.margin) preview.style.margin = fs.margin;
      if (fs.border) preview.style.border = fs.border;
      if (fs.borderRadius) preview.style.borderRadius = fs.borderRadius;
      if (fs.backgroundColor) preview.style.backgroundColor = fs.backgroundColor;
      if (fs.color) preview.style.color = fs.color;
      if (fs.fontSize) preview.style.fontSize = fs.fontSize;
      if (fs.fontWeight) preview.style.fontWeight = fs.fontWeight;
      if (fs.cursor) preview.style.cursor = fs.cursor;
      if (fs.lineHeight) preview.style.lineHeight = fs.lineHeight;

      favParent.insertBefore(preview, favEl);
    });
  }

  function removeCardPreviewButtons() {
    Array.from(document.querySelectorAll('.nav-card-preview')).forEach(function(button) {
      button.remove();
    });
  }

  function onPreviewClick(e) {
    var previewButton = e.target.closest('.nav-card-preview');
    if (!previewButton) return;

    var card = previewButton.closest(CFG.cardSelector);
    if (!card) return;

    e.preventDefault();
    e.stopPropagation();

    openSheetForCard(card, previewButton);
  }

  // Open the sheet for an arbitrary already-resolved card, with the same
  // view-transition morph onPreviewClick uses — factored out so any other
  // trigger (e.g. 066-interest.js's "catch up" icon) can open a card that
  // isn't itself a clicked preview button. `triggerEl` is only used for
  // restoreTriggerFocus() on close.
  function openSheetForCard(card, triggerEl) {
    lastTrigger = triggerEl;   // restore focus here when the popup closes

    var data = extractCardData(card);
    var cardImg = card.querySelector(CFG.imageSelector);
    var heroImg = document.getElementById('nav-sheet-img');

    refreshAllCards();
    currentCardIndex = allCards.indexOf(card);

    if (!document.startViewTransition || !cardImg) {
      openSheet(data);
      updateNavUI();
      return;
    }

    currentUrl = data.url;
    heroImg.src = cardImg.src;
    heroImg.style.opacity = '1';
    heroImg.style.transition = 'none';
    showGalleryData(data);

    savedCardImg = cardImg;
    savedCardId = card.getAttribute(CFG.cardIdAttr);

    cardImg.style.viewTransitionName = 'product-hero';

    var openCleanup = function() {
      heroImg.style.viewTransitionName = '';
      sheet.style.transition = '';
      sticky.style.transition = '';
    };

    document.startViewTransition(function() {
      cardImg.style.viewTransitionName = '';
      heroImg.style.viewTransitionName = 'product-hero';
      sheet.style.transition = 'none';
      sticky.style.transition = 'none';
      savedScrollY = window.scrollY;
      overlay.classList.add('open');
      sheet.classList.add('open');
      sticky.classList.add('open');
      document.body.style.overflow = 'hidden';
    }).finished.then(function() {
      heroImg.src = data.src;
      loadProductImages(data.src);
      loadPdp(savedCardId);
      updateNavUI();
      focusSheet();
    }).then(openCleanup, openCleanup);
    // Fade the info in immediately as the popup opens (concurrent with the
    // hero morph), not after the transition finishes.
    fadeInInfo();
  }


  // ── Dislike ("not for me") — purely a signal now, not a gallery filter ─────
  // Marking a product disliked no longer hides it from the gallery, doesn't
  // touch Next/Prev, and has no dedicated UI of its own (no swipe-to-dismiss,
  // no results-count adjustment, no restore button). Its only remaining
  // effect: 066-interest.js's isInteresting()/interestingIdsSorted() exclude
  // disliked ids, so the ONLY thing "removal" does is drop a product out of
  // the catch-up list — via the card-stack's swipe-left (066-interest.js).
  // Persisted in localStorage (fail-soft — never throws into the rest of the
  // engine).
  var dislikeOrder = loadDislikeOrder();   // ordered array of disliked ids — not a {id:true} map, so it doesn't depend on JS's insertion-order-preserving object keys (breaks if ids are numeric strings)

  function dislikedStorageKey() {
    return 'ecommo_disliked_' + (CFG.siteName || location.hostname).replace(/\s+/g, '_');
  }

  function loadDislikeOrder() {
    try {
      var raw = localStorage.getItem(dislikedStorageKey());
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveDislikeOrder() {
    try {
      localStorage.setItem(dislikedStorageKey(), JSON.stringify(dislikeOrder));
    } catch (e) { /* private mode / quota — degrade to session-only */ }
  }

  function isDisliked(id) { return dislikeOrder.indexOf(id) !== -1; }

  // Runs once on load (immediately or after DOMContentLoaded) AND is the
  // stable function reference enable()/disable() add/remove.
  function onInitialCardsReady() {
    addCardPreviewButtons();
    updateGalleryInterestIcons();
    updateCatchUpIcon();
    updateCardStackIcon();
  }

  function findCardById(id) {
    return document.querySelector(CFG.cardSelector + '[' + CFG.cardIdAttr + '="' + id + '"]');
  }

  // The only way a product becomes disliked now: the "catch up" card-stack's
  // swipe-left (066-interest.js). Just records the signal — no gallery/sheet
  // visibility to react to anymore.
  function commitDisliked(id) {
    var idx = dislikeOrder.indexOf(id);
    if (idx !== -1) dislikeOrder.splice(idx, 1);   // shouldn't normally happen, but keeps it unique + moves it last
    dislikeOrder.push(id);
    saveDislikeOrder();
    renderInterestPanel(id);   // strike the row through if it's already shown — see 066-interest.js
    updateCatchUpIcon();       // may have just dropped the last interesting item
  }

  // A shopper coming back to a disliked product and genuinely interacting
  // with it (image swipe, metal/variant pick, scroll — see
  // trackInterestInteraction in 066-interest.js) reads as renewed interest,
  // strong enough to reverse the earlier "Not for me" — the product goes
  // back into the interesting/catch-up list instead of staying stuck as
  // removed forever. No-op if it isn't currently disliked.
  function undoDislikeIfInteracted(id) {
    var idx = dislikeOrder.indexOf(id);
    if (idx === -1) return;
    dislikeOrder.splice(idx, 1);
    saveDislikeOrder();
    renderInterestPanel(id);
    updateGalleryInterestIcons();
    updateCatchUpIcon();
  }

  // Swaps the open sheet's content to an arbitrary card — same steps as a
  // Prev/Next navigation, just not restricted to a neighbor. Shared by the
  // "catch up" popup style (066-interest.js's startCatchUpPopup) and
  // jumpToProduct() (066-interest.js, debug-panel row click).
  function switchSheetTo(card) {
    currentCardIndex = allCards.indexOf(card);
    savedCardId = card.getAttribute(CFG.cardIdAttr);
    savedCardImg = card.querySelector(CFG.imageSelector) || null;

    // Keep savedScrollY pointing at THIS card's real position (same trick as
    // navigateSheet's own scrollIntoView) — otherwise closeSheet() later
    // scrolls back to wherever the page was before this switch, while the
    // view-transition target (savedCardImg) is this card, which may be
    // off-screen there — animation looks broken/misaligned.
    var wasHidden = document.body.style.overflow === 'hidden';
    if (wasHidden) document.body.style.overflow = '';
    if (card.scrollIntoView) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(function() { savedScrollY = window.scrollY; }, 450);
    }
    if (wasHidden) document.body.style.overflow = 'hidden';

    var data = extractCardData(card);
    currentUrl = data.url;
    showGalleryData(data);
    loadPdp(savedCardId);

    var heroImg = document.getElementById('nav-sheet-img');
    if (heroImg) heroImg.src = data.src;
    loadProductImages(data.src);

    updateNavUI();
  }


  // ── Generic swipeable card-stack overlay — shared by 066-interest.js's
  // "catch up" (interesting items) flow and 067-cardstack.js (browse the
  // whole gallery, like/dislike). Only ONE stack can ever be open at a time,
  // so there's a single overlay element rather than one per feature. Callers
  // supply their own already-resolved items ({id, name, price, original, src}
  // — the exact shape both interestData[id].productSnapshot and
  // extractCardData() already produce, so neither caller needs to convert)
  // plus swipe-right/swipe-left callbacks and hint labels; this module owns
  // only the rendering/drag/fly-off mechanics, never what a swipe *means*.
  var swipeStackOverlay = null;
  var swipeStackTrack = null;
  var swipeQueue = [];
  var swipeIndex = 0;
  var swipeOpts = null;

  function ensureSwipeStackOverlay() {
    if (swipeStackOverlay) return;
    swipeStackOverlay = document.createElement('div');
    swipeStackOverlay.id = 'nav-swipestack-overlay';
    swipeStackOverlay.innerHTML =
      '<button type="button" id="nav-swipestack-close" aria-label="Close">&#10005;</button>' +
      '<div id="nav-swipestack-track"></div>' +
      '<div id="nav-swipestack-done">Done!</div>';
    document.body.appendChild(swipeStackOverlay);
    swipeStackTrack = swipeStackOverlay.querySelector('#nav-swipestack-track');
    swipeStackOverlay.querySelector('#nav-swipestack-close').addEventListener('click', closeSwipeStack);
    // Tap the dimmed background (not the card stack itself) to exit — only
    // fires when the click target IS the overlay, not a descendant.
    swipeStackOverlay.addEventListener('click', function(e) {
      if (e.target === swipeStackOverlay) closeSwipeStack();
    });
  }

  // queue: array of {id, name, price, original, src}. opts: { hintRight,
  // hintLeft, onSwipeRight(item), onSwipeLeft(item), onClose() }.
  function openSwipeStack(queue, opts) {
    ensureSwipeStackOverlay();
    swipeQueue = queue || [];
    swipeIndex = 0;
    swipeOpts = opts || {};
    swipeStackOverlay.classList.remove('done');
    swipeStackOverlay.classList.add('open');
    renderSwipeStack();
  }

  // Full teardown — called from removeCatchUpIcon()/removeCardStackIcon()
  // (066/067) as part of disable()/removeBadge(), so a re-paste always starts
  // clean. Idempotent: safe to call with nothing open, and safe to call twice
  // (both callers do, since either feature might have already torn it down).
  function removeSwipeStackOverlay() {
    if (swipeStackOverlay) { swipeStackOverlay.remove(); swipeStackOverlay = null; swipeStackTrack = null; }
    swipeQueue = [];
    swipeIndex = 0;
    swipeOpts = null;
  }

  function closeSwipeStack() {
    if (swipeStackOverlay) swipeStackOverlay.classList.remove('open');
    var onClose = swipeOpts && swipeOpts.onClose;
    swipeOpts = null;
    if (onClose) onClose();
  }

  // Renders up to 3 cards (top + two peeking behind) from the current
  // position in swipeQueue — no peek on the last card. Once the queue is
  // exhausted, shows a brief "done" beat then auto-closes.
  function renderSwipeStack() {
    if (!swipeStackTrack) return;
    if (swipeIndex >= swipeQueue.length) {
      swipeStackTrack.innerHTML = '';
      swipeStackOverlay.classList.add('done');
      // Fires once, right here — distinct from onClose (which also fires on
      // an early X-close/tap-outside, and again after the auto-close timer
      // below). A caller that only cares about "the shopper actually swiped
      // through everything" (e.g. 067-cardstack.js's liked-items report)
      // wants THIS, not onClose.
      if (swipeOpts && swipeOpts.onDone) swipeOpts.onDone();
      setTimeout(closeSwipeStack, 1100);
      return;
    }
    var slice = swipeQueue.slice(swipeIndex, swipeIndex + 3);
    // Generic hook — fires once per distinct top card, whatever that means
    // to the caller (e.g. 086-iteminfo.js's per-item PDP cache). This engine
    // stays content-blind: it just reports "this item is now on top", never
    // what a feature does with that.
    if (swipeOpts && swipeOpts.onCardShown && slice[0]) swipeOpts.onCardShown(slice[0]);
    var hintRight = (swipeOpts && swipeOpts.hintRight) || 'KEEP';
    var hintLeft = (swipeOpts && swipeOpts.hintLeft) || 'REMOVE';
    swipeStackTrack.innerHTML = slice.map(function(item, i) {
      var img = item.src ? '<img src="' + pdpEsc(item.src) + '" alt="">' : '';
      var pct = discountPercent(item.price, item.original);
      var origHtml = item.original ? '<span class="nav-swipestack-card-orig">' + pdpEsc(item.original) + '</span>' : '';
      var offHtml = pct ? '<span class="nav-price-off-badge">' + pct + '% off</span>' : '';
      // Hint labels only matter on the top (draggable) card, but harmless to
      // include on every card — always opacity:0 until dragged.
      return '<div class="nav-swipestack-card" data-depth="' + i + '" data-id="' + pdpEsc(item.id) + '">' + img +
        '<div class="nav-swipestack-card-info">' +
        '<div class="nav-swipestack-card-name">' + pdpEsc(item.name || '') + '</div>' +
        '<div class="nav-swipestack-card-price-row">' + origHtml +
        '<span class="nav-swipestack-card-price">' + pdpEsc(item.price || '') + '</span>' + offHtml + '</div>' +
        '</div>' +
        '<div class="nav-swipestack-card-hint nav-swipestack-hint-right">' + pdpEsc(hintRight) + '</div>' +
        '<div class="nav-swipestack-card-hint nav-swipestack-hint-left">' + pdpEsc(hintLeft) + '</div>' +
        '</div>';
    }).join('');
    wireSwipeCardSwipe(swipeStackTrack.querySelector('.nav-swipestack-card[data-depth="0"]'));
  }

  // Bidirectional drag on the top card only (dedicated listeners scoped to
  // that one element, not document-level) — a centered stack card takes its
  // direction live from the drag, unlike a fixed "outward" swipe-to-dismiss.
  var swipeDrag = null;
  var SWIPESTACK_THRESHOLD = 0.35;
  var SWIPESTACK_TILT = -3;   // static resting tilt (deg) so the top card reads as a held card, not a flat rectangle

  function wireSwipeCardSwipe(cardEl) {
    if (!cardEl) return;
    cardEl.addEventListener('touchstart', onSwipeCardTouchStart, { passive: true });
    cardEl.addEventListener('touchmove', onSwipeCardTouchMove, { passive: false });
    cardEl.addEventListener('touchend', onSwipeCardTouchEnd, { passive: true });
  }

  function onSwipeCardTouchStart(e) {
    var el = e.currentTarget;
    swipeDrag = {
      el: el, id: el.getAttribute('data-id'),
      startX: e.touches[0].clientX, startY: e.touches[0].clientY,
      axisLocked: null, lastDx: 0, width: el.getBoundingClientRect().width || 1,
      rightHint: el.querySelector('.nav-swipestack-hint-right'),
      leftHint: el.querySelector('.nav-swipestack-hint-left')
    };
  }

  function onSwipeCardTouchMove(e) {
    if (!swipeDrag) return;
    var dx = e.touches[0].clientX - swipeDrag.startX;
    var dy = e.touches[0].clientY - swipeDrag.startY;
    if (swipeDrag.axisLocked === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      swipeDrag.axisLocked = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
    }
    if (swipeDrag.axisLocked !== 'h') return;
    e.preventDefault();
    swipeDrag.lastDx = dx;
    swipeDrag.el.style.transition = 'none';
    swipeDrag.el.style.transform = 'translateX(' + dx + 'px) rotate(' + (SWIPESTACK_TILT + dx / 18) + 'deg)';
    // Ramp each hint's opacity to full exactly at the commit threshold, so
    // the color/label IS the indicator of "release now and this happens".
    var ratio = Math.max(-1, Math.min(1, dx / (swipeDrag.width * SWIPESTACK_THRESHOLD)));
    if (swipeDrag.rightHint) swipeDrag.rightHint.style.opacity = String(Math.max(0, ratio));
    if (swipeDrag.leftHint) swipeDrag.leftHint.style.opacity = String(Math.max(0, -ratio));
  }

  function onSwipeCardTouchEnd() {
    if (!swipeDrag) return;
    var d = swipeDrag;
    swipeDrag = null;
    if (d.axisLocked !== 'h') return;

    if (Math.abs(d.lastDx) / d.width >= SWIPESTACK_THRESHOLD) {
      var right = d.lastDx > 0;
      var vw = window.innerWidth || document.documentElement.clientWidth;
      var flyTo = (d.lastDx > 0 ? 1 : -1) * (d.width + vw);
      d.el.style.transition = 'transform 200ms ease, opacity 200ms ease';
      d.el.style.transform = 'translateX(' + flyTo + 'px) rotate(' + (SWIPESTACK_TILT + flyTo / 18) + 'deg)';
      d.el.style.opacity = '0';
      var item = swipeQueue[swipeIndex];
      var opts = swipeOpts;
      setTimeout(function() {
        if (opts) {
          if (right) { if (opts.onSwipeRight) opts.onSwipeRight(item); }
          else { if (opts.onSwipeLeft) opts.onSwipeLeft(item); }
        }
        swipeIndex++;
        renderSwipeStack();
      }, 200);
    } else {
      d.el.style.transition = 'transform 200ms ease';
      d.el.style.transform = 'rotate(' + SWIPESTACK_TILT + 'deg)';
      if (d.rightHint) d.rightHint.style.transition = 'opacity 200ms ease';
      if (d.leftHint) d.leftHint.style.transition = 'opacity 200ms ease';
      if (d.rightHint) d.rightHint.style.opacity = '0';
      if (d.leftHint) d.leftHint.style.opacity = '0';
    }
  }


  // ── Interest tracking (per-site optional via CFG.interestEnabled) ──────────
  // Phase 1: implicit understanding only — no new UI. "Interest" is inferred
  // from interaction depth (image swipes, metal/shape/carat/quality variant
  // picks, in-popup scrolling) AND the dwell time of a visit — BOTH are
  // required (see passesInterestThreshold/INTEREST_MIN_DWELL_MS below), not
  // either alone. Dwell only ever accrues for a visit in which at least one
  // such interaction occurred; a purely passive visit (open it, stare, leave)
  // contributes 0 dwellMs and can never make a product "interesting" on time
  // alone (see dwellHasInteraction below) — and conversely, a quick
  // interaction with too little time spent (e.g. one hasty scroll then leave)
  // doesn't qualify either. "Not interesting" is NOT tracked here at all — the existing dislike
  // feature (065-dislike.js) already owns that signal; this module only
  // excludes disliked ids at read time.
  //
  // Deliberately NOT flushed on beforeunload/pagehide: every showGalleryData()
  // call and closeSheet() already flush the previous dwell segment, which
  // covers normal browsing. The only loss case is a hard reload/tab-close
  // mid-segment, bounded by MAX_DWELL_SEGMENT_MS (and in practice far smaller)
  // — an accepted simplification, not an oversight.
  function interestOn() { return CFG.interestEnabled !== false; }

  function interestStorageKey() {
    return 'ecommo_interest_' + (CFG.siteName || location.hostname).replace(/\s+/g, '_');
  }

  function loadInterestData() {
    try {
      var raw = localStorage.getItem(interestStorageKey());
      var obj = raw ? JSON.parse(raw) : {};
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
      // Migrate records saved before variantChanges/scrolls existed — these
      // fields are read directly (not just via ensureInterestRecord) by
      // passesInterestThreshold/interestScore/the table renderers, so a
      // missing field there would poison every old record's score with NaN
      // (undefined + 1) the moment this build loads, not just on re-open.
      Object.keys(obj).forEach(function(id) {
        var r = obj[id];
        if (typeof r.variantChanges !== 'number') r.variantChanges = 0;
        if (typeof r.scrolls !== 'number') r.scrolls = 0;
      });
      return obj;
    } catch (e) {
      return {};
    }
  }

  function saveInterestData() {
    try {
      localStorage.setItem(interestStorageKey(), JSON.stringify(interestData));
    } catch (e) { /* private mode / quota — degrade to session-only */ }
  }

  var interestData = loadInterestData();   // id -> record (see ensureInterestRecord)

  function ensureInterestRecord(id) {
    var r = interestData[id];
    if (!r) {
      r = interestData[id] = {
        opens: 0, dwellMs: 0, imageSwipes: 0, metalChanges: 0, variantChanges: 0, scrolls: 0,
        firstSeen: Date.now(), lastSeen: Date.now(),
        productSnapshot: { name: '', price: '', original: '', url: '', src: '', description: '' },
        variantsViewed: { metal: [], shape: [], caratWeight: [], diamondQuality: [] }
      };
    }
    return r;
  }

  // The id of the product currently open, pinned once at open time and never
  // reassigned by variant switches (metal/shape/carat/quality) — unlike
  // savedCardId, which the DOM-swatch fallback path (08-swatches.js) and, on
  // real jewelry sites, the card's own data-product-id DO change per variant
  // (each metal is a genuinely different SKU there). Interaction/variant
  // hooks key off THIS instead, so switching metal never fragments one
  // product's record into several. ───────────────────────────────────────────
  var interestAnchorId = null;

  // ── Dwell time — one active segment at a time, keyed to whichever id is
  // currently shown in the sheet. ─────────────────────────────────────────────
  var dwellId    = null;
  var dwellStart = 0;
  var dwellPaused = false;
  var MAX_DWELL_SEGMENT_MS = 5 * 60 * 1000;   // guards a forgotten-open tab from inflating a score

  // Gates whether the CURRENT segment's elapsed time is ever credited (see
  // flushDwell) — reset false on each beginDwell(), latched true by
  // trackInterestInteraction() only when the interaction's id matches
  // dwellId (guards against a debug-panel jump, which reassigns
  // interestAnchorId without starting a new dwell segment — see
  // suppressOpenCount below).
  var dwellHasInteraction = false;

  // Without this, dwellMs (and therefore isInteresting()/the eye icon) only
  // ever got updated at the NEXT flush point — closing the sheet, navigating
  // to another product, or backgrounding the tab. That meant the item you're
  // currently looking at could silently cross INTEREST_MIN_DWELL_MS while
  // still open, but the UI wouldn't reflect it becoming "interesting" until
  // you'd already moved on to the next one — reading as if the wrong
  // (previous) item just qualified. Ticking flushDwell() on an interval while
  // a segment is live keeps the current item's own state current in real time.
  var DWELL_TICK_MS = 1000;
  var dwellTickTimer = null;

  function beginDwell(id) {
    dwellId = id;
    dwellStart = Date.now();
    dwellPaused = document.hidden;
    dwellHasInteraction = false;
    if (dwellTickTimer) clearInterval(dwellTickTimer);
    dwellTickTimer = setInterval(flushDwell, DWELL_TICK_MS);
  }

  // Safe to call repeatedly — restarts the segment clock each time, so it
  // never double-counts already-flushed time. Only credits the elapsed
  // segment to dwellMs if some interaction happened during it (any point in
  // the segment, not just after) — a purely passive visit contributes 0.
  function flushDwell() {
    if (!dwellId || dwellPaused) return;
    var elapsed = Math.min(Date.now() - dwellStart, MAX_DWELL_SEGMENT_MS);
    dwellStart = Date.now();
    if (!dwellHasInteraction) return;
    var r = ensureInterestRecord(dwellId);
    r.dwellMs += elapsed;
    r.lastSeen = Date.now();
    saveInterestData();
    log('interest: dwell flush', dwellId, 'segmentMs=', elapsed, 'totalMs=', r.dwellMs);
    refreshInterestUI(dwellId);   // score just changed — keep panel + gallery icons both current
  }

  function endDwell() {
    flushDwell();
    dwellId = null;
    if (dwellTickTimer) { clearInterval(dwellTickTimer); dwellTickTimer = null; }
  }

  function onInterestVisibilityChange() {
    if (!interestOn()) return;
    if (document.hidden) {
      flushDwell();
      dwellPaused = true;
      log('interest: tab hidden, pausing dwell');
    } else {
      dwellPaused = false;
      if (dwellId) dwellStart = Date.now();   // resume now — don't back-count hidden time
      log('interest: tab visible, resuming dwell');
    }
  }

  // Set only while jumpToProduct() (debug-panel row click) is swapping the
  // sheet's content — a debug navigation, not a real shopper opening the
  // product, so it shouldn't count as one. Dwell/PDP data still work
  // normally once shown; only the opens counter (and its log line) is
  // skipped for that one trackInterestOpen() call.
  var suppressOpenCount = false;

  // ── Open tracking — called from the single "now showing product X" choke
  // point (showGalleryData in 03-sheet.js), so it covers initial open,
  // Prev/Next navigation, and the dislike auto-advance alike. ────────────────
  function trackInterestOpen(data) {
    if (!interestOn() || !data || !data.id) return;
    interestAnchorId = data.id;
    endDwell();   // flush whatever was previously current (no-op if none)
    var r = ensureInterestRecord(data.id);
    if (!suppressOpenCount) {
      r.opens++;
      log('interest: open', data.id, 'opens=', r.opens);
    }
    r.productSnapshot.name = data.name || '';
    r.productSnapshot.price = data.price || '';
    r.productSnapshot.original = data.original || '';
    r.productSnapshot.url = data.url || '';
    r.productSnapshot.src = data.src || '';
    r.lastSeen = Date.now();
    saveInterestData();
    // Debug jump: don't start a real dwell segment for the destination — just
    // peeking at it shouldn't accrue time toward its score either.
    if (!suppressOpenCount) beginDwell(data.id);
    refreshInterestUI(data.id);
  }

  // ── Interaction depth — image swipes (05-gallery.js), metal swatch picks
  // (08-swatches.js, DOM-swatch sites only), PDP variant chip picks
  // (085-pdp.js onPdpVariantClick — metal/shape/carat/quality on PDP sites),
  // and in-popup vertical scrolling (06-events.js onTouchMove, reusing its
  // existing swipe-axis-lock detection). Also latches dwellHasInteraction
  // for the current visit — see flushDwell(). ────────────────────────────────
  function trackInterestInteraction(id, kind) {
    if (!interestOn() || !id) return;
    if (isDisliked(id)) undoDislikeIfInteracted(id);   // renewed interest reverses an earlier "Not for me" — see 065-dislike.js
    var r = ensureInterestRecord(id);
    if (kind === 'image') r.imageSwipes++;
    else if (kind === 'metal') r.metalChanges++;
    else if (kind === 'variant') r.variantChanges++;
    else if (kind === 'scroll') r.scrolls++;
    if (id === dwellId) dwellHasInteraction = true;   // only unlock the segment this interaction actually belongs to
    r.lastSeen = Date.now();
    saveInterestData();
    log('interest: interaction', kind, id, '-> swipes=', r.imageSwipes, 'metals=', r.metalChanges, 'variants=', r.variantChanges, 'scrolls=', r.scrolls);
    refreshInterestUI(id);
  }

  // ── PDP variant tracking (metal/shape/carat/quality) — records WHICH values
  // were viewed, not just how many times something changed. Keyed to
  // interestAnchorId (the id originally opened from the gallery), not the PDP
  // resolver's own internal product code or the card's own (possibly
  // variant-specific) id attribute — so every variant explored for one
  // gallery item accumulates on the same record instead of fragmenting across
  // the different product codes each variant technically resolves to. ───────
  var PDP_VARIANT_FIELD = {
    SWATCHMETALTYPE: 'metal',
    SWATCHSTONESHAPE: 'shape',
    SWATCHCENTERSTONECARATWEIGHT: 'caratWeight',
    SWATCHDIAMONDQUALITY: 'diamondQuality'
  };

  function trackInterestProductData(id, product) {
    if (!interestOn() || !id || !product) return;
    var r = ensureInterestRecord(id);
    r.productSnapshot.description = product.description || '';
    (product.swatchAttributesData || []).forEach(function(g) {
      var field = PDP_VARIANT_FIELD[g.key];
      if (!field) return;
      var list = (g.value && g.value.swatchAttributesListData) || [];
      var sel = list.filter(function(o) { return o.selected; })[0];
      if (!sel || !sel.key) return;
      if (r.variantsViewed[field].indexOf(sel.key) === -1) r.variantsViewed[field].push(sel.key);
    });
    r.lastSeen = Date.now();
    saveInterestData();
    log('interest: product data', id, 'metal=', r.variantsViewed.metal.join(','));
    refreshInterestUI(id);
  }

  // ── Classification / scoring — thresholds below are starting guesses, NOT
  // derived from real usage data. Tune once there's actual behavior to look
  // at. Interactions alone (e.g. a single scroll) no longer qualify — a
  // product only counts as "interesting" if it ALSO accumulated enough dwell
  // time. Dwell only ever accrues for a visit that already had a qualifying
  // interaction (dwellHasInteraction), so the two conditions below are not
  // redundant: interactions-with-no-time (quick scroll then leave) fails the
  // dwell check, and time-with-no-interaction never happens at all (dwell
  // can't accrue without one). Both must pass. ──────────────────────────────
  var INTEREST_MIN_INTERACTIONS   = 1;       // any single swipe/variant pick/scroll counts
  var INTEREST_MIN_DWELL_MS       = 4000;    // must ALSO have stuck around at least this long
  var INTEREST_INTERACTION_WEIGHT = 3000;    // score-equivalent ms per interaction
  var INTEREST_REOPEN_WEIGHT      = 1500;    // score-equivalent ms per re-open beyond the first

  // Raw signal check only — no dislike check. Split out from isInteresting()
  // so the table can keep showing a row (struck through) after the product
  // gets disliked, instead of dropping it — see rankedInterests()'s `removed`
  // flag below. Requires BOTH enough interactions AND enough dwell time —
  // interactions with no time (or vice versa) don't qualify on their own.
  function passesInterestThreshold(id) {
    var r = interestData[id];
    if (!r) return false;
    var interactions = r.imageSwipes + r.metalChanges + r.variantChanges + r.scrolls;
    return interactions >= INTEREST_MIN_INTERACTIONS && r.dwellMs >= INTEREST_MIN_DWELL_MS;
  }

  function isInteresting(id) {
    return interestOn() && !isDisliked(id) && passesInterestThreshold(id);
  }

  function interestScore(id) {
    var r = interestData[id];
    if (!r) return 0;
    var interactions = r.imageSwipes + r.metalChanges + r.variantChanges + r.scrolls;
    return r.dwellMs + interactions * INTEREST_INTERACTION_WEIGHT + Math.max(0, r.opens - 1) * INTEREST_REOPEN_WEIGHT;
  }

  // Every product ever opened gets ranked — including ones opened and closed
  // with no interaction (near-zero score). Classifying which of these count
  // as "interesting enough" is a separate, deliberately deferred question;
  // this only decides who's in the list, not how it's judged.
  function rankedInterests(limit) {
    if (!interestOn()) return [];
    var ids = Object.keys(interestData);
    ids.sort(function(a, b) { return interestScore(b) - interestScore(a); });
    if (typeof limit === 'number') ids = ids.slice(0, limit);
    return ids.map(function(id) {
      return { id: id, score: interestScore(id), data: interestData[id], removed: isDisliked(id) };
    });
  }

  // Shared by the console table() and the on-page debug panel — one source of
  // truth for how a ranked-interest entry becomes a display row.
  function interestTableRows(limit) {
    return rankedInterests(limit).map(function(r) {
      var d = r.data;
      return {
        id: r.id,
        src: d.productSnapshot.src,
        name: d.productSnapshot.name,
        score: r.score,
        opens: d.opens,
        dwellSec: Math.round(d.dwellMs / 1000),
        imageSwipes: d.imageSwipes,
        metalChanges: d.metalChanges,
        variantChanges: d.variantChanges,
        scrolls: d.scrolls,
        metal: d.variantsViewed.metal.join(', '),
        removed: r.removed
      };
    });
  }

  // Rewrites the on-page debug panel's body (08-badge.js) from the same rows
  // the console table() uses. Safe no-op if the panel was never created
  // (DEBUG was false) — the getElementById check is the entire guard.
  function renderInterestPanel(highlightId) {
    var body = document.getElementById('nav-ecommo-interest-body');
    if (!body) return;
    var rows = interestTableRows(20);   // cap — a phone-width demo panel, not a data dump
    if (!rows.length) {
      body.innerHTML = '<div class="nav-ecommo-interest-empty">No interest signals yet</div>';
      return;
    }
    var html = '<table class="nav-ecommo-interest-table"><thead><tr>' +
      '<th></th><th>Name</th><th>Score</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function(r) {
      var name = pdpEsc(r.id);
      var rowClass = r.removed ? ' class="nav-ecommo-interest-removed"' : '';
      var thumb = r.src ? '<img src="' + pdpEsc(r.src) + '" alt="">' : '';
      html += '<tr data-id="' + pdpEsc(r.id) + '"' + rowClass + '><td class="nav-ecommo-interest-thumb">' + thumb + '</td>' +
        '<td class="nav-ecommo-interest-name" title="' + name + '">' + name + '</td>' +
        '<td>' + r.score + '</td></tr>';
    });
    html += '</tbody></table>';
    body.innerHTML = html;
    if (highlightId) flashInterestRow(body, highlightId);
  }

  // Briefly highlights the row for `id` (the item a tracked event just
  // touched) so a change in the panel is noticeable, not just a silent
  // re-render. Same "set solid, force reflow, transition back" idiom as
  // fadeInEl() in 03-sheet.js — just animating background-color instead of
  // opacity/transform.
  function flashInterestRow(body, id) {
    var row = body.querySelector('tr[data-id="' + id + '"]');
    if (!row) return;
    row.style.transition = 'none';
    row.style.backgroundColor = '#fff3b0';
    void row.offsetHeight;
    requestAnimationFrame(function() {
      row.style.transition = 'background-color 900ms ease';
      row.style.backgroundColor = '';
    });
  }

  // Single entry point for "something changed" — keeps the debug panel, the
  // gallery-card eye indicators, and the catch-up icon (all user-facing) in
  // sync from one call.
  function refreshInterestUI(highlightId) {
    renderInterestPanel(highlightId);
    updateGalleryInterestIcons();
    updateCatchUpIcon();
  }

  // Paints the gallery's own preview-eye icon per card: only two states now —
  // untouched (no marking at all — just having opened/viewed a product isn't
  // a signal worth surfacing on its own) or marked (isInteresting() — same
  // bar as the catch-up queue/icon, so "interesting" means the same thing
  // everywhere). User-facing, not debug-gated — unlike the panel, this
  // always runs when interestOn().
  function updateGalleryInterestIcons() {
    if (!interestOn() || quickNavigateOnly()) return;
    Array.from(document.querySelectorAll('.nav-card-preview')).forEach(function(btn) {
      var card = btn.closest(CFG.cardSelector);
      if (!card) return;   // e.g. the catch-up icon shares no class with this, but be defensive about non-card matches of .nav-card-preview
      var id = card.getAttribute(CFG.cardIdAttr);
      btn.classList.toggle('nav-preview-interesting', !!id && isInteresting(id));
    });
  }

  // Debug-panel row click: bring that product into view. If the sheet is
  // already open, swap its content to it (mirrors Prev/Next, just for an
  // arbitrary target); otherwise scroll the gallery to its card. No-ops if
  // the card isn't present on this page (e.g. tracked on a different gallery).
  // Wrapped with suppressOpenCount so this debug navigation doesn't itself
  // count as an open — see trackInterestOpen().
  function jumpToProduct(id) {
    var card = findCardById(id);
    if (!card) return;
    if (sheet && sheet.classList.contains('open')) {
      refreshAllCards();
      var idx = allCards.indexOf(card);
      if (idx === -1) return;
      suppressOpenCount = true;
      switchSheetTo(allCards[idx]);
      suppressOpenCount = false;
    } else {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Wipes every tracked record (used by the debug panel's clear button).
  // Also ends any in-progress dwell segment, since its id no longer exists.
  function clearInterestData() {
    Object.keys(interestData).forEach(function(id) { delete interestData[id]; });
    dwellId = null;
    if (dwellTickTimer) { clearInterval(dwellTickTimer); dwellTickTimer = null; }
    saveInterestData();
    log('interest: cleared all records');
    refreshInterestUI();
  }

  // console.table() cells are plain text — no per-row CSS like the on-page
  // panel's line-through. This Unicode combining-strikethrough trick (append
  // U+0336 after each character) is the closest text-only equivalent, so a
  // "Not for me" row still visually reads as struck out at a glance.
  function strikeText(v) {
    return String(v).split('').map(function(ch) { return ch + '̶'; }).join('');
  }

  // One row per item — identifying fields (id, name), whatever actually feeds
  // interestScore() (opens, dwellMs, imageSwipes, metalChanges, variantChanges,
  // scrolls). Deliberately excludes everything else that doesn't affect the
  // ranking (price, url, description, variants explored, timestamps) — this
  // is a "why is it ranked here" view, not a full data dump. Rows marked
  // "Not for me" are struck through instead of carrying a separate removed
  // column.
  function interestFullTableRows() {
    return rankedInterests().map(function(r) {
      var d = r.data;
      var row = {
        id: r.id,
        name: d.productSnapshot.name,
        score: r.score,
        opens: d.opens,
        dwellMs: d.dwellMs,
        imageSwipes: d.imageSwipes,
        metalChanges: d.metalChanges,
        variantChanges: d.variantChanges,
        scrolls: d.scrolls
      };
      if (r.removed) {
        Object.keys(row).forEach(function(key) { row[key] = strikeText(row[key]); });
      }
      return row;
    });
  }

  // ── "Catch up" — browse only interesting items (user-facing, not debug).
  // Two interchangeable experiences behind ONE icon, picked by catchUpStyle():
  //   'popup' — opens the highest-scoring item in the normal #nav-sheet popup
  //             and scopes its Next/Prev to interesting items only (via
  //             refreshAllCards() in 04-swipe.js branching on catchUpMode).
  //   'cards' — a swipeable card-stack overlay, entirely independent of
  //             #nav-sheet (built from cached productSnapshot data only, no
  //             popup involved) — see startCatchUpCards() below. Default,
  //             because building the stack inside #nav-sheet would collide
  //             with its own horizontal image-swipe gesture and would need
  //             to clobber savedCardId/savedCardImg/savedScrollY (no way to
  //             "return to where you were" if you entered mid-browse).
  // To go back to the old behavior: change the fallback below to 'popup'
  // (or set CFG.catchUpStyle: 'popup' for one site) and rebuild — nothing
  // else needs to change, both implementations stay in the code side by side.
  function catchUpStyle() { return CFG.catchUpStyle || 'cards'; }

  var catchUpMode = false;       // 'popup' style: currently browsing scoped Next/Prev inside #nav-sheet
  var catchUpCardsOpen = false;  // 'cards' style: the card-stack overlay is open
  var catchUpIcon = null;
  var catchUpBadge = null;
  var catchUpBadgeCount = 0;     // last-rendered count — lets updateCatchUpIcon() detect an increase and flash
  var catchUpBadgeHideTimer = null;
  var CATCHUP_BADGE_FLASH_MS = 1600;   // how long the "+" stays up before fading

  function hasAnyInteresting() {
    return Object.keys(interestData).some(function(id) { return isInteresting(id); });
  }

  // Highest-scoring first — lets the shopper see their strongest matches
  // before weaker ones, rather than gallery/insertion order.
  function interestingIdsSorted() {
    return Object.keys(interestData).filter(isInteresting)
      .sort(function(a, b) { return interestScore(b) - interestScore(a); });
  }

  function createCatchUpIcon() {
    if (catchUpIcon) return;
    catchUpIcon = document.createElement('button');
    catchUpIcon.type = 'button';
    catchUpIcon.id = 'nav-catchup-icon';
    catchUpIcon.title = 'Browse your interesting items';
    catchUpIcon.setAttribute('aria-label', 'Browse your interesting items');
    catchUpIcon.innerHTML = previewSvgMarkup();   // same eye as the card/sheet indicator — same visual language
    catchUpIcon.addEventListener('click', onCatchUpIconClick);
    document.body.appendChild(catchUpIcon);

    catchUpBadge = document.createElement('span');
    catchUpBadge.id = 'nav-catchup-badge';
    catchUpIcon.appendChild(catchUpBadge);

    updateCatchUpIcon();
  }

  function removeCatchUpIcon() {
    if (catchUpIcon) { catchUpIcon.remove(); catchUpIcon = null; catchUpBadge = null; }
    removeSwipeStackOverlay();   // shared overlay (0655-swipestack.js) — idempotent, safe even if 067-cardstack.js already tore it down
    catchUpMode = false;
    catchUpCardsOpen = false;
    catchUpBadgeCount = 0;
    clearTimeout(catchUpBadgeHideTimer);
    catchUpBadgeHideTimer = null;
  }

  // Reflects "is there anything to catch up on" (disabled) and "currently in
  // a catch-up session, either style" (active) — called on every
  // interest/dislike change (refreshInterestUI, the MutationObserver in
  // 07-lifecycle.js, commitDisliked) and on entry/exit of either style.
  // Flashes the badge whenever the count just went UP (a product newly
  // qualified), never on a decrease (dislike/session reset) — a "+" reads as
  // "you gained something", not appropriate for a drop.
  function updateCatchUpIcon() {
    if (!catchUpIcon) return;
    var count = interestingIdsSorted().length;
    var any = count > 0;
    // Subtler tint while the popup is open on a product that's itself in the
    // interesting list — distinct from (and weaker than) .active, which is
    // reserved for an actual catch-up session. Gated on the sheet actually
    // being open (not just interestAnchorId being set, which is never
    // cleared on close) — otherwise the tint would wrongly persist onto the
    // plain gallery after closing the popup.
    var viewingInterestingItem = !!(sheet && sheet.classList.contains('open') && isInteresting(interestAnchorId));
    catchUpIcon.classList.toggle('disabled', !any);
    catchUpIcon.classList.toggle('viewing', viewingInterestingItem);
    catchUpIcon.classList.toggle('active', catchUpMode || catchUpCardsOpen);
    catchUpIcon.disabled = !any;
    // Not a persistent counter anymore — just a transient "+" flash on
    // increase, faded back out after CATCHUP_BADGE_FLASH_MS (see
    // #nav-catchup-badge in 01-config-styles.js).
    if (catchUpBadge && count > catchUpBadgeCount) {
      // Guard: this function is called from the MutationObserver watching
      // document.body's subtree (07-lifecycle.js). Writing textContent
      // unconditionally IS a childList mutation, which would re-trigger that
      // same observer — an infinite loop we already hit once this session.
      // Only touch the DOM when the value actually changed.
      if (catchUpBadge.textContent !== '+') catchUpBadge.textContent = '+';
      clearTimeout(catchUpBadgeHideTimer);
      catchUpBadge.classList.remove('show', 'bump');
      void catchUpBadge.offsetWidth;   // force reflow so opacity fade-in + bump replay even if already mid-flash
      catchUpBadge.classList.add('show', 'bump');
      catchUpBadgeHideTimer = setTimeout(function() {
        catchUpBadge.classList.remove('show');
      }, CATCHUP_BADGE_FLASH_MS);
    }
    catchUpBadgeCount = count;
  }

  function onCatchUpIconClick() {
    if (!hasAnyInteresting()) return;   // disabled — defensive no-op (the disabled attribute already blocks the click)
    // Same console dump the (now UI-less) debug panel's row click used to
    // trigger — still reachable this way, just from a real user-facing icon.
    log('interest: full table (all items)');
    console.table(interestFullTableRows());
    if (catchUpStyle() === 'popup') startCatchUpPopup(); else startCatchUpCards();
  }

  // ── 'popup' style ───────────────────────────────────────────────────────
  function startCatchUpPopup() {
    var ids = interestingIdsSorted();
    if (!ids.length) return;
    var card = findCardById(ids[0]);
    if (!card) return;   // top item's card isn't on this page — nothing to jump to

    if (sheet && sheet.classList.contains('open')) {
      catchUpMode = true;
      refreshAllCards();   // now catch-up-scoped (see 04-swipe.js)
      var idx = allCards.indexOf(card);
      if (idx === -1) { catchUpMode = false; return; }
      switchSheetTo(allCards[idx]);
    } else {
      catchUpMode = true;
      card.scrollIntoView({ behavior: 'instant', block: 'center' });   // may be off-screen — must happen before the view-transition snapshot
      openSheetForCard(card, catchUpIcon);
    }
    updateCatchUpIcon();
  }

  // ── 'cards' style ───────────────────────────────────────────────────────
  // Rendering/swipe mechanics live in the shared 0655-swipestack.js (also used
  // by 067-cardstack.js's generic like/dislike browse) — this just supplies
  // the interesting-items queue and what a swipe here actually means: right
  // is a no-op (just advance), left reuses the existing dislike signal.
  function startCatchUpCards() {
    catchUpCardsOpen = true;
    updateCatchUpIcon();
    openSwipeStack(
      interestingIdsSorted().map(function(id) {
        return Object.assign({ id: id }, interestData[id].productSnapshot);
      }),
      {
        hintRight: 'KEEP', hintLeft: 'REMOVE',
        onSwipeRight: function() {},
        onSwipeLeft: function(item) { commitDisliked(item.id); },   // existing dislike mechanism — also excludes it from isInteresting() going forward
        onCardShown: function(item) { cacheCurrentStackItemInfo(item.id); },   // 086-iteminfo.js
        onClose: closeCatchUpCards
      }
    );
  }

  function closeCatchUpCards() {
    catchUpCardsOpen = false;
    updateCatchUpIcon();
  }

  // ── Debug-only inspection surface — console access, never a page UI. ──────
  if (DEBUG) {
    window.__ecommoInterest = {
      data: interestData,
      isInteresting: isInteresting,
      rankedInterests: rankedInterests,
      table: function(limit) { console.table(interestTableRows(limit)); },
      fullTable: function() { console.table(interestFullTableRows()); }
    };
  }


  // ── Generic "browse the gallery" card stack — like/dislike, no criteria ────
  // Reuses the swipe-stack mechanics from 0655-swipestack.js (also used by
  // 066-interest.js's "catch up" flow), but with its own queue (every product
  // currently in the gallery, not just ones already flagged "interesting")
  // and its own meaning for a swipe: right = like, left = dislike. Purely a
  // recorded signal for later analysis — unlike 065-dislike.js's "Not for
  // me", swiping left here never hides the product or touches interestData.
  function cardStackEnabled() { return CFG.cardStackEnabled !== false; }

  function cardStackStorageKey() {
    return 'ecommo_cardstack_' + (CFG.siteName || location.hostname).replace(/\s+/g, '_');
  }

  function loadCardStackData() {
    try {
      var raw = localStorage.getItem(cardStackStorageKey());
      var obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
    } catch (e) {
      return {};
    }
  }

  function saveCardStackData() {
    try {
      localStorage.setItem(cardStackStorageKey(), JSON.stringify(cardStackData));
    } catch (e) { /* private mode / quota — degrade to session-only */ }
  }

  var cardStackData = loadCardStackData();   // id -> {id, verdict, name, price, original, src, url, decidedAt}
  var cardStackIcon = null;
  var cardStackOpen = false;

  // ── Batching — the full gallery can be hundreds of items, so rather than
  // dumping the whole thing into one swipe session, feed it in pages of
  // CARDSTACK_BATCH_SIZE. Each time a page is fully swiped (not just closed
  // early), pause on a small stats card and let the shopper choose to
  // continue or stop — see onCardStackBatchClose/showCardStackPause below.
  var CARDSTACK_BATCH_SIZE = 20;
  var cardStackQueue = [];          // this session's full queue, across batches
  var cardStackPos = 0;             // how many of cardStackQueue have been swiped so far
  var cardStackSessionLiked = [];   // items liked this session — for the pause-screen stats
  var cardStackSessionSkipped = []; // items skipped this session
  var cardStackPauseOverlay = null;

  // Pulled fresh every time the icon is tapped — reflects whatever's actually
  // in the gallery right now (including anything lazy-loaded since page load),
  // not a snapshot taken once at enable().
  function buildCardStackQueue() {
    return Array.from(document.querySelectorAll(CFG.cardSelector)).map(extractCardData);
  }

  function commitCardStackVerdict(item, verdict) {
    cardStackData[item.id] = {
      id: item.id, verdict: verdict,
      name: item.name || '', price: item.price || '', original: item.original || '',
      src: item.src || '', url: item.url || '',
      decidedAt: Date.now()
    };
    saveCardStackData();
    log('cardstack:', verdict, item.id);
  }

  function clearCardStackData() {
    Object.keys(cardStackData).forEach(function(id) { delete cardStackData[id]; });
    saveCardStackData();
    log('cardstack: cleared all records');
  }

  function cardStackTableRows() {
    return Object.keys(cardStackData).map(function(id) {
      var r = cardStackData[id];
      return { id: r.id, name: r.name, verdict: r.verdict, price: r.price };
    });
  }

  // Fixed title logged right before the table (own console.log call, not
  // just a variable name) — lets the browser console's filter box isolate
  // just these lines by searching "Cards Stack Summary".
  function printCardStackTable() {
    console.log('Cards Stack Summary');
    console.table(cardStackTableRows());
  }

  // ── "Done" report — fires only when the swipe session is fully exhausted
  // (the real DONE screen — NOT an early X-close/tap-outside; see the
  // onDone hook in 0655-swipestack.js, separate from onClose). Same
  // grouped-by-parameter breakdown as __ecommoItemInfo.report()
  // (086-iteminfo.js — Metal/Category/Stone shape/Price band/On sale), but
  // filtered to only the items marked 'like' so far (cardStackData) —
  // cross-referencing the full PDP data 086-iteminfo.js already cached
  // per-card while browsing (cacheCurrentStackItemInfo(), fired from the
  // shared onCardShown hook). No extra fetch here — just whatever's already
  // in IndexedDB; a liked item whose fetch failed/never ran simply won't
  // have a cached record and gets skipped (filter(Boolean) below).
  function printCardStackLikeChoiceReport() {
    var likedIds = Object.keys(cardStackData).filter(function(id) {
      return cardStackData[id].verdict === 'like';
    });
    Promise.all(likedIds.map(getItemInfo)).then(function(records) {
      var summaries = records.filter(Boolean).map(function(r) { return summarizeItemChoices(r.product); });
      console.log('Cards Stack — Liked Items Breakdown (' + summaries.length + ' of ' + likedIds.length + ' liked items had full data cached)');
      if (!summaries.length) return;
      console.log('%cMetal', 'font-weight:bold');
      console.table(countBy(summaries, function(s) { return s.metal; }));
      console.log('%cCategory', 'font-weight:bold');
      console.table(countBy(summaries, function(s) { return s.category; }));
      console.log('%cStone shape', 'font-weight:bold');
      console.table(countBy(summaries, function(s) { return s.stoneShape; }));
      console.log('%cPrice band', 'font-weight:bold');
      console.table(countBy(summaries, function(s) { return priceBand(s.price); }));
      console.log('%cOn sale?', 'font-weight:bold');
      console.table(countBy(summaries, function(s) { return s.onSale ? 'on sale' : 'full price'; }));
    }).catch(function(err) { log('cardstack: like-choice report failed', err); });
  }

  // list is optional — defaults to every product currently in the gallery.
  // Accepting it keeps the door open for a future alternate source (a
  // different saved list, etc.) without touching the render/swipe mechanics.
  function startCardStack(list) {
    cardStackOpen = true;
    openSwipeStack(list || buildCardStackQueue(), {
      hintRight: 'LIKE', hintLeft: 'SKIP',
      onSwipeRight: function(item) { commitCardStackVerdict(item, 'like'); },
      onSwipeLeft: function(item) { commitCardStackVerdict(item, 'dislike'); },
      onCardShown: function(item) { cacheCurrentStackItemInfo(item.id); },   // 086-iteminfo.js
      onDone: printCardStackLikeChoiceReport,
      onClose: function() { cardStackOpen = false; }
    });
  }

  function onCardStackIconClick() {
    if (cardStackIcon && cardStackIcon.disabled) return;   // defensive no-op — disabled attribute already blocks the click
    startCardStack();
  }

  // Grayed out (like #nav-catchup-icon.disabled) when the gallery currently
  // has nothing to browse. Called on creation and from the same
  // MutationObserver that keeps the catch-up icon in sync (07-lifecycle.js).
  function updateCardStackIcon() {
    if (!cardStackIcon) return;
    var any = buildCardStackQueue().length > 0;
    cardStackIcon.classList.toggle('disabled', !any);
    cardStackIcon.disabled = !any;
  }

  // Distinct glyph from the eye (interest/preview) icon and the catch-up
  // icon — two overlapping cards, so the entry point reads as its own thing.
  function cardStackSvgMarkup() {
    return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M7 7V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-3"></path>' +
      '<rect x="3" y="7" width="14" height="14" rx="2"></rect>' +
      '</svg>';
  }

  function createCardStackIcon() {
    if (cardStackIcon) return;
    cardStackIcon = document.createElement('button');
    cardStackIcon.type = 'button';
    cardStackIcon.id = 'nav-cardstack-icon';
    cardStackIcon.title = 'Browse the gallery — like or skip';
    cardStackIcon.setAttribute('aria-label', 'Browse the gallery — like or skip');
    cardStackIcon.innerHTML = cardStackSvgMarkup();
    cardStackIcon.addEventListener('click', onCardStackIconClick);
    // Normally stacked above #nav-catchup-icon (bottom:148px, 01-config-styles.js)
    // so the two don't overlap — but under cardsOnly the catch-up icon is
    // hidden, so this is the only floating icon left; drop it to the same
    // lone-icon corner spot (bottom:16px) instead of leaving a gap above it.
    if (cardsOnly()) cardStackIcon.style.bottom = '16px';
    document.body.appendChild(cardStackIcon);
    updateCardStackIcon();
  }

  function removeCardStackIcon() {
    if (cardStackIcon) { cardStackIcon.remove(); cardStackIcon = null; }
    removeSwipeStackOverlay();   // shared overlay (0655-swipestack.js) — idempotent, safe even if 066-interest.js already tore it down
    cardStackOpen = false;
  }

  // ── Debug-only inspection surface — console access, never a page UI. ──────
  if (DEBUG) {
    window.__ecommoCardStack = {
      data: cardStackData,
      start: startCardStack,
      clear: clearCardStackData,
      table: printCardStackTable,
      likeChoiceReport: printCardStackLikeChoiceReport
    };
  }


  // ── Enable / Disable (inject vs return-to-production) ──────────────────────
  function enable() {
    if (enabled) return;

    styleEl = document.createElement('style');
    styleEl.id = 'nav-sheet-style';
    styleEl.textContent = mainCss;
    document.head.appendChild(styleEl);

    overlay = document.createElement('div');
    overlay.id = 'nav-sheet-overlay';

    sheet = document.createElement('div');
    sheet.id = 'nav-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', CFG.siteName + ' product details');
    sheet.innerHTML = `
      <div id="nav-sheet-handle"></div>
      <div id="nav-sheet-header">
        <button id="nav-sheet-back">&#8249;</button>
        <span id="nav-sheet-logo">${CFG.siteName}</span>
        <div id="nav-sheet-counter" style="visibility:hidden;">1 / 1</div>
      </div>
      <div id="nav-sheet-slide">
      <div id="nav-sheet-img-wrap">
        <img id="nav-sheet-img" src="" alt="">
        <div id="nav-sheet-imgcount"></div>
        <div id="nav-sheet-progress"><span></span></div>
      </div>
      <div id="nav-sheet-info">
        <div id="nav-sheet-name"></div>
        <div id="nav-sheet-price-row">
          <span id="nav-sheet-price"></span>
          <span id="nav-sheet-orig"></span>
          <span id="nav-sheet-off" class="nav-price-off-badge"></span>
        </div>
        <div class="nav-sheet-divider"></div>
        <div id="nav-sheet-metals"></div>
        <div id="nav-sheet-variants"></div>
        <div id="nav-sheet-desc"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <span style="font-size:13px;font-weight:600;">Select Your Size</span>
          <span style="font-size:12px;color:#555;text-decoration:underline;cursor:pointer;">Size Guide</span>
        </div>
        <div id="nav-sheet-sizes"></div>
        <div style="font-size:10.5px;color:#888;margin-bottom:16px;">* More sizes available in store</div>
        <button id="nav-sheet-add">Add to Bag</button>
        <div id="nav-sheet-financing"></div>
        <div class="nav-sheet-divider"></div>
        <div class="nav-sheet-info-row">
          <span class="nav-sheet-info-icon">&#128230;</span>
          <span style="color:#666;font-size:11.5px;">${CFG.deliveryText || 'Fast delivery available'}</span>
        </div>
        <div class="nav-sheet-info-row">
          <span class="nav-sheet-info-icon">&#8635;</span>
          <span style="color:#666;font-size:11.5px;">Free and easy returns</span>
        </div>
        <button id="nav-sheet-full">View Full Product Details ›</button>
      </div>
      </div>
    `;

    sticky = document.createElement('div');
    sticky.id = 'nav-sheet-sticky';
    sticky.className = 'item-nav';
    sticky.setAttribute('aria-label', 'Item navigation');
    sticky.innerHTML = `
      <button id="nav-sheet-sticky-prev" class="item-nav__btn item-nav__btn--prev" type="button" disabled>
        <svg class="item-nav__chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <img class="item-nav__thumb" id="nav-sheet-sticky-prev-thumb" alt="">
        <span class="item-nav__text">
          <span class="item-nav__label">${CFG.prevLabel || 'Previous'}</span>
          <span class="item-nav__title" id="nav-sheet-sticky-prev-name"></span>
        </span>
      </button>

      <span class="item-nav__divider" aria-hidden="true"></span>

      <button id="nav-sheet-sticky-next" class="item-nav__btn item-nav__btn--next" type="button" disabled>
        <span class="item-nav__text item-nav__text--end">
          <span class="item-nav__label">${CFG.nextLabel || 'Next'}</span>
          <span class="item-nav__title" id="nav-sheet-sticky-next-name"></span>
        </span>
        <img class="item-nav__thumb" id="nav-sheet-sticky-next-thumb" alt="">
        <svg class="item-nav__chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(sheet);
    document.body.appendChild(sticky);
    // Must be appended after `sheet` — the "reposition above the sticky bar
    // while the popup is open" CSS rule is a general-sibling selector
    // (#nav-sheet.open ~ #nav-catchup-icon).
    if (interestOn() && !quickNavigateOnly() && !cardsOnly()) createCatchUpIcon();
    if (cardStackEnabled() && !quickNavigateOnly()) createCardStackIcon();

    document.getElementById('nav-sheet-back').addEventListener('click', closeSheet);
    document.getElementById('nav-sheet-full').addEventListener('click', function() {
      if (currentUrl) window.location.href = currentUrl;
    });
    var stickyPrev = document.getElementById('nav-sheet-sticky-prev');
    var stickyNext = document.getElementById('nav-sheet-sticky-next');
    stickyPrev.addEventListener('click', function() { navigateSheet('prev'); });
    stickyNext.addEventListener('click', function() { navigateSheet('next'); });
    // Prefetch the adjacent item's image on hover/focus for an instant transition.
    stickyPrev.addEventListener('mouseenter', function() { prefetchAdjacent('prev'); });
    stickyPrev.addEventListener('focus', function() { prefetchAdjacent('prev'); });
    stickyNext.addEventListener('mouseenter', function() { prefetchAdjacent('next'); });
    stickyNext.addEventListener('focus', function() { prefetchAdjacent('next'); });

    // Tap the photo to advance through this product's images, looping from the
    // last back to the first. (Prev/Next item live in the sticky bar below.)
    document.getElementById('nav-sheet-img-wrap').addEventListener('click', function(e) {
      if (e.target.closest('#nav-sheet-metals')) return;   // metal taps aren't image taps
      if (isNavigating || productImages.length <= 1) return;
      showProductImage((imgIndex + 1) % productImages.length, 'next');
    });

    // Pick a metal in the popup → swap that product's card + mirror it back.
    document.getElementById('nav-sheet-metals').addEventListener('click', function(e) {
      var chip = e.target.closest('.nav-metal');
      if (!chip) return;
      e.stopPropagation();
      selectMetal(parseInt(chip.getAttribute('data-metal'), 10));
    });

    // Item-page variant selectors (metal/shape/carat/quality) → OCC resolver.
    document.getElementById('nav-sheet-variants').addEventListener('click', onPdpVariantClick);

    // Size selection (delegated, attached once — not re-added on every populate).
    document.getElementById('nav-sheet-sizes').addEventListener('click', function(e) {
      var btn = e.target.closest('.nav-sheet-size-btn');
      if (!btn) return;
      this.querySelectorAll('.nav-sheet-size-btn').forEach(function(b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
    });

    sheet.addEventListener('touchstart', onTouchStart, { passive: true });
    sheet.addEventListener('touchmove', onTouchMove, { passive: false });
    sheet.addEventListener('touchend', onTouchEnd, { passive: true });

    document.addEventListener('click', onPreviewClick, false);
    document.addEventListener('keydown', onSheetKeydown);
    document.addEventListener('focusin', onSheetFocusGuard);
    if (interestOn()) document.addEventListener('visibilitychange', onInterestVisibilityChange);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onInitialCardsReady);
    } else {
      onInitialCardsReady();
    }

    previewObserver = new MutationObserver(function() {
      addCardPreviewButtons();
      updateGalleryInterestIcons();
      updateCatchUpIcon();
      updateCardStackIcon();
    });
    previewObserver.observe(document.body, { childList: true, subtree: true });

    enabled = true;
    updateBadge();
  }

  function disable() {
    if (!enabled) return;

    document.removeEventListener('click', onPreviewClick, false);
    document.removeEventListener('keydown', onSheetKeydown);
    document.removeEventListener('focusin', onSheetFocusGuard);
    document.removeEventListener('visibilitychange', onInterestVisibilityChange);
    endDwell();
    document.removeEventListener('DOMContentLoaded', onInitialCardsReady, false);
    if (previewObserver) {
      previewObserver.disconnect();
      previewObserver = null;
    }
    removeCardPreviewButtons();
    removeCatchUpIcon();
    removeCardStackIcon();

    // restore page to production
    document.body.style.overflow = '';
    if (overlay) overlay.remove();
    if (sheet)   sheet.remove();
    if (sticky)  sticky.remove();
    if (styleEl) styleEl.remove();
    overlay = sheet = sticky = styleEl = null;

    allCards = []; currentCardIndex = -1; isNavigating = false;
    savedCardImg = null; savedCardId = null; swipeAxisLocked = null;

    enabled = false;
    updateBadge();
  }


  // ── Persistent toggle badge ────────────────────────────────────────────────
  // Shows only the on/off switch, a hide button, and the close (×) button —
  // no label text, no gallery link (CFG.galleryUrl is still read elsewhere,
  // e.g. build.mjs's userscript @match origin — just no longer surfaced here).
  var badge = document.createElement('div');
  badge.id = 'nav-ecommo-badge';
  badge.title = 'Ecommo · build ' + BUILD_ID;

  badge.innerHTML = '<span id="nav-ecommo-switch"><span class="nav-ecommo-knob"></span></span>' +
                    '<button id="nav-ecommo-hide" title="Hide" aria-label="Hide">' +
                    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                    '<line x1="5" y1="12" x2="19" y2="12"></line>' +
                    '</svg></button>' +
                    '<button id="nav-ecommo-close" title="Remove Ecommo">\xd7</button>';
  badge.addEventListener('click', function(e) {
    if (e.target.closest('#nav-ecommo-close')) { removeBadge(); return; }
    // Just hides the badge visually — no other effect (extension keeps
    // running; there's no reopen affordance, a fresh paste brings it back).
    if (e.target.closest('#nav-ecommo-hide')) { badge.classList.add('hidden'); return; }
    if (enabled) disable(); else enable();
  });

  // Both demo modes (quickNavigateOnly / cardsOnly, 01-config-styles.js) hide
  // the whole badge — no visible dev control (switch/hide/close) during a demo.
  if (quickNavigateOnly() || cardsOnly()) badge.style.display = 'none';

  document.body.appendChild(badge);

  // ── Debug-only interest panel (persistent, same lifecycle as the badge —
  // created once, survives enable()/disable()). ──────────────────────────────
  if (DEBUG) {
    var interestPanel = document.createElement('div');
    interestPanel.id = 'nav-ecommo-interest-panel';
    interestPanel.innerHTML =
      '<div id="nav-ecommo-interest-title">Interest ranking' +
      '<span id="nav-ecommo-interest-actions">' +
      '<button id="nav-ecommo-interest-collapse" title="Collapse" aria-label="Collapse">‹</button>' +
      '<button id="nav-ecommo-interest-clear" title="Clear all records" aria-label="Clear all records">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<polyline points="3 6 5 6 21 6"></polyline>' +
      '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>' +
      '<path d="M10 11v6"></path><path d="M14 11v6"></path>' +
      '<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>' +
      '</svg></button>' +
      '</span>' +
      '</div>' +
      '<div id="nav-ecommo-interest-body"></div>';
    document.body.appendChild(interestPanel);

    interestPanel.addEventListener('click', function(e) {
      if (e.target.closest('#nav-ecommo-interest-collapse')) { e.stopPropagation(); toggleInterestPanel(); return; }
      if (e.target.closest('#nav-ecommo-interest-clear')) { e.stopPropagation(); clearInterestData(); return; }
      var row = e.target.closest('tr[data-id]');
      if (!row) return;
      var id = row.getAttribute('data-id');
      log('interest: full table (all items)');
      console.table(interestFullTableRows());
      jumpToProduct(id);
    });
  }

  // Opens/closes the interest panel; forces a fresh render on open so it
  // never shows stale data from before the panel was last shown.
  function toggleInterestPanel() {
    var panel = document.getElementById('nav-ecommo-interest-panel');
    if (!panel) return;
    if (panel.classList.toggle('open')) renderInterestPanel();
  }

  function updateBadge() {
    // toggle(), not className = ..., so it doesn't clobber the .hidden class
    // #nav-ecommo-hide may have already added.
    badge.classList.toggle('enabled', enabled);
    badge.classList.toggle('disabled', !enabled);
  }

  // Fully remove Ecommo: return the page to production AND drop the badge
  // (and the debug interest panel, if it exists).
  function removeBadge() {
    disable();
    if (interestPanel) interestPanel.remove();
    badge.remove();
    badgeStyleEl.remove();
  }

  // Exposed globally so re-pasting the script (a fresh IIFE, no shared scope
  // with this one) can tear this instance down before setting itself up —
  // see the wrapper guard in build.mjs/build.ps1. Always points at the most
  // recently injected instance's own teardown.
  window.__ecommoTeardown = removeBadge;


  // ── Metals / swatches ──────────────────────────────────────────────────────
  // Read the metal swatches from a gallery card and show them above the popup
  // image. Selecting a metal in the popup drives the card's OWN swatch control
  // (the host site swaps the card image + link for that variant), then mirrors
  // the result back into the popup. The card's currently-selected swatch is the
  // single source of truth, so opening the popup always reflects it.
  function swatchSel()        { return CFG.swatchSelector        || '.available-swatch-image'; }
  function swatchControlSel() { return CFG.swatchControlSelector || 'input[type="radio"]'; }
  function swatchIconSel()    { return CFG.swatchIconSelector    || 'img.visual-radio'; }

  function currentCardEl() {
    if (savedCardId) {
      var c = document.querySelector(CFG.cardSelector + '[' + CFG.cardIdAttr + '="' + savedCardId + '"]');
      if (c) return c;
    }
    return allCards[currentCardIndex] || null;
  }

  function getCardSwatches(card) {
    return card ? Array.prototype.slice.call(card.querySelectorAll(swatchSel())) : [];
  }

  function swatchName(sw) {
    var icon = sw.querySelector(swatchIconSel());
    if (icon && (icon.title || icon.alt)) return icon.title || icon.alt;
    var ctrl = sw.querySelector(swatchControlSel());
    return ctrl ? (ctrl.getAttribute('aria-label') || '') : '';
  }

  // NB: don't use ctrl.checked — every swatch carries a `checked` attribute
  // (boolean attribute is "present = true" regardless of value), so it reads
  // true for all. The selected one is marked by the `active` class only.
  function swatchIsSelected(sw) {
    var ctrl = sw.querySelector(swatchControlSel());
    return !!(ctrl && ctrl.classList.contains(CFG.swatchSelectedClass || 'active'));
  }

  // Render the metals row above the image from the current card's swatches.
  function renderSwatches() {
    var container = document.getElementById('nav-sheet-metals');
    if (!container) return;
    // When the PDP API is configured, the metals live in the richer variant
    // selectors (085-pdp) instead of this DOM-derived row.
    if (pdpEnabled()) { container.innerHTML = ''; container.style.display = 'none'; return; }
    var swatches = getCardSwatches(currentCardEl());
    if (swatches.length < 2) {           // nothing to choose between — hide row
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }
    var selName = '';
    var chips = swatches.map(function(sw, i) {
      var icon = sw.querySelector(swatchIconSel());
      var name = swatchName(sw);
      var src  = icon ? icon.src : '';
      var isSel = swatchIsSelected(sw);
      if (isSel) selName = name;
      var safe = name.replace(/"/g, '&quot;');
      return '<button type="button" class="nav-metal' + (isSel ? ' selected' : '') + '" data-metal="' + i +
             '" title="' + safe + '" aria-label="' + safe + '">' +
             (src ? '<img src="' + src + '" alt="">' : '') + '</button>';
    }).join('');
    // PDP layout: "Metal: <selected>" label above a row of chips. No self-fade —
    // it lives inside #nav-sheet-info and fades in with the product data.
    container.innerHTML =
      '<p class="nav-metal-label"><span class="nav-metal-key">Metal:</span> ' +
      '<span class="nav-metal-val">' + selName.replace(/</g, '&lt;') + '</span></p>' +
      '<div class="nav-metal-list">' + chips + '</div>';
    container.style.display = 'block';
  }

  // Popup metal click → drive the gallery card's swatch, then mirror back.
  function selectMetal(index) {
    var card = currentCardEl();
    if (!card) return;
    trackInterestInteraction(interestAnchorId, 'metal');
    var sw = getCardSwatches(card)[index];
    if (!sw) return;
    var control = sw.querySelector(swatchControlSel());
    if (!control) return;

    // optimistic selected state + label in the popup
    var chips = document.querySelectorAll('#nav-sheet-metals .nav-metal');
    Array.prototype.forEach.call(chips, function(c) { c.classList.remove('selected'); });
    if (chips[index]) {
      chips[index].classList.add('selected');
      var labelVal = document.querySelector('#nav-sheet-metals .nav-metal-val');
      if (labelVal) labelVal.textContent = chips[index].getAttribute('title') || '';
    }

    var img0 = card.querySelector(CFG.imageSelector);
    var oldSrc = img0 ? img0.src : '';

    control.click();   // host site swaps the card image + link for this metal

    // wait for the card image to change, then mirror it into the popup
    var tries = 0;
    var iv = setInterval(function() {
      tries++;
      var c2 = currentCardEl();
      var im = c2 ? c2.querySelector(CFG.imageSelector) : null;
      var nowSrc = im ? im.src : '';
      if ((nowSrc && nowSrc !== oldSrc) || tries > 40) {   // ~2s safety cap
        clearInterval(iv);
        applyMetalToPopup(c2 || card);
      }
    }, 50);
  }

  function applyMetalToPopup(card) {
    if (!card) return;
    savedCardId  = card.getAttribute(CFG.cardIdAttr) || savedCardId;
    savedCardImg = card.querySelector(CFG.imageSelector) || savedCardImg;
    var data = extractCardData(card);
    currentUrl = data.url;
    var hero = document.getElementById('nav-sheet-img');
    if (hero && data.src) {
      hero.style.transition = 'opacity 150ms ease';
      hero.style.opacity = '0';
      var pre = new Image();
      pre.onload = function() { hero.src = data.src; hero.style.opacity = '1'; };
      pre.src = data.src;
    }
    populateSheet(data);
    loadProductImages(data.src);
    // NB: don't renderSwatches() here — it would re-read the card's selected
    // state mid-swap and could revert the user's pick. The optimistic selection
    // set in selectMetal() already reflects the choice; a fresh render happens
    // on the next open/navigate.
  }


  // ── Item-page (PDP) enrichment via the OCC API ─────────────────────────────
  // When CFG.productApi is set: after the popup opens with gallery data, fetch
  // the real product and enrich it — full image gallery (incl. lifestyle),
  // description, real ring sizes, price, and interactive variant selectors
  // (metal / shape / carat / diamond quality). Tapping a swatch hits the OCC
  // "swatch" resolver to load the matching variant. Results are cached; a
  // per-request token discards stale responses (fast open→next/swatch spam).
  var pdpCache     = {};   // code -> product JSON
  var pdpCacheKeys = [];   // insertion order, for bounded eviction
  var pdpReqId     = 0;    // abort token
  var pdpCode      = null; // code of the product currently shown in the popup
  var PDP_CACHE_MAX = 50;

  function pdpCachePut(code, product) {
    if (!code || !product) return;
    if (!(code in pdpCache)) pdpCacheKeys.push(code);
    pdpCache[code] = product;
    while (pdpCacheKeys.length > PDP_CACHE_MAX) delete pdpCache[pdpCacheKeys.shift()];
  }

  var PDP_LABELS = {
    SWATCHMETALTYPE: 'Metal',
    SWATCHSTONESHAPE: 'Stone shape',
    SWATCHCENTERSTONECARATWEIGHT: 'Carat Weight',
    SWATCHDIAMONDQUALITY: 'Diamond Quality'
  };
  var PDP_ORDER = ['SWATCHMETALTYPE', 'SWATCHSTONESHAPE', 'SWATCHCENTERSTONECARATWEIGHT', 'SWATCHDIAMONDQUALITY'];

  function pdpEnabled() { return !!(CFG.productApi && CFG.productApi.origin); }

  function pdpEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }
  function pdpAbsUrl(u) { return u && u.charAt(0) === '/' ? (location.origin + u) : u; }
  function pdpStrip(u) { return (u || '').split('?')[0]; }   // url without query, for compare

  function pdpProductUrl(code) {
    var a = CFG.productApi;
    return a.origin + '/occ/v2/' + a.basesite + '/products/' + encodeURIComponent(code) +
      '?fields=' + encodeURIComponent(a.fields || 'FULL') +
      '&lang=' + (a.lang || 'en') + '&curr=' + (a.curr || 'USD');
  }
  function pdpSwatchUrl(code, key, value) {
    var a = CFG.productApi;
    return a.origin + '/occ/v2/' + a.basesite + '/products/swatch/' + encodeURIComponent(code) +
      '?swatchAttrKey=' + encodeURIComponent(key) +
      '&swatchAttrValue=' + encodeURIComponent(value) +
      '&lang=' + (a.lang || 'en') + '&curr=' + (a.curr || 'USD');
  }
  function pdpFetch(url) {
    return fetch(url, { headers: { Accept: 'application/json' }, credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); });
  }

  // Full-size gallery images (incl. lifestyle), ordered by galleryIndex.
  function pdpImages(product) {
    var imgs = (product.images || []).filter(function (i) {
      return i.imageType === 'GALLERY' && i.format === 'superZoom';
    });
    imgs.sort(function (a, b) { return (a.galleryIndex || 0) - (b.galleryIndex || 0); });
    return imgs.map(function (i) { return pdpAbsUrl(i.url); });
  }

  // Clear the enriched (fetched) content so the popup shows only the gallery
  // data while a new product loads — never the previous item's PDP data.
  function clearPdp() {
    var v = document.getElementById('nav-sheet-variants');
    if (v) v.innerHTML = '';
    var d = document.getElementById('nav-sheet-desc');
    if (d) d.innerHTML = '';
  }

  function loadPdp(code) {
    if (!pdpEnabled() || !code) return;
    // NB: don't clear here — showGalleryData() already reset the variant area to
    // this item's gallery metals (interim). applyPdp() swaps them in place.
    var myReq = ++pdpReqId;
    log('loadPdp', code, 'cached=' + !!pdpCache[code], 'req=' + myReq);
    if (pdpCache[code]) { applyPdp(pdpCache[code], myReq); return; }
    pdpFetch(pdpProductUrl(code)).then(function (product) {
      pdpCachePut(product && product.code, product);
      applyPdp(product, myReq);
    }).catch(function (err) { log('loadPdp failed', code, err); });
  }

  function resolveSwatch(key, value) {
    if (!pdpEnabled() || !pdpCode) return;
    var myReq = ++pdpReqId;
    var syncCard = (key !== 'SWATCHMETALTYPE');   // metals sync via native swatch click
    log('resolveSwatch', key, '=', value, 'from', pdpCode, 'req=' + myReq);
    pdpFetch(pdpSwatchUrl(pdpCode, key, value)).then(function (product) {
      pdpCachePut(product && product.code, product);
      applyPdp(product, myReq, true);   // variant change → fade-swap the image
      if (syncCard && myReq === pdpReqId) syncGalleryCard(product);
    }).catch(function (err) { log('resolveSwatch failed', key, value, err); });
  }

  // Render the product's text/variant content (everything except the hero
  // image). Safe to call synchronously on open (from cache) without disturbing
  // the View-Transition morph.
  function applyPdpContent(product) {
    if (!product) return;
    pdpCode = product.code || pdpCode;
    trackInterestProductData(interestAnchorId, product);
    cacheItemInfoIfNew(product);   // 086-iteminfo.js — reuses this already-fetched product, never a fetch of its own
    if (product.url) currentUrl = pdpAbsUrl(product.url);

    var p = product.price || {};
    renderInfo({ name: product.name, price: p.formattedValue || '', original: '' });

    var descEl = document.getElementById('nav-sheet-desc');
    if (descEl) descEl.innerHTML = product.description || '';

    renderPdpSizes(product);
    renderPdpVariants(product);
  }

  function applyPdp(product, myReq, swapImage) {
    var stale = (myReq != null && myReq !== pdpReqId);
    log('applyPdp', product && product.code, 'stale=' + stale, 'req=' + myReq + '/' + pdpReqId);
    if (!product || stale) return;   // stale — discard

    applyPdpContent(product);

    var imgs = pdpImages(product);
    if (imgs.length) {
      var hero = document.getElementById('nav-sheet-img');
      productImages = imgs;
      imgIndex = 0;
      // Only fade-swap the hero on a genuine variant change (swapImage=true).
      // On the initial open/navigate the correct image is already on screen
      // (via the morph / gallery), so leave it — continuous, no fade.
      var sameShown = hero && pdpStrip(hero.src) === pdpStrip(imgs[0]);
      if (swapImage && hero && !sameShown) {
        var myAnim = ++imgAnimId;
        hero.style.transition = 'opacity 160ms ease';
        hero.style.opacity = '0';
        setTimeout(function () {
          if (myAnim !== imgAnimId) return;
          hero.src = imgs[0];             // swap while invisible
          var fadeIn = function () {
            if (myAnim !== imgAnimId) return;
            hero.style.transition = 'opacity 200ms ease';
            hero.style.opacity = '1';
          };
          // Only fade in once decoded, so the previous image never flashes.
          if (hero.decode) hero.decode().then(fadeIn, fadeIn); else fadeIn();
        }, 160);
      }
      updateImageUI();
    }
  }

  // Product code of the card the popup is currently showing.
  function pdpCurrentCode() {
    var c = currentCardEl();
    return c ? c.getAttribute(CFG.cardIdAttr) : null;
  }

  function renderPdpSizes(product) {
    if (!product.ringSizes || !product.ringSizes.length) return;
    var sizes = product.ringSizes.map(function (s) { return s.key && s.key.value; });
    renderSizes(sizes, product.standardRingSize);
  }

  function pdpOptAttrs(o, extraClass) {
    var cls = 'nav-var-opt ' + extraClass;
    if (o.selected) cls += ' selected';
    if (o.attributeState === 'NP') cls += ' np';
    if (o.attributeState === 'OOS') cls += ' oos';
    var title = pdpEsc(o.altTag || o.key);
    return ' class="' + cls + '" data-val="' + pdpEsc(o.key) + '" title="' + title + '" aria-label="' + title + '"';
  }

  // Metal: round color chip + karat caption below (e.g. 14K / 18K / P).
  function renderMetalOpts(list) {
    return '<div class="nav-var-list">' + list.map(function (o) {
      var cap = o.imageOverlayText ? '<span class="nav-var-cap">' + pdpEsc(o.imageOverlayText) + '</span>' : '';
      return '<button type="button"' + pdpOptAttrs(o, 'nav-var-metal') + '>' +
        '<span class="nav-var-swatch"><img src="' + pdpEsc(pdpAbsUrl(o.attributeValue)) + '" alt=""></span>' + cap + '</button>';
    }).join('') + '</div>';
  }

  // Shape: rounded-square outline box with the shape icon.
  function renderShapeOpts(list) {
    return '<div class="nav-var-list">' + list.map(function (o) {
      return '<button type="button"' + pdpOptAttrs(o, 'nav-var-shape') + '>' +
        '<img src="' + pdpEsc(pdpAbsUrl(o.attributeValue)) + '" alt=""></button>';
    }).join('') + '</div>';
  }

  // Carat (and any text axis): bordered pill chips in a horizontal scroll row.
  function renderPillOpts(list) {
    return '<div class="nav-var-row">' + list.map(function (o) {
      return '<button type="button"' + pdpOptAttrs(o, 'nav-var-pill') + '>' + pdpEsc(o.key) + '</button>';
    }).join('') + '</div>';
  }

  // Diamond quality: a detail card for the selected grade + grade pills to switch.
  function renderQualityOpts(list) {
    var sel = list.filter(function (o) { return o.selected; })[0] || list[0];
    var card = '';
    if (sel) {
      card = '<div class="nav-var-qcard">' +
        (sel.swatchDiamondCost ? '<span class="nav-var-qprice">' + pdpEsc(sel.swatchDiamondCost) + '</span>' : '') +
        '<div class="nav-var-qgrade">' + pdpEsc(sel.key) + '</div>' +
        (sel.swatchDiamondColor ? '<div class="nav-var-qline">Color: ' + pdpEsc(sel.swatchDiamondColor) + '</div>' : '') +
        (sel.swatchDiamondClarity ? '<div class="nav-var-qline">Clarity: ' + pdpEsc(sel.swatchDiamondClarity) + '</div>' : '') +
        '</div>';
    }
    var pills = '<div class="nav-var-row">' + list.map(function (o) {
      return '<button type="button"' + pdpOptAttrs(o, 'nav-var-pill') + '>' + pdpEsc(o.key) + '</button>';
    }).join('') + '</div>';
    return card + pills;
  }

  function renderPdpVariants(product) {
    var wrap = document.getElementById('nav-sheet-variants');
    if (!wrap) return;
    var byKey = {};
    (product.swatchAttributesData || []).forEach(function (g) {
      byKey[g.key] = (g.value && g.value.swatchAttributesListData) || [];
    });

    var html = '';
    PDP_ORDER.forEach(function (key) {
      var list = byKey[key];
      if (!list || !list.length) return;
      var sel = list.filter(function (o) { return o.selected; })[0];
      var link = (key === 'SWATCHDIAMONDQUALITY')
        ? '<span class="nav-var-link">View grading details</span>' : '';
      var body = (key === 'SWATCHMETALTYPE') ? renderMetalOpts(list)
        : (key === 'SWATCHSTONESHAPE') ? renderShapeOpts(list)
        : (key === 'SWATCHDIAMONDQUALITY') ? renderQualityOpts(list)
        : renderPillOpts(list);
      html += '<div class="nav-var" data-key="' + pdpEsc(key) + '">' +
        '<div class="nav-var-head"><p class="nav-var-label"><span class="nav-var-key">' +
        pdpEsc(PDP_LABELS[key] || key) + ':</span> <span class="nav-var-val">' +
        pdpEsc(sel ? sel.key : '') + '</span></p>' + link + '</div>' + body + '</div>';
    });
    wrap.innerHTML = html;
  }

  // ── Skeleton placeholders (shown while the item data loads) ──────────────
  var PDP_SKEL_CHIP = '<span class="nav-skel-el nav-skel-chip"></span>';
  function pdpSkelRow(n) {
    var chips = '';
    for (var i = 0; i < n; i++) chips += PDP_SKEL_CHIP;
    return '<div class="nav-skel-row"><span class="nav-skel-el nav-skel-lbl"></span>' +
           '<div class="nav-skel-chips">' + chips + '</div></div>';
  }
  // Reserve the typical PDP rows (shape + carat) + quality card while loading,
  // so the popup opens near full height and real data swaps in with no jump.
  var PDP_SKEL_VARIANTS = pdpSkelRow(4) + pdpSkelRow(5) +
    '<div class="nav-skel-row"><span class="nav-skel-el nav-skel-lbl"></span>' +
    '<span class="nav-skel-el nav-skel-card"></span></div>';
  var PDP_SKEL_DESC = '<span class="nav-skel-el nav-skel-line"></span>' +
    '<span class="nav-skel-el nav-skel-line" style="width:88%"></span>' +
    '<span class="nav-skel-el nav-skel-line" style="width:72%"></span>';

  // Interim (uncached): render the gallery card's metals immediately (same
  // markup as the PDP variants) + skeleton placeholders for the sections the
  // fetch will fill. Metal chips are 'pending' (non-interactive) until live.
  function renderGalleryVariants() {
    var desc = document.getElementById('nav-sheet-desc');
    if (desc) desc.innerHTML = PDP_SKEL_DESC;
    var wrap = document.getElementById('nav-sheet-variants');
    if (!wrap) return;
    var swatches = (typeof getCardSwatches === 'function') ? getCardSwatches(currentCardEl()) : [];
    var metalRow;
    if (swatches.length) {
      var selName = '';
      var chips = swatches.map(function (sw) {
        var icon = sw.querySelector(swatchIconSel());
        var name = swatchName(sw);
        var isSel = swatchIsSelected(sw);
        if (isSel) selName = name;
        var src = icon ? icon.src : '';
        var safe = pdpEsc(name);
        return '<button type="button" class="nav-var-opt nav-var-metal pending' + (isSel ? ' selected' : '') +
               '" title="' + safe + '" aria-label="' + safe + '">' +
               '<span class="nav-var-swatch"><img src="' + pdpEsc(src) + '" alt=""></span></button>';
      }).join('');
      metalRow = '<div class="nav-var" data-key="SWATCHMETALTYPE">' +
        '<div class="nav-var-head"><p class="nav-var-label"><span class="nav-var-key">Metal:</span> ' +
        '<span class="nav-var-val">' + pdpEsc(selName) + '</span></p></div>' +
        '<div class="nav-var-list">' + chips + '</div></div>';
    } else {
      metalRow = pdpSkelRow(3);   // no gallery metals → skeleton for that row too
    }
    wrap.innerHTML = metalRow + PDP_SKEL_VARIANTS;
  }

  // Mirror a non-metal variant pick (shape/carat/quality) back to the gallery
  // card: it resolves to a different product, and the card has no native control
  // for those axes, so update the card's image + link directly to that product.
  function syncGalleryCard(product) {
    var card = currentCardEl();
    if (!card || !product) return;
    var img = card.querySelector(CFG.imageSelector);
    var src = product.imageUrl || (product.productImageUrls && product.productImageUrls[0]);
    if (img && src) img.src = pdpAbsUrl(src);
    var link = card.querySelector(CFG.linkSelector) || card.querySelector('a');
    if (link && product.url) link.setAttribute('href', pdpAbsUrl(product.url));
  }

  // Mirror a metal pick back to the gallery card: click its matching native
  // swatch so the card's image + link update (the site does the swap).
  function syncGalleryMetal(name) {
    var card = currentCardEl();
    if (!card || typeof getCardSwatches !== 'function') return;
    var swatches = getCardSwatches(card);
    for (var i = 0; i < swatches.length; i++) {
      if (swatchName(swatches[i]) === name) {
        var ctrl = swatches[i].querySelector(swatchControlSel());
        if (ctrl) ctrl.click();
        return;
      }
    }
  }

  // Click a variant swatch → resolve the matching product via the OCC swatch API.
  function onPdpVariantClick(e) {
    var opt = e.target.closest('.nav-var-opt');
    if (!opt) return;
    if (opt.classList.contains('selected') || opt.classList.contains('np') || opt.classList.contains('oos')) return;
    var group = opt.closest('.nav-var');
    if (!group) return;
    var key = group.getAttribute('data-key');
    var val = opt.getAttribute('data-val');
    trackInterestInteraction(interestAnchorId, key === 'SWATCHMETALTYPE' ? 'metal' : 'variant');
    // optimistic selection + label
    group.querySelectorAll('.nav-var-opt').forEach(function (o) { o.classList.remove('selected'); });
    opt.classList.add('selected');
    var lbl = group.querySelector('.nav-var-val');
    if (lbl) lbl.textContent = opt.getAttribute('title') || val;
    resolveSwatch(key, val);
    if (key === 'SWATCHMETALTYPE') syncGalleryMetal(val);   // reflect metal on the gallery card
  }


  // ── Per-item full PDP info cache (IndexedDB) — independent of interest/
  // cardstack. Persists the full product JSON forever, keyed by product
  // code, the first time each product is actually fetched by the real popup
  // (085-pdp.js's applyPdpContent() — covers a fresh loadPdp()/resolveSwatch()
  // fetch AND a pdpCache-hit render alike, since both funnel through there).
  // Deliberately does NOT fetch anything itself — it only reuses whatever
  // product data 085-pdp.js already fetched, via cacheItemInfoIfNew(product)
  // called from applyPdpContent(). A second call for an already-fetched
  // product just no-ops (see IndexedDB dedup check) — no duplicate network
  // request, ever. No distillation, no UI yet: just cache + console.log.
  var ITEMINFO_DB_NAME = 'EcommoItemInfo';
  var ITEMINFO_STORE = 'items';
  var itemInfoDbPromise = null;

  function openItemInfoDb() {
    if (itemInfoDbPromise) return itemInfoDbPromise;
    itemInfoDbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('no indexedDB')); return; }
      var req = indexedDB.open(ITEMINFO_DB_NAME, 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore(ITEMINFO_STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () {
        // If the connection ever closes on us (DB deleted from DevTools mid-session,
        // another tab bumping the version, browser storage pressure...), forget the
        // cached promise so the NEXT call reopens fresh instead of failing forever.
        req.result.onclose = function () { itemInfoDbPromise = null; };
        resolve(req.result);
      };
      req.onerror = function () { itemInfoDbPromise = null; reject(req.error); };
    });
    return itemInfoDbPromise;
  }

  function getItemInfo(id) {
    return openItemInfoDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(ITEMINFO_STORE, 'readonly');
        var req = tx.objectStore(ITEMINFO_STORE).get(id);
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function putItemInfo(record) {
    return openItemInfoDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(ITEMINFO_STORE, 'readwrite');
        tx.objectStore(ITEMINFO_STORE).put(record);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  // Pulls out the fields that actually signal a *choice* (which metal was
  // picked vs. which others were on offer, stone/style/price point) out of
  // the much larger raw product blob — everything else in `product` is
  // rendering plumbing (image URLs, badges, disclaimers...) with nothing to
  // infer from. Full raw product is still kept as-is in IndexedDB; this is
  // just what's worth looking at on a quick console scan.
  function summarizeItemChoices(product) {
    var metalSwatch = (product.swatchAttributesData || []).filter(function (g) { return g.key === 'SWATCHMETALTYPE'; })[0];
    var metalOptions = metalSwatch ? (metalSwatch.value.swatchAttributesListData || []).map(function (o) {
      return o.key + (o.selected ? ' ← selected' : '') + (o.attributeState === 'OOS' ? ' (out of stock)' : '');
    }) : [];
    var price = product.price || {};
    return {
      name: product.name,
      category: product.jewelryType || product.productType,
      style: product.ringStyle,
      price: price.formattedValue,
      onSale: !!price.percentageDiscount,
      discountPct: price.percentageDiscount || undefined,
      metal: [product.metal1GoldKarat, product.metal1Color, product.metal1Type].filter(Boolean).join(' ') || undefined,
      metalOptions: metalOptions.length ? metalOptions : undefined,
      stoneType: product.stone1Type,
      stoneShape: product.stone1Shape,
      stoneCarat: product.stone1DiamondTotalWeight || product.stone1CaratRange,
      stoneColor: product.stone1GiaColor,
      stoneClarity: product.stone1GiaClarity,
      stoneSetting: product.stone1Setting
    };
  }

  // product: the full object 085-pdp.js already resolved (fresh fetch or
  // pdpCache hit) — never fetched here, only persisted the first time we see it.
  function cacheItemInfoIfNew(product) {
    if (!product || !product.code) return;
    var id = product.code;
    getItemInfo(id).then(function (existing) {
      if (existing) { log('iteminfo: already cached', id); return; }
      var record = { id: id, product: product, fetchedAt: Date.now() };
      putItemInfo(record).catch(function (err) { log('iteminfo: save failed', id, err); });
      console.log('[iteminfo]', id, summarizeItemChoices(product));
    }).catch(function (err) {
      // IndexedDB unavailable (e.g. a restrictive private-browsing mode) —
      // no cache, but still surface the data at least once.
      log('iteminfo: db read failed', id, err);
      console.log('[iteminfo] (uncached)', id, summarizeItemChoices(product));
    });
  }

  // ── Card-stack support (0655-swipestack.js's onCardShown hook) — the
  // swipe-stack overlay (both 066-interest.js's catch-up and 067-cardstack.js)
  // never opens the real popup, so there's no applyPdpContent() call to
  // piggyback on here. This DOES fetch on its own — but only for the single
  // item currently on top of the stack, exactly one request per card shown,
  // same guards as the real-popup path (pdpCache / IndexedDB dedup first).
  function cacheCurrentStackItemInfo(id) {
    if (!pdpEnabled() || !id) return;
    if (pdpCache[id]) { cacheItemInfoIfNew(pdpCache[id]); return; }   // already fetched elsewhere — just persist it
    getItemInfo(id).then(function (existing) {
      if (existing) return;   // already have it — nothing to do
      pdpFetch(pdpProductUrl(id)).then(function (product) {
        pdpCachePut(product && product.code, product);   // warm the shared cache too — a real popup open later skips straight to it
        cacheItemInfoIfNew(product);
      }).catch(function (err) { log('iteminfo: stack fetch failed', id, err); });
    }).catch(function (err) { log('iteminfo: db read failed (stack)', id, err); });
  }

  function getAllItemInfo() {
    return openItemInfoDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(ITEMINFO_STORE, 'readonly');
        var req = tx.objectStore(ITEMINFO_STORE).getAll();
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  // Generic tally — how many summaries share each value of keyFn, most-common
  // first. `(none)` groups anything missing/blank so it doesn't just vanish
  // from the count.
  function countBy(items, keyFn) {
    var counts = {};
    items.forEach(function (item) {
      var k = keyFn(item);
      if (k == null || k === '') k = '(none)';
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.keys(counts)
      .map(function (k) { return { value: k, count: counts[k] }; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  function priceBand(formatted) {
    var n = priceToNumber(formatted);   // 03-sheet.js — not duplicated
    if (!n) return 'unknown';
    if (n < 500) return '<$500';
    if (n < 1000) return '$500–999';
    if (n < 2000) return '$1000–1999';
    return '$2000+';
  }

  // On-demand aggregate view across every product viewed so far — one table
  // per parameter, so a pattern (e.g. "mostly white gold, mostly on sale")
  // is visible at a glance instead of scrolling per-item logs.
  function reportItemChoices() {
    getAllItemInfo().then(function (records) {
      var summaries = records.map(function (r) { return summarizeItemChoices(r.product); });
      console.log('[iteminfo] report —', summaries.length, 'items viewed');
      console.log('%cMetal', 'font-weight:bold');
      console.table(countBy(summaries, function (s) { return s.metal; }));
      console.log('%cCategory', 'font-weight:bold');
      console.table(countBy(summaries, function (s) { return s.category; }));
      console.log('%cStone shape', 'font-weight:bold');
      console.table(countBy(summaries, function (s) { return s.stoneShape; }));
      console.log('%cPrice band', 'font-weight:bold');
      console.table(countBy(summaries, function (s) { return priceBand(s.price); }));
      console.log('%cOn sale?', 'font-weight:bold');
      console.table(countBy(summaries, function (s) { return s.onSale ? 'on sale' : 'full price'; }));
    }).catch(function (err) { log('iteminfo: report failed', err); });
  }

  // ── Debug-only inspection surface — console access, never a page UI. ──────
  if (DEBUG) {
    window.__ecommoItemInfo = { get: getItemInfo, summarize: summarizeItemChoices, report: reportItemChoices };
  }


  // ── Start enabled ──────────────────────────────────────────────────────────
  try { console.info('%c[ecommo]%c build ' + BUILD_ID, 'color:#4dde0b;font-weight:700', 'color:inherit'); } catch (e) {}
  enable();


})();
