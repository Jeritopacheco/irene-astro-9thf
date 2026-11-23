/* No dependencies. Geometry is also exported for the local Node verification. */
(function () {
  'use strict';
  const PERIOD = 20000;
  const MAX_SCALE = 1.18;
  const MARGIN = 16;
  // Proposal copy only: critically damped follow with a speed ceiling, so a flick
  // or a jump to an anchor can never whip the planets faster than MAX_SPEED
  // (fractions of the orbit per second). Velocity is continuous: no snaps at
  // wheel notches, at the start or at the stop.
  const SMOOTH_TIME_S = .28;
  const MAX_SPEED = .62;
  const MAX_DT_MS = 50;
  const SETTLE_EPSILON = .0001;
  const SETTLE_SPEED = .002;

  function smoothDamp(current, goal, velocity, dt) {
    const omega = 2 / SMOOTH_TIME_S;
    const x = omega * dt;
    const decay = 1 / (1 + x + .48 * x * x + .235 * x * x * x);
    const limit = MAX_SPEED * SMOOTH_TIME_S;
    const change = Math.max(-limit, Math.min(limit, current - goal));
    const reach = current - change;
    const temp = (velocity + omega * change) * dt;
    let nextVelocity = (velocity - omega * temp) * decay;
    let next = reach + (change + temp) * decay;
    if ((goal - current > 0) === (next > goal)) { // never overshoot the scroll target
      next = goal;
      nextVelocity = 0;
    }
    return { value: next, velocity: nextVelocity };
  }

  // boxSize is measured from the untransformed CSS box, including transparent PNG edges.
  function position(elapsed, opposite, width, height, boxSize) {
    const phase = elapsed / PERIOD * Math.PI * 2;
    const side = opposite ? 1 : -1;
    const depth = side * Math.tanh(5 * Math.cos(phase - Math.PI / 4));
    const scale = 1 + .18 * depth;
    const radius = boxSize * MAX_SCALE / 2;
    const travelX = .8 * Math.max(0, width / 2 - radius - MARGIN);
    const travelY = Math.max(0, Math.min(travelX * .65, .8 * (height / 2 - radius - MARGIN)));
    return {
      x: side * Math.cos(phase) * travelX,
      y: side * Math.cos(phase) * travelY,
      depth, scale
    };
  }

  function reaction(positions, x, y, reach) {
    // Identity, not scale/depth, determines which disk excites the letters.
    const p = positions[1];
    const distanceSquared = ((p.x - x) ** 2 + (p.y - y) ** 2) / (reach * reach);
    return Math.exp(-(distanceSquared ** 2));
  }

  function progress(scrollY, start, travel) {
    return travel > 0 ? Math.max(0, Math.min(1, (scrollY - start) / travel)) : 0;
  }

  function mount(doc, win) {
    const orbit = doc.querySelector('.orbit');
    const planets = [...doc.querySelectorAll('.planet')];
    const letters = [...doc.querySelectorAll('.monogram span')];
    const constellation = doc.querySelector('.constellation');
    const stage = doc.querySelector('.scroll-stage');
    const hero = doc.querySelector('.hero');
    let start = 0;
    let travel = 0;
    let frame = null;
    let width = 0;
    let height = 0;
    let boxSize = 0;
    let target = 0;
    let rendered = 0;
    let velocity = 0;
    let lastTime = null;
    let initialized = false;

    function paint() {
      const elapsed = rendered * PERIOD;
      const positions = planets.map((_, index) => position(elapsed, index === 1, width, height, boxSize));
      planets.forEach((element, index) => {
        const p = positions[index];
        element.style.transform = `translate(-50%, -50%) translate(${p.x}px, ${p.y}px) scale(${p.scale})`;
        // Masks and three sibling planes are permanent CSS identities.
      });
      letters.forEach((letter, index) => {
        const r = reaction(positions, letter.offsetLeft + letter.offsetWidth / 2 - letter.parentElement.offsetWidth / 2, 0, boxSize * 1.1);
        letter.style.transform = `perspective(500px) rotateX(${r * 6}deg) rotateY(${r * 44}deg) rotate(${r * (index === 1 ? -5 : 5)}deg)`;
      });
      const phase = elapsed / PERIOD * Math.PI * 2;
      // Translation is outermost; all rotations share the fixed top-center pivot.
      constellation.style.transform = `translateX(-40%) perspective(500px) rotateZ(${18 * Math.sin(phase)}deg) rotateY(${25 * Math.sin(phase)}deg)`;
    }
    function resize() {
      stage.setAttribute('data-scroll', 'active');
      travel = win.innerHeight * 1.5;
      stage.style.height = `${hero.offsetHeight + travel}px`;
      // On very short screens let the whole composition scroll into view before
      // pinning its bottom (including the prompt). Account for that inset exactly.
      const inset = Math.min(0, win.innerHeight - hero.offsetHeight);
      hero.style.top = `${inset}px`;
      start = stage.getBoundingClientRect().top + win.scrollY - inset;
      width = orbit.clientWidth;
      height = orbit.clientHeight;
      boxSize = planets[0].offsetWidth;
      target = progress(win.scrollY, start, travel);
      if (!initialized) {
        rendered = target; // Restored scroll must mount at its actual pose.
        initialized = true;
      }
      paint(); // Keep the rendered phase through geometry changes.
      schedule();
    }
    function cancel() {
      if (frame !== null) win.cancelAnimationFrame(frame);
      frame = null;
      lastTime = null;
    }
    function tick(now) {
      frame = null;
      const dt = Math.max(0, Math.min(MAX_DT_MS, now - lastTime)) / 1000;
      lastTime = now;
      const step = smoothDamp(rendered, target, velocity, dt);
      rendered = step.value;
      velocity = step.velocity;
      if (Math.abs(target - rendered) <= SETTLE_EPSILON && Math.abs(velocity) <= SETTLE_SPEED) {
        rendered = target;
        velocity = 0;
      }
      paint();
      if (rendered === target) lastTime = null;
      else schedule();
    }
    function schedule() {
      if (!doc.hidden && frame === null && rendered !== target) {
        if (lastTime === null) lastTime = win.performance.now();
        frame = win.requestAnimationFrame(tick);
      }
    }
    function onScroll() {
      target = progress(win.scrollY, start, travel);
      schedule();
    }
    doc.addEventListener('visibilitychange', () => { cancel(); if (!doc.hidden) resize(); });
    win.addEventListener('scroll', onScroll, { passive: true });
    win.addEventListener('resize', resize);
    orbit.setAttribute('data-motion', '');
    resize();

  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { position, reaction, progress, smoothDamp, mount, PERIOD, MAX_SCALE, MARGIN, MAX_SPEED };
  if (typeof document !== 'undefined') mount(document, window);
})();
