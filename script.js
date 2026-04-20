document.addEventListener('DOMContentLoaded', () => {

  /* ---------- live IST clock in header ---------- */
  const clock = document.getElementById('live-clock');
  const fmt = n => String(n).padStart(2, '0');
  const tick = () => {
    if (!clock) return;
    // Build IST time from any client — always show UTC+05:30
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utcMs + 330 * 60000);
    clock.textContent = `${fmt(ist.getHours())}:${fmt(ist.getMinutes())}:${fmt(ist.getSeconds())} IST`;
  };
  tick();
  setInterval(tick, 1000);

  /* ---------- sticky header shadow on scroll ---------- */
  const header = document.getElementById('header');
  const onScroll = () => {
    if (!header) return;
    if (window.scrollY > 40) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- smooth scroll + close mobile on nav click ---------- */
  const navLinks = document.querySelector('.nav-links');
  const hamburger = document.getElementById('hamburger-btn');
  const closeMenu = () => {
    if (!navLinks) return;
    navLinks.classList.remove('active');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
  };
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (href.length < 2) return;
      const tgt = document.querySelector(href);
      if (!tgt) return;
      e.preventDefault();
      tgt.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (navLinks && navLinks.classList.contains('active')) closeMenu();
    });
  });

  /* ---------- mobile menu ---------- */
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const open = navLinks.classList.toggle('active');
      hamburger.setAttribute('aria-expanded', String(open));
    });
  }

  /* ---------- reveal on scroll (with graceful fallbacks) ---------- */
  const revealables = document.querySelectorAll('.reveal');

  // Fallback 1: if IntersectionObserver unavailable, show everything now.
  // Fallback 2: anything already in the initial viewport gets revealed without waiting.
  const showNow = (el) => el.classList.add('in');

  if ('IntersectionObserver' in window) {
    // Reveal anything already on-screen immediately (avoids flash on refresh)
    revealables.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.95 && r.bottom > 0) showNow(el);
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          setTimeout(() => showNow(e.target), Math.min(i, 6) * 60);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealables.forEach(el => { if (!el.classList.contains('in')) io.observe(el); });

    // Last-resort fallback: after 3s, make sure everything is visible.
    setTimeout(() => revealables.forEach(showNow), 3000);
  } else {
    revealables.forEach(showNow);
  }

  /* ---------- animated stat counters ---------- */
  const stats = document.querySelectorAll('.stat-num[data-target]');
  const animateCounter = (el) => {
    const target = parseInt(el.dataset.target, 10);
    const suffix = el.dataset.suffix || '';
    const hasCurrency = el.querySelector('.currency');
    const duration = 1400;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.floor(target * eased);
      if (hasCurrency) {
        el.innerHTML = `<span class="currency">₹</span>${val}${suffix}`;
      } else {
        el.textContent = `${val}${suffix}`;
      }
      if (p < 1) requestAnimationFrame(step);
      else {
        // final exact
        if (hasCurrency) el.innerHTML = `<span class="currency">₹</span>${target}${suffix}`;
        else el.textContent = `${target}${suffix}`;
      }
    };
    requestAnimationFrame(step);
  };

  if ('IntersectionObserver' in window) {
    const so = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          animateCounter(e.target);
          so.unobserve(e.target);
        }
      });
    }, { threshold: 0.4 });
    stats.forEach(s => so.observe(s));
  } else {
    stats.forEach(animateCounter);
  }

  /* ---------- copy pip install command ---------- */
  const installBox = document.getElementById('install-box');
  const copyLabel = document.getElementById('install-copy-label');
  if (installBox && navigator.clipboard) {
    const doCopy = async () => {
      try {
        await navigator.clipboard.writeText('pip install pyzdata');
        installBox.classList.add('copied');
        if (copyLabel) copyLabel.innerHTML = '<i class="fas fa-check"></i> copied';
        setTimeout(() => {
          installBox.classList.remove('copied');
          if (copyLabel) copyLabel.innerHTML = '<i class="far fa-copy"></i> copy';
        }, 1800);
      } catch (err) { /* silently ignore */ }
    };
    installBox.addEventListener('click', doCopy);
    installBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doCopy(); }
    });
  }

});
