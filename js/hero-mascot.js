/**
 * Collins Kimani — hero-mascot.js
 *
 * One-time "hero entrance" animation for the Go Gopher mascot.
 * Plays once per browser session when the visitor lands at the top of index.html.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  TWEAKING GUIDE                                                         │
 * │                                                                         │
 * │  HOP_COUNT       (default 5)  — number of bounce arcs across screen.   │
 * │                                 Fewer = faster crossing; more = slower. │
 * │  HOP_HEIGHT_VH   (default 25) — peak arc height in viewport-height %.  │
 * │                                 Increase for bigger, floatier hops.     │
 * │  MOBILE_HOPS     (default 4)  — hops on screens ≤ 599px wide.          │
 * │  MOBILE_HEIGHT   (default 18) — arc height (vh) on mobile.             │
 * │  POP_DURATION_MS (default 600)— pop-out rise time in milliseconds.     │
 * │  PAUSE_MS        (default 700)— pause + wiggle hold before bounce.      │
 * │  HOP_DURATION_MS (default 480)— time for each single hop arc (ms).     │
 * │                                 Total bounce ≈ HOP_COUNT × HOP_DURATION │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * WHAT CHANGED vs the original:
 *  - isMobile no longer hides on < 600px — it only picks hop count/height.
 *  - Viewport height uses visualViewport.height (falls back to window.innerHeight)
 *    so the mobile browser address bar doesn't throw off positioning.
 *  - Bounce start X clamped so the gopher always starts on-screen (no overflow).
 *  - Bounce end X = vpW so the gopher exits at exactly the right edge, no more.
 *    The stage has overflow-x: clip (CSS) to block any scrollbar from arcs.
 *  - will-change applied per-phase and removed on finish.
 *  - Debounced orientationchange / resize listener recalculates sizes without
 *    replaying the animation (it only matters before the animation fires).
 *  - positionStage uses visualViewport offset + height for accurate placement.
 *  - MOBILE_HOPS increased to 4 (was 3) for a nicer crossing on phones.
 */

(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────────────── */

  const IMAGE_SRC      = 'assets/mascot/mascot.jpeg';
  const SESSION_KEY    = 'heroMascotPlayed';

  // Desktop
  const HOP_COUNT      = 5;
  const HOP_HEIGHT_VH  = 25;   // % of viewport height for peak arc
  const HOP_DURATION_MS= 480;  // ms per hop

  // Mobile (≤ 599px wide)
  const MOBILE_HOPS    = 4;
  const MOBILE_HEIGHT  = 18;
  const MOBILE_HOP_MS  = 400;

  // Phase durations
  const LOAD_DELAY_MS  = 600;  // ms delay after window.load
  const POP_DURATION_MS= 600;  // pop-out rise
  const PAUSE_MS       = 700;  // pause + wiggle before bounce

  /* ── Guards ─────────────────────────────────────────────────────── */

  // 1. Only run on index.html (root "/" or "index.html")
  const path = window.location.pathname;
  if (!/\/(index\.html)?$/.test(path)) return;

  // 2. Respect prefers-reduced-motion only — never check screen size here
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // 3. Play only once per session
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
  } catch (_) { /* storage blocked — allow animation to run */ }

  /* ── Viewport helpers ───────────────────────────────────────────── */

  /**
   * Returns the visible viewport height, accounting for the mobile
   * browser chrome (address bar). Falls back to window.innerHeight.
   */
  function vpHeight() {
    return (window.visualViewport && window.visualViewport.height)
      ? window.visualViewport.height
      : window.innerHeight;
  }

  /**
   * Returns the visible viewport width. Uses visualViewport when available
   * so pinch-zoom doesn't affect calculations.
   */
  function vpWidth() {
    return (window.visualViewport && window.visualViewport.width)
      ? window.visualViewport.width
      : window.innerWidth;
  }

  /* ── Helpers ────────────────────────────────────────────────────── */

  /** Returns a Promise that resolves after `ms` milliseconds. */
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  /**
   * Wraps element.animate() in a Promise.
   * Resolves on finish, rejects on cancel.
   */
  function runAnim(el, keyframes, options) {
    return new Promise((resolve, reject) => {
      const anim = el.animate(keyframes, options);
      anim.onfinish = resolve;
      anim.oncancel = reject;
    });
  }

  /* ── Build DOM ──────────────────────────────────────────────────── */

  function buildElements() {
    // Stage — fixed full-width strip, z-index 200
    const stage = document.createElement('div');
    stage.className = 'hero-mascot-stage';
    stage.setAttribute('aria-hidden', 'true');

    // Clip container — creates the "burrow" overflow clip during pop-out
    const clip = document.createElement('div');
    clip.className = 'hero-mascot-clip';

    // Image
    const img = document.createElement('img');
    img.className = 'hero-mascot-img';
    img.src       = IMAGE_SRC;
    img.alt       = '';          // decorative
    img.draggable = false;

    // Start fully hidden below clip
    img.style.transform = 'translateY(100%)';
    img.style.opacity   = '0';

    clip.appendChild(img);
    stage.appendChild(clip);
    document.body.appendChild(stage);

    return { stage, clip, img };
  }

  /* ── Position stage flush with hero bottom border ───────────────── */

  /**
   * The hero <header> has a bottom border (border-b border-divider).
   * We place the fixed stage so its top edge aligns with that border,
   * making the gopher look like it rises from behind it.
   *
   * Uses visualViewport.offsetTop so the address bar's current height
   * is taken into account on mobile.
   */
  function positionStage(stage) {
    const header = document.querySelector('header');
    if (!header) {
      stage.style.top    = 'auto';
      stage.style.bottom = '0';
      return;
    }
    const rect = header.getBoundingClientRect();
    // rect.bottom is relative to the layout viewport; add visualViewport offset
    const vvOffsetTop = (window.visualViewport && window.visualViewport.offsetTop) || 0;
    stage.style.top    = (rect.bottom + vvOffsetTop) + 'px';
    stage.style.bottom = 'auto';
  }

  /* ── Suppress / restore scroll-peek mascot ──────────────────────── */

  /**
   * Hides all .gopher-wrap elements while the hero animation runs so
   * two gophers never appear simultaneously.
   * Restored in the finally block regardless of success/failure.
   */
  function suppressScrollPeek() {
    document.querySelectorAll('.gopher-wrap').forEach((el) => {
      el.dataset.heroHidden = el.style.visibility || '';
      el.style.visibility   = 'hidden';
    });
  }

  function restoreScrollPeek() {
    document.querySelectorAll('.gopher-wrap').forEach((el) => {
      el.style.visibility = el.dataset.heroHidden || '';
      delete el.dataset.heroHidden;
    });
  }

  /* ── Animation phases ───────────────────────────────────────────── */

  /** Phase 1 — Pop out from behind the hero border line. */
  async function phasePopOut(img) {
    img.style.willChange = 'transform, opacity';
    await runAnim(
      img,
      [
        { transform: 'translateY(100%)', opacity: 0 },
        { transform: 'translateY(0%)',   opacity: 1 },
      ],
      {
        duration: POP_DURATION_MS,
        easing:   'cubic-bezier(.34,1.56,.64,1)',
        fill:     'forwards',
      }
    );
    img.style.transform  = 'translateY(0%)';
    img.style.opacity    = '1';
    img.style.willChange = '';
  }

  /** Phase 2 — Tiny head-tilt wiggle while paused. */
  async function phaseWiggle(img) {
    img.style.willChange = 'transform';
    await runAnim(
      img,
      [
        { transform: 'translateY(0%) rotate(0deg)'   },
        { transform: 'translateY(0%) rotate(-5deg)', offset: 0.2 },
        { transform: 'translateY(0%) rotate(5deg)',  offset: 0.5 },
        { transform: 'translateY(0%) rotate(-3deg)', offset: 0.75 },
        { transform: 'translateY(0%) rotate(0deg)'   },
      ],
      {
        duration: PAUSE_MS,
        easing:   'ease-in-out',
        fill:     'forwards',
      }
    );
    img.style.transform  = 'translateY(0%) rotate(0deg)';
    img.style.willChange = '';
  }

  /**
   * Phase 3 — Bounce across screen left → right.
   *
   * The gopher is detached from the clip container so it can move freely
   * across the full viewport width.  Keyframes are built in px (measured
   * at runtime) so they adapt to any screen size.
   *
   * Horizontal overflow is blocked by `overflow-x: clip` on the stage (CSS)
   * so no horizontal scrollbar ever appears.
   */
  async function phaseBounce(stage, clip, img, isMobile) {
    const hops   = isMobile ? MOBILE_HOPS   : HOP_COUNT;
    const peakVh = isMobile ? MOBILE_HEIGHT : HOP_HEIGHT_VH;
    const hopMs  = isMobile ? MOBILE_HOP_MS : HOP_DURATION_MS;

    // ── Measure positions before detaching ──────────────────────────
    const clipRect  = clip.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const imgW      = img.getBoundingClientRect().width || 80;

    // Where the gopher's left edge is, relative to the stage
    let startLeft = clipRect.left - stageRect.left;

    // Clamp so the gopher always starts fully on-screen (never negative)
    startLeft = Math.max(0, startLeft);

    // ── Detach from clip, re-parent to stage ────────────────────────
    clip.removeChild(img);
    if (clip.parentNode === stage) stage.removeChild(clip);
    stage.appendChild(img);

    img.style.position  = 'absolute';
    img.style.left      = startLeft + 'px';
    img.style.bottom    = '0';
    img.style.top       = 'auto';
    img.style.transform = 'none';
    img.style.opacity   = '1';
    img.style.willChange = 'transform, left, opacity';

    // ── Build keyframes ──────────────────────────────────────────────
    const vw = vpWidth();
    const vh = vpHeight();

    // End: right edge of the viewport (overflow-x:clip stops the scrollbar)
    const endLeft = vw - imgW;   // exit right at the viewport edge

    const totalDx  = endLeft - startLeft;
    const keyframes = [];

    for (let i = 0; i <= hops; i++) {
      const progress = i / hops;
      const leftPx   = startLeft + totalDx * progress;

      // Energy decay: first hop tallest, last hop ~35% height
      const energy  = 1 - (i / hops) * 0.65;
      const peakPx  = (peakVh / 100) * vh * energy;

      const isLanding = i > 0;
      const rot       = i < hops ? 8 : 0;

      // Landing keyframe — squash on ground contact
      const landingTransform = isLanding
        ? `translateY(0px) scaleX(1.12) scaleY(0.88) rotate(${rot}deg)`
        : 'translateY(0px) scaleX(1) scaleY(1) rotate(0deg)';

      keyframes.push({ offset: progress, left: leftPx + 'px', transform: landingTransform });

      // Arc-peak keyframe at the midpoint between this landing and the next
      if (i < hops) {
        const nextProgress = (i + 1) / hops;
        const midProgress  = (progress + nextProgress) / 2;
        const midLeftPx    = startLeft + totalDx * midProgress;

        keyframes.push({
          offset:    midProgress,
          left:      midLeftPx + 'px',
          transform: `translateY(-${peakPx}px) scaleX(0.9) scaleY(1.12) rotate(${rot * 0.5}deg)`,
        });
      }
    }

    keyframes.sort((a, b) => a.offset - b.offset);

    await runAnim(img, keyframes, {
      duration: hops * hopMs,
      easing:   'linear',
      fill:     'forwards',
    });

    img.style.willChange = '';
  }

  /** Phase 4 — Roll/hop off the right edge, remove from DOM. */
  async function phaseExit(img) {
    img.style.willChange = 'transform, opacity';
    await runAnim(
      img,
      [
        { transform: 'translateY(0px) rotate(0deg)',    opacity: 1 },
        { transform: 'translateY(-30px) rotate(20deg)', opacity: 1, offset: 0.4 },
        { transform: 'translateY(10px)  rotate(45deg)', opacity: 0 },
      ],
      {
        duration: 350,
        easing:   'ease-in',
        fill:     'forwards',
      }
    );
    img.style.willChange = '';
    img.remove();
  }

  /* ── Main orchestrator ──────────────────────────────────────────── */

  async function runHeroAnimation() {
    // Skip if user has already scrolled past the hero
    const header = document.querySelector('header');
    if (header) {
      const heroBottom = header.getBoundingClientRect().bottom;
      if (heroBottom < 0) return;
    }
    // Also skip if scrolled more than 60% of the visible viewport height
    if (window.scrollY > vpHeight() * 0.6) return;

    // Mark played for this session
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (_) {}

    // Determine mobile breakpoint based on actual viewport width
    const isMobile = vpWidth() < 600;

    suppressScrollPeek();

    const { stage, clip, img } = buildElements();
    positionStage(stage);

    try {
      await phasePopOut(img);
      await phaseWiggle(img);
      await phaseBounce(stage, clip, img, isMobile);
      await phaseExit(img);
    } catch (_) {
      // Animation cancelled (element removed externally) — clean up silently
      try { img.remove();   } catch (_) {}
      try { stage.remove(); } catch (_) {}
    } finally {
      try { stage.remove(); } catch (_) {}
      restoreScrollPeek();
    }
  }

  /* ── Orientation / resize handling ──────────────────────────────── */

  /**
   * On orientation change or resize, re-position the stage if it exists.
   * We do NOT replay the animation — the sessionStorage flag prevents it.
   * Debounced to 200ms so it doesn't fire on every pixel of resize drag.
   */
  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const stage = document.querySelector('.hero-mascot-stage');
      if (stage) positionStage(stage);
    }, 200);
  }

  window.addEventListener('resize',            onResize, { passive: true });
  window.addEventListener('orientationchange', onResize, { passive: true });

  /* ── Entry point: fire after full page load + delay ─────────────── */

  window.addEventListener('load', () => {
    setTimeout(runHeroAnimation, LOAD_DELAY_MS);
  });

})();
