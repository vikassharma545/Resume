(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- header hairline once the page scrolls ---------- */
  const header = $('#header');
  const onScroll = () => { if (header) header.classList.toggle('scrolled', window.scrollY > 24); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- phone menu ---------- */
  const menuBtn = $('#menu-btn');
  const navLinks = $('#nav-links');
  const setMenu = (open) => {
    if (!menuBtn || !navLinks) return;
    navLinks.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    const use = menuBtn.querySelector('use');
    if (use) use.setAttribute('href', open ? '#i-close' : '#i-menu');
  };
  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', () => setMenu(!navLinks.classList.contains('open')));
    navLinks.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  }

  /* ---------- mark the section in view in the nav ---------- */
  const links = $$('.nav-links a[href^="#"]');
  const sections = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => {
          if (a.getAttribute('href') === '#' + entry.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(s => io.observe(s));
  }

  /* ---------- copy the install command ---------- */
  const install = $('#install');
  const copyLabel = $('#install-copy');
  if (install) {
    install.addEventListener('click', async () => {
      if (!navigator.clipboard) return;
      try {
        await navigator.clipboard.writeText('pip install pyzdata');
        install.classList.add('copied');
        if (copyLabel) copyLabel.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>Copied';
        setTimeout(() => {
          install.classList.remove('copied');
          if (copyLabel) copyLabel.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-copy"/></svg>Copy';
        }, 1800);
      } catch (err) {
        /* clipboard blocked: the command stays on screen to select by hand */
      }
    });
  }

  /* ---------- hero tape: a synthetic candlestick chart that draws itself once ---------- */
  const tape = () => {
    const canvas = $('#tape');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const css = getComputedStyle(document.documentElement);
    const tone = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    const C = {
      up: tone('--up', '#0FA88A'),
      down: tone('--down', '#E03A3A'),
      amber: tone('--amber', '#FFB020'),
      ink: tone('--ink', '#0C1220'),
      grid: 'rgba(196, 210, 235, 0.09)',
    };

    // Deterministic pseudo-random walk, so every visitor sees the same chart.
    const mulberry32 = (a) => () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };

    let W = 0, H = 0, N = 0;
    let candles = [], ma = [], lo = 0, hi = 1;

    const build = (count) => {
      N = count;
      const rand = mulberry32(20220107);
      candles = [];
      let price = 100;
      for (let i = 0; i < N; i++) {
        const o = price;
        const c = o + (rand() - 0.5) * 2.4 + 0.16 + Math.sin(i / 9) * 0.35;
        const h = Math.max(o, c) + rand() * 1.1;
        const l = Math.min(o, c) - rand() * 1.1;
        candles.push({ o, c, h, l });
        price = c;
      }
      ma = candles.map((_, i) => {
        const from = Math.max(0, i - 9);
        const slice = candles.slice(from, i + 1);
        return slice.reduce((sum, k) => sum + k.c, 0) / slice.length;
      });
      lo = Math.min(...candles.map(k => k.l));
      hi = Math.max(...candles.map(k => k.h));
    };

    const size = () => {
      const rect = canvas.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // roughly one candle per 11px so the marks stay legible at any width
      const count = Math.max(40, Math.min(96, Math.round(W / 11)));
      if (count !== N) build(count);
    };

    const draw = (progress) => {
      ctx.clearRect(0, 0, W, H);
      const top = H * 0.10, bottom = H * 0.90;
      const y = v => bottom - (v - lo) / (hi - lo) * (bottom - top);
      const slot = W / N;
      const bodyW = Math.max(3, Math.round(slot * 0.62));

      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      for (let g = 0; g <= 4; g++) {
        const gy = Math.round(top + (bottom - top) * g / 4) + 0.5;
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }

      const n = Math.floor(progress * N);
      for (let i = 0; i < n; i++) {
        const k = candles[i];
        const x = Math.round(slot * i + slot / 2) + 0.5;
        const up = k.c >= k.o;
        const colour = up ? C.up : C.down;
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y(k.h)); ctx.lineTo(x, y(k.l)); ctx.stroke();
        const by = Math.min(y(k.o), y(k.c));
        const bh = Math.max(2, Math.abs(y(k.o) - y(k.c)));
        const bx = x - bodyW / 2;
        if (up) {
          // hollow body for an up candle, filled for a down candle: readable without colour
          ctx.fillStyle = C.ink;
          ctx.fillRect(bx, by, bodyW, bh);
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bx + 0.5, by + 0.5, bodyW - 1, Math.max(1, bh - 1));
        } else {
          ctx.fillStyle = colour;
          ctx.fillRect(bx, by, bodyW, bh);
        }
      }

      if (n > 1) {
        ctx.strokeStyle = C.amber;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = slot * i + slot / 2;
          if (i === 0) ctx.moveTo(x, y(ma[i])); else ctx.lineTo(x, y(ma[i]));
        }
        ctx.stroke();
        const ex = slot * (n - 1) + slot / 2, ey = y(ma[n - 1]);
        ctx.fillStyle = C.ink;
        ctx.beginPath(); ctx.arc(ex, ey, 6.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = C.amber;
        ctx.beginPath(); ctx.arc(ex, ey, 4.5, 0, Math.PI * 2); ctx.fill();
      }

      // fade the chart under the text column (wide layouts) and at the top and bottom edges
      const fadeIn = W > 700 ? 0.3 : 0.08;
      ctx.globalCompositeOperation = 'destination-in';
      let g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(fadeIn, 'rgba(0,0,0,1)');
      g.addColorStop(0.9, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.18, 'rgba(0,0,0,1)');
      g.addColorStop(0.82, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    };

    size();
    let finished = false;
    if (reduceMotion) {
      draw(1);
      finished = true;
    } else {
      const start = performance.now();
      const duration = 2400;
      const step = (now) => {
        const p = Math.min(1, (now - start) / duration);
        draw(1 - Math.pow(1 - p, 3));
        if (p < 1) requestAnimationFrame(step); else finished = true;
      };
      requestAnimationFrame(step);
    }

    if ('ResizeObserver' in window) {
      let pending = 0;
      new ResizeObserver(() => {
        const rect = canvas.getBoundingClientRect();
        if (Math.round(rect.width) === W && Math.round(rect.height) === H) return;
        cancelAnimationFrame(pending);
        pending = requestAnimationFrame(() => { size(); if (finished) draw(1); });
      }).observe(canvas.parentElement || canvas);
    }
  };
  tape();
})();
