/**
 * Collins Kimani — mascot.js
 *
 * Injects a peeking Go Gopher into the divider line before each major section.
 * Uses IntersectionObserver only — no scroll event listeners.
 * Pure CSS transforms/opacity for all animation.
 */

(function () {
  'use strict';

  /* ── 0. Respect prefers-reduced-motion ─────────────────────── */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ── 1. Config ──────────────────────────────────────────────── */

  /**
   * IMAGE_SRC: path relative to whichever page is loaded.
   * Works for pages in the root. If you add notes pages, update accordingly.
   */
  const IMAGE_SRC = 'assets/mascot/mascot.jpeg';

  /**
   * SECTIONS: CSS selectors for each section that gets a mascot.
   * The gopher will appear in the divider BEFORE this element.
   * Tweak this array to add/remove sections.
   */
  const SECTION_CONFIGS = [
    { selector: '#projects',          side: 'right', tilt:  6  },
    { selector: '[aria-labelledby="skills-heading"]',  side: 'left',  tilt: -5  },
    { selector: '[aria-labelledby="notes-heading"]',   side: 'right', tilt:  8  },
    { selector: '[aria-labelledby="writing-heading"]', side: 'left',  tilt: -7  },
    { selector: '[aria-labelledby="elsewhere-heading"]',side: 'right', tilt:  4  },
  ];

  /**
   * Timing constants (ms).
   * PEEK_HOLD  – how long the gopher stays up before retreating.
   * WIGGLE_DELAY – slight pause before the wiggle starts (must be < PEEK_HOLD).
   */
  const PEEK_HOLD    = 1500;
  const WIGGLE_DELAY =  200;

  /* ── 2. Build and inject gopher elements ────────────────────── */

  function buildGopher(side, tiltDeg) {
    /*
      DOM structure injected before each section's <hr>:

      <div class="gopher-wrap" data-side="left|right">
        <div class="gopher-clip">
          <img class="gopher-img" … />
        </div>
      </div>
    */

    const wrap = document.createElement('div');
    wrap.className = 'gopher-wrap';
    wrap.setAttribute('data-side', side);
    wrap.setAttribute('aria-hidden', 'true');

    const clip = document.createElement('div');
    clip.className = 'gopher-clip';

    const img = document.createElement('img');
    img.className   = 'gopher-img';
    img.src         = IMAGE_SRC;
    img.alt         = '';              // decorative — hidden from screen readers
    img.draggable   = false;
    img.style.transform = `translateY(100%) rotate(${tiltDeg}deg)`;

    clip.appendChild(img);
    wrap.appendChild(clip);
    return { wrap, clip, img };
  }

  /* ── 3. Animation controller for one gopher ────────────────── */

  function makePeekController(clip, img, tiltDeg) {
    let peekTimer   = null;
    let wiggleTimer = null;
    let isPeeking   = false;

    function peek() {
      if (isPeeking) return;
      isPeeking = true;

      // Reset any previous sink state
      clip.classList.remove('is-sinking', 'is-wiggling');

      // Restore the base tilt as a CSS custom property so keyframes can override
      img.style.transform = `translateY(100%) rotate(${tiltDeg}deg)`;

      // Force a reflow so removing 'is-sinking' is picked up before adding 'is-peeking'
      void clip.offsetWidth;

      clip.classList.add('is-peeking');

      // Small wiggle after a moment
      wiggleTimer = setTimeout(() => {
        clip.classList.add('is-wiggling');
        // Remove wiggle class after animation completes (~700ms)
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
    }

    function reset() {
      clearTimeout(peekTimer);
      clearTimeout(wiggleTimer);
      isPeeking = false;
      clip.classList.remove('is-peeking', 'is-sinking', 'is-wiggling');
      img.style.transform = `translateY(100%) rotate(${tiltDeg}deg)`;
    }

    return { peek, sink, reset };
  }

  /* ── 4. Wire up IntersectionObserver ────────────────────────── */

  function initSection(config) {
    const section = document.querySelector(config.selector);
    if (!section) return;

    // Find the <hr class="section-divider"> immediately before this section
    const divider = section.previousElementSibling;
    if (!divider || divider.tagName !== 'HR') return;

    const { wrap, clip, img } = buildGopher(config.side, config.tilt);
    const ctrl = makePeekController(clip, img, config.tilt);

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
        threshold: 0.15,   // fire when 15% of the section is visible
        rootMargin: '0px 0px -10% 0px',  // slight bottom margin to feel natural
      }
    );

    observer.observe(section);
  }

  /* ── 5. Kick off after DOM is ready ────────────────────────── */

  function init() {
    SECTION_CONFIGS.forEach(initSection);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
