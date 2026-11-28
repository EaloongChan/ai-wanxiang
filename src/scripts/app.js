/* Site script: the only thing every page needs is the phone menu. */
(function () {
  'use strict';
  var btn = document.getElementById('menuBtn');
  var nav = document.getElementById('nav');
  if (!btn || !nav) return;

  // The labels are written into the button at build time, one pair per language.
  var openLabel = btn.getAttribute('data-open-label') || 'Open menu';
  var closeLabel = btn.getAttribute('data-close-label') || 'Close menu';

  function setOpen(open) {
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? closeLabel : openLabel);
  }

  btn.addEventListener('click', function () {
    setOpen(!nav.classList.contains('open'));
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('open')) {
      setOpen(false);
      btn.focus();
    }
  });

  document.addEventListener('click', function (e) {
    if (nav.classList.contains('open') && !nav.contains(e.target) && !btn.contains(e.target)) setOpen(false);
  });

  // Leaving phone width with the menu open would leave an open menu nobody can see or close.
  window.matchMedia('(min-width: 721px)').addEventListener('change', function (e) {
    if (e.matches) setOpen(false);
  });
})();
