(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

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

  /* ---------- live numbers from GitHub and PyPI; the baked-in values stay if a request fails ---------- */
  const ghEls = $$('[data-gh]');
  if (ghEls.length && 'fetch' in window) {
    fetch('https://api.github.com/users/vikassharma545/repos?per_page=100', { headers: { Accept: 'application/vnd.github+json' } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('GitHub API ' + r.status))))
      .then((repos) => {
        const byName = {};
        let total = 0;
        repos.forEach((r) => { byName[r.name] = r; if (!r.fork) total += r.stargazers_count || 0; });
        ghEls.forEach((el) => {
          const [kind, name] = el.dataset.gh.split(':');
          let value;
          if (kind === 'stars-total') value = total;
          else if (kind === 'stars' && byName[name]) value = byName[name].stargazers_count;
          else if (kind === 'forks' && byName[name]) value = byName[name].forks_count;
          if (typeof value === 'number') el.textContent = String(value);
        });
      })
      .catch(() => { /* rate limited or offline: keep the numbers baked into the page */ });
  }
  const pypiEls = $$('[data-pypi]');
  if (pypiEls.length && 'fetch' in window) {
    fetch('https://pypi.org/pypi/pyzdata/json')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('PyPI ' + r.status))))
      .then((d) => { if (d.info && d.info.version) pypiEls.forEach(el => { el.textContent = d.info.version; }); })
      .catch(() => { /* keep the baked-in version */ });
  }

  /* ---------- text effects: letters rise on load and as titles scroll in, nav links scramble on hover,
     buttons lean toward the cursor, the page skews with scroll speed, the hero drifts with the mouse ---------- */
  const root = document.documentElement;
  root.classList.add('fx');
  const split = (el) => { // words of letter spans; the heading keeps its text for assistive tech
    if (!el || el.querySelector('.ch')) return;
    el.setAttribute('aria-label', (el.innerText || el.textContent).trim().replace(/\s+/g, ' '));
    let i = 0;
    const frag = document.createDocumentFragment();
    Array.from(el.childNodes).forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) { frag.appendChild(node.cloneNode(true)); return; }
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const word = document.createElement('span');
        word.className = 'word';
        word.setAttribute('aria-hidden', 'true');
        for (const ch of part) {
          const span = document.createElement('span');
          span.className = 'ch';
          span.style.setProperty('--i', String(i++));
          span.textContent = ch;
          word.appendChild(span);
        }
        frag.appendChild(word);
      });
    });
    el.replaceChildren(frag);
  };
  if (!reduceMotion) {
    split($('#hero-name'));
    $$('.hero-copy > :not(h1)').forEach((el, n) => { el.classList.add('rise'); el.style.setProperty('--d', (n ? 520 + n * 110 : 0) + 'ms'); });
    const frame = $('.portrait .frame');
    if (frame) { frame.classList.add('rise'); frame.style.setProperty('--d', '300ms'); }
    const titles = $$('.section-head, .flag-title, .group-title');
    titles.forEach((el) => {
      split(el.matches('.section-head') ? el.querySelector('h2') : el);
      const deck = el.querySelector('.deck');
      if (deck) { deck.classList.add('rise'); deck.style.setProperty('--d', '220ms'); }
    });
    if ('IntersectionObserver' in window) {
      const seen = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); }
      }), { threshold: 0.2 });
      titles.forEach((el) => seen.observe(el));
    } else {
      titles.forEach((el) => el.classList.add('in'));
    }
  }
  const begin = () => root.classList.add('fx-in');
  if (reduceMotion) begin();
  else {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(begin));
    setTimeout(begin, 1500); // never wait on a slow font
  }

  /* the hero drifts with the mouse and zooms out as you scroll away; one painter writes both */
  const heroCopy = $('.hero-copy'), heroName = $('#hero-name'), heroPic = $('.portrait');
  const hero = { cx: 0, cy: 0, tx: 0, ty: 0, p: 0, raf: 0 };
  const paintHero = () => {
    const p = hero.p; // 0 at the top of the page, 1 once the first screen has scrolled away
    if (heroCopy) {
      heroCopy.style.transform = `translate(${(hero.cx * -8).toFixed(1)}px, ${(hero.cy * -5 - p * 40).toFixed(1)}px) scale(${(1 - p * 0.06).toFixed(3)})`;
      heroCopy.style.opacity = (1 - p * 0.55).toFixed(3);
    }
    if (heroName) heroName.style.transform = `scale(${(1 + p * 0.28).toFixed(3)})`; // the name flies toward you as the rest recedes
    if (heroPic) heroPic.style.transform = `translate(${(hero.cx * 14).toFixed(1)}px, ${(hero.cy * 9 + p * 36).toFixed(1)}px) scale(${(1 + p * 0.06).toFixed(3)})`;
  };

  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&/';
  if (finePointer && !reduceMotion) {
    $$('.nav-links a').forEach((a) => {
      const text = a.textContent;
      let timer = 0;
      if (a.offsetWidth) a.style.minWidth = a.offsetWidth + 'px'; // keep the width while the letters change
      a.addEventListener('pointerenter', () => {
        const t0 = performance.now();
        clearInterval(timer);
        timer = setInterval(() => {
          const step = Math.floor((performance.now() - t0) / 40); // one letter settles every 40 ms, whatever the frame rate
          if (step > text.length) { clearInterval(timer); a.textContent = text; return; }
          a.textContent = text.split('').map((c, i) => (i < step ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join('');
        }, 40);
      });
    });

    $$('.btn, .social a, .footer-links a, .install, .resume-list a').forEach((el) => {
      el.classList.add('magnet');
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${(dx * 0.3).toFixed(1)}px, ${(dy * 0.3).toFixed(1)}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });

    const tick = () => {
      hero.cx += (hero.tx - hero.cx) * 0.06; hero.cy += (hero.ty - hero.cy) * 0.06;
      paintHero();
      hero.raf = (Math.abs(hero.tx - hero.cx) + Math.abs(hero.ty - hero.cy) > 0.002) ? requestAnimationFrame(tick) : 0;
    };
    window.addEventListener('pointermove', (e) => {
      hero.tx = (e.clientX / window.innerWidth) * 2 - 1; hero.ty = (e.clientY / window.innerHeight) * 2 - 1;
      if (!hero.raf) hero.raf = requestAnimationFrame(tick);
    }, { passive: true });
  }

  /* ---------- zoom and dance: headings swell as they pass mid-screen, numbers pop in, the hero zooms out as you
     scroll away, letters and words near the cursor lift and grow, and the name ripples now and then ---------- */
  if (!reduceMotion) {
    const words = (el) => { // word spans, so single words can move
      if (!el || el.querySelector('.wd')) return;
      const frag = document.createDocumentFragment();
      Array.from(el.childNodes).forEach((node) => {
        if (node.nodeType !== Node.TEXT_NODE) { frag.appendChild(node.cloneNode(true)); return; }
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const span = document.createElement('span');
          span.className = 'wd';
          span.textContent = part;
          frag.appendChild(span);
        });
      });
      el.replaceChildren(frag);
    };
    $$('.hero-statement, .deck').forEach(words);

    const heads = $$('.section-head h2, .flag-title, .group-title');
    heads.forEach((el) => el.classList.add('zoomable'));
    $$('.board dd, .metrics dd').forEach((el, n) => { el.classList.add('zoom'); el.style.setProperty('--d', (n % 4) * 90 + 'ms'); });
    if ('IntersectionObserver' in window) {
      const pop = new IntersectionObserver((entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('in'); pop.unobserve(e.target); }
      }), { threshold: 0.3 });
      $$('.board, .metrics').forEach((el) => pop.observe(el));
    } else {
      $$('.board, .metrics').forEach((el) => el.classList.add('in'));
    }

    let zoomRaf = 0;
    const zoomScroll = () => {
      zoomRaf = 0;
      const vh = window.innerHeight;
      hero.p = Math.max(0, Math.min(1, window.scrollY / (vh * 0.9)));
      paintHero();
      heads.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -80 || r.top > vh + 80) return;
        const t = 1 - Math.min(1, Math.abs(r.top + r.height / 2 - vh * 0.5) / (vh * 0.55));
        el.style.transform = `scale(${(0.86 + 0.24 * t * t).toFixed(3)})`;
      });
    };
    const queueZoom = () => { if (!zoomRaf) zoomRaf = requestAnimationFrame(zoomScroll); };
    window.addEventListener('scroll', queueZoom, { passive: true });
    window.addEventListener('resize', queueZoom);
    zoomScroll();

    if (finePointer) {
      const targets = $$('#hero-name, .section-head h2, .flag-title, .group-title, .hero-statement, .deck');
      let active = null, units = [], raf = 0, px = -1e4, py = -1e4;
      const arm = (el) => {
        el.classList.add('dance');
        $$('.ch, .wd', el).forEach((u) => {
          const r = u.getBoundingClientRect();
          units.push({ el: u, owner: el, x: r.left + r.width / 2 + window.scrollX, y: r.top + r.height / 2 + window.scrollY, f: 0, side: 1, letter: u.classList.contains('ch') });
        });
      };
      const frame = () => {
        const sx = window.scrollX, sy = window.scrollY;
        units = units.filter((u) => {
          let f = 0;
          if (u.owner === active) {
            const dx = px - (u.x - sx), dy = py - (u.y - sy), d = Math.hypot(dx, dy), reach = u.letter ? 170 : 120;
            if (d < reach) { f = (1 - d / reach) ** 2; u.side = dx < 0 ? -1 : 1; }
          }
          u.f += (f - u.f) * 0.22;
          if (u.owner !== active && u.f < 0.004) { u.el.style.transform = ''; return false; }
          u.el.style.transform = u.letter
            ? `translateY(${(-22 * u.f).toFixed(1)}px) scale(${(1 + 0.6 * u.f).toFixed(3)}) rotate(${(u.side * 8 * u.f).toFixed(1)}deg)`
            : `translateY(${(-6 * u.f).toFixed(1)}px) scale(${(1 + 0.16 * u.f).toFixed(3)})`;
          return true;
        });
        targets.forEach((t) => { if (t !== active && !units.some((u) => u.owner === t)) t.classList.remove('dance'); });
        raf = units.length ? requestAnimationFrame(frame) : 0;
      };
      window.addEventListener('pointermove', (e) => {
        px = e.clientX; py = e.clientY;
        let hit = null;
        for (const t of targets) {
          const r = t.getBoundingClientRect();
          if (px > r.left - 90 && px < r.right + 90 && py > r.top - 90 && py < r.bottom + 90) { hit = t; break; }
        }
        if (hit !== active) {
          active = hit;
          if (hit && !hit.classList.contains('ripple') && hit.closest('.in, #hero') && root.classList.contains('fx-in') && !units.some((u) => u.owner === hit)) arm(hit);
        }
        if (units.length && !raf) raf = requestAnimationFrame(frame);
      }, { passive: true });
    }

    const name = $('#hero-name');
    if (name) {
      setInterval(() => {
        const r = name.getBoundingClientRect();
        if (document.hidden || r.bottom < 0 || r.top > window.innerHeight || name.classList.contains('dance') || !root.classList.contains('fx-in')) return;
        name.classList.add('ripple');
        setTimeout(() => name.classList.remove('ripple'), 1600);
      }, 8000);
    }
  }

  const main = $('#main');
  if (main && !reduceMotion) {
    let lastY = window.scrollY, lastT = performance.now(), skew = 0, target = 0, raf = 0;
    const settle = () => {
      skew += (target - skew) * 0.12;
      target *= 0.85;
      if (Math.abs(skew) < 0.02 && Math.abs(target) < 0.02) { main.style.transform = ''; raf = 0; return; }
      main.style.transform = `skewY(${skew.toFixed(3)}deg)`;
      raf = requestAnimationFrame(settle);
    };
    window.addEventListener('scroll', () => {
      const now = performance.now(), y = window.scrollY;
      const v = (y - lastY) / Math.max(16, now - lastT) * 16; // px per frame
      lastY = y; lastT = now;
      target = Math.max(-2.5, Math.min(2.5, v * 0.04));
      if (!raf) raf = requestAnimationFrame(settle);
    }, { passive: true });
  }

  /* ---------- cursor ring: follows a fine pointer and grows over links ---------- */
  const ring = $('#cursor');
  if (ring && !reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.documentElement.classList.add('has-cursor');
    let tx = -100, ty = -100, x = tx, y = ty, raf = 0;
    const follow = () => {
      x += (tx - x) * 0.35;
      y += (ty - y) * 0.35;
      ring.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      raf = (Math.abs(tx - x) + Math.abs(ty - y) > 0.2) ? requestAnimationFrame(follow) : 0;
    };
    window.addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      ring.style.opacity = '1';
      if (!raf) raf = requestAnimationFrame(follow);
    }, { passive: true });
    document.addEventListener('pointerover', (e) => ring.classList.toggle('on-link', !!e.target.closest('a, button')));
    document.addEventListener('pointerleave', () => { ring.style.opacity = '0'; });
    document.addEventListener('pointerdown', () => ring.classList.add('down'));
    document.addEventListener('pointerup', () => ring.classList.remove('down'));
  }

  /* ---------- hero tape: a synthetic candlestick chart that draws itself once (also used by tools/og.html) ---------- */
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
