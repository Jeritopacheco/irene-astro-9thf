/* Estrellas fugaces suaves para la propuesta. Sin dependencias.
   Un cielo muy ligero de fondo; cada cierto tiempo cruza una estrella fugaz.
   Al pasar el cursor (o enfocar con teclado) un botón, tarjeta o cabecera, llueven estrellas
   que CAEN sobre el elemento: cada una sigue una curva suave, frena al llegar y se apaga con
   un destello. Nunca giran ni orbitan: la cola sale de las posiciones reales recientes.

   Decisión de Jeremy (23 nov): el movimiento se ve SIEMPRE, sin importar la preferencia de
   "movimiento reducido" del sistema (Windows, iOS, Android, macOS). En pantallas sin cursor
   (teléfono, tableta) no hay hover: caen solas sobre un botón visible cada pocos segundos y
   también al tocarlo. */
(function () {
  'use strict';
  const canvas = document.querySelector('.proposal-stars');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const noHover = window.matchMedia('(hover: none)');
  const TARGETS = '.proposal-button, .proposal-tile, .proposal-plan, .contact-link, .nav-links a, .footer a';
  const GOLD = '220,184,110';
  const IVORY = '243,234,217';
  const AMBER = '253,192,65';
  const MAX_AMBIENT_METEORS = 3;
  const MAX_ARRIVALS = 9;

  let w = 0;
  let h = 0;
  let lastW = 0;
  let lastH = 0;
  let ambient = [];
  let meteors = [];
  let flares = [];
  let target = null;
  let halo = 0;
  let frame = 0;
  let last = 0;
  let nextMeteor = 0;
  let nextArrival = 0;
  let nextDemo = 0;
  let demoUntil = 0;

  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const easeOut = (t) => 1 - Math.pow(1 - t, 2.2);

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    lastW = w;
    lastH = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(70, Math.max(24, (w * h) / 20000)));
    ambient = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: rand(.4, 1.2),
      base: rand(.1, .3), speed: rand(.4, 1.2), phase: rand(0, 6.28),
    }));
  }

  /* Estrella fugaz de fondo: línea recta que frena muy poco a poco (como las de verdad). */
  function spawnMeteor() {
    const angle = rand(.45, .75); // hacia abajo y a la izquierda
    const speed = rand(380, 560);
    const fromTop = Math.random() < .6;
    meteors.push({
      kind: 'ambient',
      x: fromTop ? rand(w * .3, w * 1.1) : w + 30,
      y: fromTop ? -30 : rand(-30, h * .45),
      vx: -Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      age: 0, life: rand(1.6, 2.4), peak: rand(.5, .75), tail: .34,
      color: pick([GOLD, IVORY, AMBER]), trail: [],
    });
  }

  /* Estrella que cae sobre el elemento: curva de Bézier suave con frenado. */
  function spawnArrival(rect) {
    const lx = rect.left + rect.width * rand(.12, .88);
    const ly = rect.top + rect.height * rand(.2, .85);
    const angle = rand(-2.9, -.25); // llegan desde arriba, de cualquier lado
    const distance = rand(300, 560);
    const sx = lx + Math.cos(angle) * distance;
    const sy = ly + Math.sin(angle) * distance;
    const bend = rand(-.14, .14) * distance;
    const nx = -(ly - sy) / distance;
    const ny = (lx - sx) / distance;
    meteors.push({
      kind: 'arrival', age: 0, life: rand(.85, 1.4), peak: rand(.6, .85), tail: .24,
      p0: { x: sx, y: sy }, p2: { x: lx, y: ly },
      p1: { x: (sx + lx) / 2 + nx * bend, y: (sy + ly) / 2 + ny * bend },
      color: pick([GOLD, IVORY, AMBER]), trail: [], x: sx, y: sy,
    });
  }

  function bezier(m, e) {
    const a = (1 - e) * (1 - e);
    const b = 2 * (1 - e) * e;
    const c = e * e;
    return { x: a * m.p0.x + b * m.p1.x + c * m.p2.x, y: a * m.p0.y + b * m.p1.y + c * m.p2.y };
  }

  function advance(m, dt) {
    m.age += dt;
    if (m.kind === 'arrival') {
      const t = Math.min(1, m.age / m.life);
      const p = bezier(m, easeOut(t));
      m.x = p.x;
      m.y = p.y;
      const fadeIn = Math.min(1, t / .12);
      const fadeOut = t > .72 ? Math.max(0, 1 - (t - .72) / .28) : 1;
      m.alpha = m.peak * fadeIn * fadeOut;
      if (t >= 1 && !m.landed) {
        m.landed = true;
        flares.push({ x: m.x, y: m.y, age: 0, color: m.color });
        halo = Math.min(.9, halo + .1);
      }
    } else {
      const drag = Math.exp(-.35 * dt);
      m.vx *= drag;
      m.vy *= drag;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const t = m.age / m.life;
      m.alpha = m.peak * Math.min(1, m.age / .15) * (t > .7 ? Math.max(0, 1 - (t - .7) / .3) : 1);
    }
    m.trail.push({ x: m.x, y: m.y, t: m.age });
    while (m.trail.length > 2 && m.age - m.trail[0].t > m.tail) m.trail.shift();
  }

  function drawMeteor(m) {
    const pts = m.trail;
    if (pts.length < 2 || m.alpha <= .01) return;
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      const f = i / (pts.length - 1);
      ctx.strokeStyle = `rgba(${m.color},${m.alpha * f * f})`;
      ctx.lineWidth = .4 + 1.7 * f;
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 7);
    glow.addColorStop(0, `rgba(${m.color},${m.alpha * .7})`);
    glow.addColorStop(1, `rgba(${m.color},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 7, 0, 6.2832);
    ctx.fill();
  }

  function drawFlare(f) {
    const t = f.age / .4;
    const radius = 4 + 12 * t;
    const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, radius);
    glow.addColorStop(0, `rgba(${f.color},${.55 * (1 - t)})`);
    glow.addColorStop(1, `rgba(${f.color},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(f.x, f.y, radius, 0, 6.2832);
    ctx.fill();
  }

  function tick(now) {
    frame = 0;
    const dt = Math.max(0, Math.min(.05, (now - last) / 1000));
    last = now;
    ctx.clearRect(0, 0, w, h);

    ambient.forEach((s) => {
      const alpha = s.base * (.55 + .45 * Math.sin(s.phase + now / 1000 * s.speed));
      ctx.fillStyle = `rgba(${IVORY},${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 6.2832);
      ctx.fill();
    });

    if (noHover.matches) {
      if (target && demoUntil && now >= demoUntil) { release(target); demoUntil = 0; nextDemo = now + rand(4500, 8000); }
      else if (!target && now >= nextDemo) {
        const visible = [...document.querySelectorAll(TARGETS)].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.top > h * .1 && r.bottom < h * .9 && r.right > 0 && r.left < w;
        });
        nextDemo = now + 1500;
        if (visible.length) { engage(pick(visible)); demoUntil = now + 2600; }
      }
    }

    const rect = target ? target.getBoundingClientRect() : null;
    const onScreen = rect && rect.width > 0 && rect.bottom > 0 && rect.top < h && rect.right > 0 && rect.left < w;

    if (now >= nextMeteor && meteors.filter((m) => m.kind === 'ambient').length < MAX_AMBIENT_METEORS) {
      spawnMeteor();
      nextMeteor = now + rand(2200, 6000);
    }
    if (onScreen && now >= nextArrival && meteors.filter((m) => m.kind === 'arrival').length < MAX_ARRIVALS) {
      spawnArrival(rect);
      nextArrival = now + rand(130, 230);
    }

    meteors = meteors.filter((m) => {
      advance(m, dt);
      const finished = m.age >= m.life + m.tail || (m.kind === 'ambient' && m.age > .5 && (m.y > h + 60 || m.x < -60));
      if (finished) return false;
      drawMeteor(m);
      return true;
    });

    flares = flares.filter((f) => {
      f.age += dt;
      if (f.age >= .4) return false;
      drawFlare(f);
      return true;
    });

    const resting = onScreen ? .28 : 0;
    halo += (resting - halo) * Math.min(1, 3 * dt);
    if (onScreen && halo > .02) {
      ctx.strokeStyle = `rgba(${GOLD},${halo * .55})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(rect.left - 5, rect.top - 5, rect.width + 10, rect.height + 10);
    }
    start();
  }

  function start() {
    if (frame) return; // el navegador ya pausa requestAnimationFrame en pestañas ocultas
    if (!last) last = performance.now();
    frame = window.requestAnimationFrame(tick);
  }

  function engage(element) {
    target = element;
    nextArrival = 0;
  }

  function release(element) {
    if (target === element) target = null; // las que ya caen terminan su camino
  }

  const find = (node) => (node && node.closest ? node.closest(TARGETS) : null);
  document.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    const element = find(event.target);
    if (element) engage(element);
  });
  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    const element = find(event.target);
    if (!element) return;
    engage(element);
    demoUntil = performance.now() + 1800;
  });
  document.addEventListener('pointerout', (event) => {
    const element = find(event.target);
    if (element && !element.contains(event.relatedTarget)) release(element);
  });
  document.addEventListener('focusin', (event) => {
    const element = find(event.target);
    if (element && event.target.matches(':focus-visible')) engage(element);
  });
  document.addEventListener('focusout', (event) => {
    const element = find(event.target);
    if (element) release(element);
  });
  document.addEventListener('visibilitychange', () => { last = 0; start(); });
  window.addEventListener('resize', () => {
    // En móvil la barra de direcciones cambia el alto al hacer scroll: no regenerar el cielo por eso.
    if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 140) return;
    resize();
  });

  resize();
  nextMeteor = performance.now() + 1200;
  nextDemo = performance.now() + 3500;
  start();
})();
