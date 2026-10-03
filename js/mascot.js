/**
 * Collins Kimani — mascot.js
 *
 * Injects a peeking Go Gopher into the divider line before each major section.
 * Uses IntersectionObserver only — no scroll event listeners.
 * Pure CSS transforms/opacity for all animation.
 *
 * WHAT CHANGED vs the original:
 *  - Removed the window.innerWidth < 600 guard — mobile now sees the gopher.
 *  - IntersectionObserver threshold lowered to 0.1 (was 0.15); rootMargin
 *    kept at '0px 0px -10% 0px' — fires reliably on tall mobile sections.
 *  - will-change added to img only at peek start, removed after sink finishes.
 *  - touch-action: auto set on injected elements.
 *  - Tilt angle reduced on very narrow screens (< 400px) so it stays inside
 *    the clip box without clipping the face.
 */

(function () {
  'use strict';

  /* ── 0. Respect prefers-reduced-motion ─────────────────────────── */
  /* Screen size / touch does NOT trigger this guard.                  */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ── 1. Config ──────────────────────────────────────────────────── */

  /**
   * IMAGE_SRC — path relative to the page being loaded.
   * Works for all pages in the root directory.
   */
  const IMAGE_SRC = 'assets/mascot/mascot.jpeg';

  /**
   * SECTION_CONFIGS — each entry maps a CSS selector to the side
   * the gopher peeks from and the tilt angle in degrees.
   * Tweak the array to add/remove sections or adjust sides.
   */
  const SECTION_CONFIGS = [
    { selector: '#projects',                             side: 'right', tilt:  6 },
    { selector: '[aria-labelledby="skills-heading"]',    side: 'left',  tilt: -5 },
    { selector: '[aria-labelledby="notes-heading"]',     side: 'right', tilt:  8 },
    { selector: '[aria-labelledby="writing-heading"]',   side: 'left',  tilt: -7 },
    { selector: '[aria-labelledby="elsewhere-heading"]', side: 'right', tilt:  4 },
  ];

  /**
   * Timing constants (ms).
   * PEEK_HOLD    — how long the gopher stays up before retreating.
   * WIGGLE_DELAY — slight pause before the wiggle starts (must be < PEEK_HOLD).
   */
  const PEEK_HOLD    = 1500;
  const WIGGLE_DELAY =  200;

  /* ── 2. Build and inject gopher elements ────────────────────────── */

  function buildGopher(side, tiltDeg) {
    /*
      DOM structure injected before each section's <hr>:

      <div class="gopher-wrap" data-side="left|right" aria-hidden="true">
        <div class="gopher-clip">
          <img class="gopher-img" … />
        </div>
      </div>
    */

    // On very narrow screens, reduce the tilt so the gopher stays inside the clip.
    const effectiveTilt = window.innerWidth < 400
      ? Math.sign(tiltDeg) * Math.min(Math.abs(tiltDeg), 4)
      : tiltDeg;

    const wrap = document.createElement('div');
    wrap.className = 'gopher-wrap';
    wrap.setAttribute('data-side', side);
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.touchAction = 'auto';

    const clip = document.createElement('div');
    clip.className = 'gopher-clip';
    clip.style.touchAction = 'auto';

    const img = document.createElement('img');
    img.className  = 'gopher-img';
    img.src        = IMAGE_SRC;
    img.alt        = '';             // decorative — hidden from screen readers
    img.draggable  = false;
    img.style.touchAction = 'auto';
    img.style.transform   = `translateY(100%) rotate(${effectiveTilt}deg)`;

    clip.appendChild(img);
    wrap.appendChild(clip);
    return { wrap, clip, img, tilt: effectiveTilt };
  }

  /* ── 3. Animation controller for one gopher ────────────────────── */

  function makePeekController(clip, img, tiltDeg) {
    let peekTimer   = null;
    let wiggleTimer = null;
    let isPeeking   = false;

    function peek() {
      if (isPeeking) return;
      isPeeking = true;

      // will-change only while actively animating
      img.style.willChange = 'transform, opacity';

      clip.classList.remove('is-sinking', 'is-wiggling');
      img.style.transform = `translateY(100%) rotate(${tiltDeg}deg)`;

      // Force reflow so removing 'is-sinking' is committed before 'is-peeking'
      void clip.offsetWidth;

      clip.classList.add('is-peeking');

      // Wiggle after a short pause
      wiggleTimer = setTimeout(() => {
        clip.classList.add('is-wiggling');
        setTimeout(() => clip.classList.remove('is-wiggling'), 750);
      }, WIGGLE_DELAY);

      // Sink back after PEEK_HOLD
      peekTimer = setTimeout(sink, PEEK_HOLD);
    }

    function sink() {
      if (!isPeeking) return;
      isPeeking = false;
      clearTimeout(wiggleTimer);
      clip.classList.remove('is-peeking', 'is-wiggling');
      clip.classList.add('is-sinking');

      // Remove will-change after the sink transition finishes (~1.3s total)
      setTimeout(() => {
        img.style.willChange = '';
      }, 1400);
    }

    function reset() {
      clearTimeout(peekTimer);
      clearTimeout(wiggleTimer);
      isPeeking = false;
      img.style.willChange = '';
      clip.classList.remove('is-peeking', 'is-sinking', 'is-wiggling');
      img.style.transform = `translateY(100%) rotate(${tiltDeg}deg)`;
    }

    return { peek, sink, reset };
  }

  /* ── 4. Wire up IntersectionObserver ────────────────────────────── */

  function initSection(config) {
    const section = document.querySelector(config.selector);
    if (!section) return;

    // Find the <hr class="section-divider"> immediately before this section
    const divider = section.previousElementSibling;
    if (!divider || divider.tagName !== 'HR') return;

    const { wrap, clip, img, tilt } = buildGopher(config.side, config.tilt);
    const ctrl = makePeekController(clip, img, tilt);

    // Insert the gopher wrap right before the <hr>
    divider.parentNode.insertBefore(wrap, divider);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            ctrl.peek();
          } else {
            // Section left view — reset so it re-triggers cleanly next time
            ctrl.reset();
          }
        });
      },
      {
        // 0.1 fires reliably on mobile where tall sections may barely exceed 0.15
        threshold:  0.1,
        // Slight bottom margin so the gopher appears as the section scrolls in
        rootMargin: '0px 0px -10% 0px',
      }
    );

    observer.observe(section);
  }

  /* ── 5. Kick off after DOM is ready ─────────────────────────────── */

  function init() {
    SECTION_CONFIGS.forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
