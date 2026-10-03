/*
 * Collins Kimani — Personal Portfolio
 * js/main.js
 *
 * Minimal vanilla JS. The page works without this file.
 * This script only adds progressive enhancement:
 *   1. Applies no-animation class when prefers-reduced-motion is set
 *   2. Graceful HTMX fallback: hide "show more" buttons if HTMX fails to load
 */

(function () {
  'use strict';

  /* ─── Reduced motion guard ──────────────────────── */
  const prefersReduced = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  if (prefersReduced) {
    document.documentElement.classList.add('motion-safe-off');
  }

  /* ─── HTMX fallback ─────────────────────────────── */
  // If HTMX is not available (e.g., offline), hide progressive-enhancement
  // buttons that would otherwise do nothing when clicked.
  window.addEventListener('load', function () {
    if (typeof htmx === 'undefined') {
      const htmxButtons = document.querySelectorAll('[hx-get]');
      htmxButtons.forEach(function (btn) {
        const container = btn.closest('[id$="-container"]');
        if (container) {
          container.style.display = 'none';
        }
      });
    }
  });

})();
