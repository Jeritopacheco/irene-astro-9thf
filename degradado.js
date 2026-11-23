/* Degradado que sigue al cursor en los botones, las tarjetas y las cabeceras de precio.
   Solo escribe dos variables CSS (--mx, --my, en porcentaje) en cada elemento;
   los colores viven en styles.css. Sin dependencias. */
(function () {
  'use strict';
  const SELECTOR = '.proposal-button, .proposal-tile, .proposal-plan, .proposal-navigation';
  const REST = { x: 50, y: 40 };
  const noHover = window.matchMedia('(hover: none)');
  const EASE = .16;
  const LIMIT = { min: -30, max: 130 };
  const elements = [...document.querySelectorAll(SELECTOR)].map((element) => ({
    element, x: REST.x, y: REST.y, tx: REST.x, ty: REST.y,
  }));
  if (!elements.length) return;

  let pointer = null;
  let frame = 0;

  const clamp = (value) => Math.max(LIMIT.min, Math.min(LIMIT.max, value));

  function aim() {
    elements.forEach((item) => {
      if (!pointer) {
        item.tx = REST.x;
        item.ty = REST.y;
        return;
      }
      const rect = item.element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      item.tx = clamp((pointer.x - rect.left) / rect.width * 100);
      item.ty = clamp((pointer.y - rect.top) / rect.height * 100);
    });
    start();
  }

  function paint(item) {
    item.element.style.setProperty('--mx', item.x.toFixed(2) + '%');
    item.element.style.setProperty('--my', item.y.toFixed(2) + '%');
  }

  function tick(now) {
    frame = 0;
    let moving = false;
    if (noHover.matches && !pointer) {
      // Sin cursor (teléfono/tableta): el brillo se desliza solo, para que siempre se vea el movimiento.
      const t = now / 1000;
      elements.forEach((item, index) => {
        item.tx = 50 + 38 * Math.sin(t * .6 + index * 1.3);
        item.ty = 42 + 30 * Math.cos(t * .5 + index * .9);
      });
      moving = true;
    }
    elements.forEach((item) => {
      const dx = item.tx - item.x;
      const dy = item.ty - item.y;
      if (Math.abs(dx) < .05 && Math.abs(dy) < .05) {
        if (item.x !== item.tx || item.y !== item.ty) { item.x = item.tx; item.y = item.ty; paint(item); }
        return;
      }
      item.x += dx * EASE;
      item.y += dy * EASE;
      paint(item);
      moving = true;
    });
    if (moving) start();
  }

  function start() {
    if (!frame) frame = window.requestAnimationFrame(tick);
  }

  window.addEventListener('pointermove', (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    aim();
  }, { passive: true });
  window.addEventListener('scroll', () => { if (pointer) aim(); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer = null; aim(); });
  document.addEventListener('focusin', (event) => {
    const item = elements.find((entry) => entry.element === event.target);
    if (item && event.target.matches(':focus-visible')) { pointer = null; item.tx = 50; item.ty = 50; start(); }
  });
  elements.forEach(paint);
  if (noHover.matches) start();
})();
