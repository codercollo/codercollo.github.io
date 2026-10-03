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
 * │  HOP_HEIGHT_VH   (default 28) — peak arc height in viewport-height %.   │
 * │                                 Increase for bigger, floatier hops.     │
 * │  MOBILE_HOPS     (default 3)  — hop count on screens ≤ 599 px.         │
 * │  MOBILE_HEIGHT   (default 18) — arc height (vh) on mobile.             │
 * │  POP_DURATION_MS (default 600)— pop-out rise time in milliseconds.     │
 * │  PAUSE_MS        (default 700)— pause + wiggle hold time before bounce. │
 * │  HOP_DURATION_MS (default 480)— time for each single hop arc (ms).     │
 * │                                 Total bounce ≈ HOP_COUNT × HOP_DURATION │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────────────── */

  const IMAGE_SRC      = 'assets/mascot/mascot.jpeg';
  const SESSION_KEY    = 'heroMascotPlayed';

  // Desktop
  const HOP_COUNT      = 5;
  const HOP_HEIGHT_VH  = 28;   // viewport-height percent for peak arc
  const HOP_DURATION_MS= 480;  // ms per hop

  // Mobile (≤ 599px)
  const MOBILE_HOPS    = 3;
  const MOBILE_HEIGHT  = 18;
  const MOBILE_HOP_MS  = 420;

  // Phase durations
  const LOAD_DELAY_MS  = 600;  // delay after window.load
  const POP_DURATION_MS= 600;  // pop-out rise
  const PAUSE_MS       = 700;  // pause + wiggle before bounce

  /* ── Guards ─────────────────────────────────────────────────────── */

  // 1. Only run on index.html (root "/" or "index.html")
  const path = window.location.pathname;
  if (!/\/(index\.html)?$/.test(path)) return;

  // 2. Respect prefers-reduced-motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // 3. Play only once per session
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
  } catch (_) { /* storage blocked — allow animation to run */ }

  /* ── Helpers ────────────────────────────────────────────────────── */

  /** Returns a Promise that resolves after `ms` milliseconds. */
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  /** Runs a Web Animations API animation and returns a Promise that
   *  resolves when it finishes (or rejects if cancelled). */
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

    // Clip container — creates the "burrow" overflow clip
    const clip = document.createElement('div');
    clip.className = 'hero-mascot-clip';

    // Image
    const img = document.createElement('img');
    img.className  = 'hero-mascot-img';
    img.src        = IMAGE_SRC;
    img.alt        = '';         // decorative
    img.draggable  = false;

    // Start fully below the clip so it's invisible
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
   * We place the fixed stage so its top edge lines up with that border,
   * making the gopher look like it's rising from behind it.
   */
  function positionStage(stage) {
    const header = document.querySelector('header');
    if (!header) {
      // fallback: dock to bottom of viewport
      stage.style.top  = 'auto';
      stage.style.bottom = '0';
      return;
    }
    const rect = header.getBoundingClientRect();
    // rect.bottom = distance from viewport top to header's bottom edge
    stage.style.top    = rect.bottom + 'px';
    stage.style.bottom = 'auto';
  }

  /* ── Suppress / restore scroll-peek mascot ──────────────────────── */

  /**
   * While the hero animation runs we hide all .gopher-wrap elements
   * so the two gophers never appear simultaneously.
   * We restore visibility when we're done.
   */
  function suppressScrollPeek() {
    document.querySelectorAll('.gopher-wrap').forEach((el) => {
      el.dataset.heroHidden = el.style.visibility || '';
      el.style.visibility = 'hidden';
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
    // Fade in quickly as it rises
    await runAnim(
      img,
      [
        { transform: 'translateY(100%)', opacity: 0 },
        { transform: 'translateY(0%)',   opacity: 1 },
      ],
      {
        duration: POP_DURATION_MS,
        easing:   'cubic-bezier(.34,1.56,.64,1)',  // overshoot / spring
        fill:     'forwards',
      }
    );
    // Commit final state
    img.style.transform = 'translateY(0%)';
    img.style.opacity   = '1';
  }

  /** Phase 2 — Tiny head-tilt wiggle while paused. */
  async function phaseWiggle(img) {
    await runAnim(
      img,
      [
        { transform: 'translateY(0%) rotate(0deg)'  },
        { transform: 'translateY(0%) rotate(-5deg)', offset: 0.2 },
        { transform: 'translateY(0%) rotate(5deg)',  offset: 0.5 },
        { transform: 'translateY(0%) rotate(-3deg)', offset: 0.75 },
        { transform: 'translateY(0%) rotate(0deg)'  },
      ],
      {
        duration: PAUSE_MS,
        easing:   'ease-in-out',
        fill:     'forwards',
      }
    );
    img.style.transform = 'translateY(0%) rotate(0deg)';
  }

  /**
   * Phase 3 — Bounce across screen left → right.
   *
   * Strategy:
   *   We animate the img element with translateX (in vw) for the
   *   horizontal sweep and a series of translateY arcs that peak in the
   *   middle of each hop.  Each hop is slightly lower than the last
   *   (decaying energy).  Squash/stretch + rotation follow direction.
   *
   *   Because clip.overflow is 'hidden' and the stage is position:fixed,
   *   we first detach img from the clip and reattach it directly to the
   *   stage so it can move freely across the full viewport width.
   */
  async function phaseBounce(stage, clip, img, isMobile) {
    const hops    = isMobile ? MOBILE_HOPS    : HOP_COUNT;
    const peakVh  = isMobile ? MOBILE_HEIGHT  : HOP_HEIGHT_VH;
    const hopMs   = isMobile ? MOBILE_HOP_MS  : HOP_DURATION_MS;

    // --- Detach from clip, re-parent to stage for free movement ---
    // Record clip's position relative to the stage so we can match the start
    const clipRect  = clip.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();

    // Where the gopher currently is (left edge, relative to stage)
    const startLeft = clipRect.left - stageRect.left;
    const imgW      = img.getBoundingClientRect().width;

    // Detach from clip
    clip.removeChild(img);
    stage.removeChild(clip);   // clip no longer needed
    stage.appendChild(img);

    // Place img at the exact position it was visually
    img.style.position  = 'absolute';
    img.style.left      = startLeft + 'px';
    img.style.bottom    = '0';
    img.style.top       = 'auto';
    img.style.transform = 'none';
    img.style.opacity   = '1';

    // --- Build keyframes for the multi-hop bounce ---
    // We'll animate left + transform (translateY + scaleX/Y + rotate) together.
    // leftPx goes from startLeft → past the right edge of the viewport.
    const vpW     = window.innerWidth;
    const endLeft = vpW + imgW + 20;   // a little past the right edge

    // Distribute hop boundaries evenly
    const totalDx = endLeft - startLeft;
    const keyframes = [];

    for (let i = 0; i <= hops; i++) {
      const progress = i / hops;          // 0 → 1
      const leftPx   = startLeft + totalDx * progress;

      // Energy decay: first hop tallest, last hop nearly flat
      const energy = 1 - (i / hops) * 0.65;
      const peakPx = peakVh * window.innerHeight / 100 * energy;

      // We'll generate three sub-frames per hop: takeoff, peak, landing
      // But for the Web Animations API we generate one keyframe per
      // "event" point and let the easing do the work.
      //
      // Simplification: emit a keyframe at each landing point (translateY = 0)
      // and use "easing: ease-in" on the way down and "ease-out" on way up.
      // The API doesn't expose per-segment easing easily in all browsers, so
      // we produce enough offsets to describe the parabola explicitly.

      const isLanding = i > 0;  // first point is the start, not a landing
      const rot       = i < hops ? 8 : 0;   // slight forward lean during flight

      // At each landing / ground contact point:
      const landingTransform = isLanding
        ? `translateY(0px) scaleX(1.12) scaleY(0.88) rotate(${rot}deg)` // squash
        : 'translateY(0px) scaleX(1) scaleY(1) rotate(0deg)';

      keyframes.push({
        offset:    progress,
        left:      leftPx + 'px',
        transform: landingTransform,
      });

      // Insert an arc-peak keyframe halfway between this landing and the next
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

    // Sort by offset (they're already in order but let's be safe)
    keyframes.sort((a, b) => a.offset - b.offset);

    const totalBounceDuration = hops * hopMs;

    await runAnim(img, keyframes, {
      duration: totalBounceDuration,
      easing:   'linear',    // per-keyframe easing via offsets
      fill:     'forwards',
    });
  }

  /** Phase 4 — Roll/hop off the right edge, then remove from DOM. */
  async function phaseExit(img) {
    await runAnim(
      img,
      [
        { transform: 'translateY(0px) rotate(0deg)',   opacity: 1 },
        { transform: 'translateY(-30px) rotate(20deg)', opacity: 1, offset: 0.4 },
        { transform: 'translateY(10px) rotate(45deg)',  opacity: 0 },
      ],
      {
        duration: 350,
        easing:   'ease-in',
        fill:     'forwards',
      }
    );
    img.remove();
  }

  /* ── Main orchestrator ──────────────────────────────────────────── */

  async function runHeroAnimation() {
    // Skip if user has already scrolled past the hero
    const header = document.querySelector('header');
    if (header) {
      const heroBottom = header.getBoundingClientRect().bottom;
      if (heroBottom < 0) return;   // hero already above viewport
    }
    if (window.scrollY > window.innerHeight * 0.6) return;

    // Mark as played for this session
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (_) {}

    // Detect mobile
    const isMobile = window.innerWidth < 600;

    // Suppress scroll-peek gophers
    suppressScrollPeek();

    // Build elements
    const { stage, clip, img } = buildElements();

    // Position stage at the hero border
    positionStage(stage);

    try {
      await phasePopOut(img);
      await phaseWiggle(img);
      await phaseBounce(stage, clip, img, isMobile);
      await phaseExit(img);
    } catch (_) {
      // Animation was cancelled (e.g. element removed early) — clean up
      try { img.remove(); }  catch (_) {}
      try { stage.remove(); } catch (_) {}
    } finally {
      // Always clean up the stage and restore scroll-peek
      try { stage.remove(); } catch (_) {}
      restoreScrollPeek();
    }
  }

  /* ── Entry point: fire after full page load + delay ─────────────── */

  window.addEventListener('load', () => {
    setTimeout(runHeroAnimation, LOAD_DELAY_MS);
  });

})();
