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

  const IMAGE_SRC      = 'assets/mascot/mascot.png';
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
   * Wraps a GSAP tween in a Promise so it integrates cleanly with the
   * existing async/await orchestration.  Only this helper and the four
   * phase functions below were changed — everything else is untouched.
   */
  function gsapPromise(target, vars) {
    return new Promise((resolve) => {
      gsap.to(target, { ...vars, onComplete: resolve });
    });
  }

  function gsapFromToPromise(target, fromVars, toVars) {
    return new Promise((resolve) => {
      gsap.fromTo(target, fromVars, { ...toVars, onComplete: resolve });
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
    clip.style.width = 'clamp(56px, 13vw, 110px)';

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

  /* ── Billowing SVG Dust Clouds ─────────────────────────────────── */

  /**
   * Builds an organic multi-lobed SVG cloud puff with layered billows.
   * mix-blend-mode: multiply and subtle blur ensure a seamless natural blend
   * against the ivory/parchment background.
   */
  function createCloudSVG() {
    const wrap = document.createElement('div');
    wrap.className = 'hero-dust-cloud';
    wrap.style.position      = 'absolute';
    wrap.style.bottom        = '0px';
    wrap.style.width         = '76px';
    wrap.style.height        = '48px';
    wrap.style.pointerEvents = 'none';
    wrap.style.mixBlendMode  = 'multiply';
    wrap.style.filter        = 'blur(0.8px)';
    wrap.style.zIndex        = '199';

    wrap.innerHTML = `
      <svg viewBox="0 0 92 56" width="100%" height="100%" style="overflow: visible; display: block;" xmlns="http://www.w3.org/2000/svg">
        <!-- Outer organic billow: warm parchment dust tone -->
        <path d="M 6,52 C 1,42 4,28 14,24 C 11,13 22,5 34,7 C 42,1 56,1 66,9 C 76,5 88,15 85,28 C 92,35 91,47 82,52 Z" 
              fill="#c5beaf" opacity="0.85" />
        <!-- Inner cloud layer for natural puff volume -->
        <path d="M 16,50 C 11,40 16,29 26,25 C 28,17 38,11 48,13 C 55,7 66,11 71,19 C 78,25 77,39 70,50 Z" 
              fill="#ded7cb" opacity="0.9" />
        <!-- Core cloud billow -->
        <circle cx="45" cy="31" r="17" fill="#b8af9f" opacity="0.55" />
        <!-- Small trailing puff at edge -->
        <circle cx="16" cy="38" r="9"  fill="#c5beaf" opacity="0.75" />
        <circle cx="75" cy="39" r="10" fill="#c5beaf" opacity="0.75" />
      </svg>
    `;
    return wrap;
  }

  /**
   * Spawns 2 soft, organic SVG cloud puffs that swell outward at the left
   * and right of the burrow line, plus accompanying motes, dissipating softly
   * into the background.
   */
  function spawnBillowingDustClouds(stage, centerX, mascotWidth = 80) {
    if (!stage) return;
    const halfWidth = mascotWidth * 0.44;

    // ── 1. Left Billowing Cloud ─────────────────────────────────────
    const leftCloud = createCloudSVG();
    leftCloud.style.left            = (centerX - halfWidth - 56) + 'px';
    leftCloud.style.transformOrigin = 'bottom right';
    stage.appendChild(leftCloud);

    gsap.set(leftCloud, { scale: 0.18, x: 14, y: 4, opacity: 0 });
    gsap.timeline({ onComplete: () => leftCloud.remove() })
      .to(leftCloud, {
        scale:    1.12,
        x:        -32,
        y:        -14,
        opacity:  0.88,
        duration: 0.36,
        ease:     'power2.out',
      })
      .to(leftCloud, {
        scale:    1.45,
        x:        -62,
        y:        -24,
        opacity:  0,
        duration: 0.68,
        ease:     'power1.out',
      });

    // ── 2. Right Billowing Cloud (flipped horizontally) ─────────────
    const rightCloud = createCloudSVG();
    rightCloud.style.left            = (centerX + halfWidth - 18) + 'px';
    rightCloud.style.transformOrigin = 'bottom left';
    stage.appendChild(rightCloud);

    gsap.set(rightCloud, { scale: 0.18, scaleX: -0.18, x: -14, y: 4, opacity: 0 });
    gsap.timeline({ onComplete: () => rightCloud.remove() })
      .to(rightCloud, {
        scale:    1.12,
        scaleX:   -1.12,
        x:        32,
        y:        -14,
        opacity:  0.88,
        duration: 0.36,
        ease:     'power2.out',
      })
      .to(rightCloud, {
        scale:    1.45,
        scaleX:   -1.45,
        x:        62,
        y:        -24,
        opacity:  0,
        duration: 0.68,
        ease:     'power1.out',
      });

    // ── 3. Dispersing dust motes ─────────────────────────────────────
    const moteColors = ['#b8af9f', '#c5beaf', '#ded7cb'];
    for (let i = 0; i < 8; i++) {
      const isLeft = i % 2 === 0;
      const dot    = document.createElement('span');
      const size   = gsap.utils.random(3.5, 7);

      dot.style.position      = 'absolute';
      dot.style.bottom        = '0px';
      dot.style.width         = size + 'px';
      dot.style.height        = size + 'px';
      dot.style.borderRadius  = '50%';
      dot.style.background    = moteColors[i % moteColors.length];
      dot.style.pointerEvents = 'none';
      dot.style.mixBlendMode  = 'multiply';
      dot.style.zIndex        = '199';

      const originX = isLeft
        ? centerX - halfWidth + gsap.utils.random(-8, 4)
        : centerX + halfWidth + gsap.utils.random(-4, 8);

      dot.style.left = originX + 'px';
      stage.appendChild(dot);

      gsap.set(dot, { scale: 0.4, opacity: gsap.utils.random(0.7, 0.95) });

      const xDist = isLeft ? gsap.utils.random(-22, -55) : gsap.utils.random(22, 55);
      const yRise = gsap.utils.random(-10, -28);

      gsap.to(dot, {
        x:        xDist,
        y:        yRise,
        scale:    gsap.utils.random(1.2, 1.8),
        opacity:  0,
        duration: gsap.utils.random(0.55, 0.85),
        ease:     'power2.out',
        onComplete: () => dot.remove(),
      });
    }
  }

  /* ── Quiet animation acts (A → B → C, run sequentially) ─────────── */

  /**
   * Act A — Gentle Float-In & Drift.
   * Mascot fades + rises softly from behind the border, bobs twice with
   * a slow breathing idle, then drifts right and fades out.
   * No bouncing, no rotation, no squash — pure calm.
   */
  async function actA(stage, clip, img) {
    const stageRect = stage.getBoundingClientRect();
    const clipRect  = clip.getBoundingClientRect();
    const stageW    = stageRect.width || vpWidth();
    const imgW      = img.getBoundingClientRect().width || 80;
    let   startLeft = Math.max(0, clipRect.left - stageRect.left);

    // ── Soft rise from clip ──────────────────────────────────────────
    img.style.willChange = 'transform, opacity';
    gsap.set(img, { y: '100%', opacity: 0 });

    // Spawn billowing dust clouds as mascot breaches the burrow line
    setTimeout(() => spawnBillowingDustClouds(stage, startLeft + imgW / 2, imgW), 200);

    await gsapPromise(img, {
      y:        '0%',
      opacity:  1,
      duration: 1.1,
      ease:     'power2.out',
    });

    // ── Detach from clip so it can move freely ───────────────────────
    clip.removeChild(img);
    if (clip.parentNode === stage) stage.removeChild(clip);
    stage.appendChild(img);
    img.style.position = 'absolute';
    img.style.left     = startLeft + 'px';
    img.style.bottom   = '0';
    img.style.top      = 'auto';
    img.style.opacity  = '1';
    gsap.set(img, { y: 0 });

    // ── Gentle breathing bob (two slow cycles) ───────────────────────
    img.style.willChange = 'transform';
    await new Promise((resolve) => {
      gsap.timeline({ onComplete: resolve })
        .to(img, { y: -10, duration: 0.9, ease: 'sine.inOut' })
        .to(img, { y:   0, duration: 0.9, ease: 'sine.inOut' })
        .to(img, { y:  -8, duration: 0.8, ease: 'sine.inOut' })
        .to(img, { y:   0, duration: 0.8, ease: 'sine.inOut' });
    });

    // ── Drift right + fade out ───────────────────────────────────────
    img.style.willChange = 'transform, left, opacity';
    await gsapPromise(img, {
      left:    (stageW - imgW) + 'px',
      opacity: 0,
      duration: 2.2,
      ease:    'power1.inOut',
    });
    img.style.willChange = '';
    img.remove();
  }

  /**
   * Act B — Peek & Retreat.
   * A fresh mascot rises just enough to show its head over the border,
   * holds with a slow side-to-side sway, then sinks back down quietly.
   * The mascot never crosses the screen.
   */
  async function actB(stage) {
    const clip2 = document.createElement('div');
    clip2.className = 'hero-mascot-clip';
    clip2.style.width = 'clamp(56px, 13vw, 110px)';
    const img2  = document.createElement('img');
    img2.className = 'hero-mascot-img';
    img2.src       = IMAGE_SRC;
    img2.alt       = '';
    img2.draggable = false;
    gsap.set(img2, { y: '100%', opacity: 0 });
    clip2.appendChild(img2);
    stage.appendChild(clip2);

    // ── Gentle rise to peek (shows ~55% of image) ────────────────────
    img2.style.willChange = 'transform, opacity';

    // Spawn billowing dust clouds as mascot emerges to peek
    const stageW = stage.getBoundingClientRect().width || vpWidth();
    const imgW2  = img2.getBoundingClientRect().width || 80;
    setTimeout(() => spawnBillowingDustClouds(stage, stageW / 2, imgW2), 180);

    await gsapPromise(img2, { y: '45%', opacity: 1, duration: 1.0, ease: 'power1.out' });

    // ── Slow side-to-side sway ───────────────────────────────────────
    img2.style.willChange = 'transform';
    await new Promise((resolve) => {
      gsap.timeline({ onComplete: resolve })
        .to(img2, { rotation:  4, duration: 0.9, ease: 'sine.inOut' })
        .to(img2, { rotation: -4, duration: 1.1, ease: 'sine.inOut' })
        .to(img2, { rotation:  2, duration: 0.8, ease: 'sine.inOut' })
        .to(img2, { rotation:  0, duration: 0.6, ease: 'sine.inOut' });
    });

    // ── Sink back below border ───────────────────────────────────────
    img2.style.willChange = 'transform, opacity';
    await gsapPromise(img2, { y: '100%', opacity: 0, duration: 1.0, ease: 'power2.in' });
    img2.style.willChange = '';
    clip2.remove();
  }

  /**
   * Act C — Slow Glide (single smooth sine-arc).
   * A fresh mascot fades in at the left, rides one wide gentle sine arc
   * across the full width, and fades out at the right edge.
   * No individual hops — one continuous, wave-like motion.
   */
  async function actC(stage) {
    const stageW = stage.getBoundingClientRect().width || vpWidth();
    const vh     = vpHeight();

    const img3  = document.createElement('img');
    img3.className = 'hero-mascot-img';
    img3.src       = IMAGE_SRC;
    img3.alt       = '';
    img3.draggable = false;
    img3.style.position = 'absolute';
    img3.style.left     = '0px';
    img3.style.bottom   = '0';
    img3.style.top      = 'auto';
    stage.appendChild(img3);
    const imgW = img3.getBoundingClientRect().width || 80;
    gsap.set(img3, { opacity: 0, y: 0 });

    // ── Single smooth wave-arc glide ─────────────────────────────────
    img3.style.willChange = 'transform, left, opacity';
    await new Promise((resolve) => {
      gsap.timeline({ onComplete: resolve })
        .to(img3, {
          left:    (stageW / 2 - imgW / 2) + 'px',
          y:       -(vh * 0.12),
          opacity: 1,
          duration: 2.0,
          ease:    'sine.inOut',
        })
        .to(img3, {
          left:    (stageW - imgW) + 'px',
          y:       0,
          opacity: 0,
          duration: 2.0,
          ease:    'sine.inOut',
        });
    });
    img3.style.willChange = '';
    img3.remove();
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

    suppressScrollPeek();

    const { stage, clip, img } = buildElements();
    positionStage(stage);

    try {
      // ── Act A: Gentle Float-In & Drift ──────────────────────────────
      await actA(stage, clip, img);

      // Brief breath between acts
      await wait(600);

      // ── Act B: Peek & Retreat ────────────────────────────────────────
      await actB(stage);

      // Brief breath between acts
      await wait(500);

      // ── Act C: Slow Scroll-Along ─────────────────────────────────────
      await actC(stage);

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
  window.addEventListener('scroll', () => {
    const stage = document.querySelector('.hero-mascot-stage');
    if (stage) positionStage(stage);
  }, { passive: true });

  /* ── Entry point: fire after full page load + delay ─────────────── */

  window.addEventListener('load', () => {
    setTimeout(runHeroAnimation, LOAD_DELAY_MS);
  });

})();
