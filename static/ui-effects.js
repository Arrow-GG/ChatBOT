(function () {
  const root = document.documentElement;
  const STORAGE_KEY = 'arronex-theme';
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COARSE_POINTER = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  function getRippleOrigin(event) {
    if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number' && (event.clientX || event.clientY)) {
      return { x: event.clientX, y: event.clientY };
    }
    const toggle = document.getElementById('themeToggle');
    if (!toggle) {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }
    const rect = toggle.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function runThemeRipple(event) {
    if (REDUCED_MOTION) return 0;
    const { x, y } = getRippleOrigin(event);
    const ripple = document.createElement('div');
    ripple.className = 'theme-ripple';
    ripple.style.setProperty('--rx', `${x}px`);
    ripple.style.setProperty('--ry', `${y}px`);
    document.body.appendChild(ripple);

    requestAnimationFrame(() => {
      ripple.classList.add('is-active');
    });

    window.setTimeout(() => {
      ripple.remove();
    }, 780);

    return 120;
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;
    const label = toggle.querySelector('.theme-text');
    const icon = toggle.querySelector('.theme-icon');
    toggle.classList.toggle('is-light', theme === 'light');
    toggle.classList.toggle('is-dark', theme !== 'light');
    if (label) {
      label.textContent = theme === 'light' ? 'Light mode' : 'Dark mode';
    }
    if (icon) {
      icon.textContent = theme === 'light' ? '☀' : '☽';
    }
    toggle.setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
    toggle.setAttribute('title', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    applyTheme(saved || preferred);

    const toggle = document.getElementById('themeToggle');
    if (toggle) {
      toggle.addEventListener('click', (event) => {
        const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        const delay = runThemeRipple(event);
        window.setTimeout(() => {
          applyTheme(next);
          localStorage.setItem(STORAGE_KEY, next);
        }, delay);
      });
    }
  }

  function initScrollProgress() {
    const progress = document.getElementById('scrollProgress');
    if (!progress) return;

    const updateProgress = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const pct = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
      progress.style.setProperty('--progress', `${pct}%`);
    };

    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
  }

  function initReveal() {
    const items = document.querySelectorAll('.section-card, .service-card, .faq-item, .metric-card');
    items.forEach((el, i) => {
      el.classList.add('reveal');
      const delay = (i % 7) * 60;
      el.style.setProperty('--reveal-delay', `${delay}ms`);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: COARSE_POINTER ? 0.1 : 0.16,
        rootMargin: COARSE_POINTER ? '0px 0px -8% 0px' : '0px 0px -4% 0px',
      }
    );

    items.forEach((el) => observer.observe(el));
  }

  function initTilt() {
    if (REDUCED_MOTION || COARSE_POINTER) return;
    const interactive = document.querySelectorAll('.service-card, .tile, .faq-item, .stat-card, .metric-card');
    interactive.forEach((card) => {
      card.classList.add('fx-3d');
      const state = {
        currentX: 0,
        currentY: 0,
        targetX: 0,
        targetY: 0,
        currentLift: 0,
        targetLift: 0,
        raf: null,
      };

      const animate = () => {
        state.currentX += (state.targetX - state.currentX) * 0.14;
        state.currentY += (state.targetY - state.currentY) * 0.14;
        state.currentLift += (state.targetLift - state.currentLift) * 0.16;

        card.style.setProperty('--tilt-x', `${state.currentX.toFixed(2)}deg`);
        card.style.setProperty('--tilt-y', `${state.currentY.toFixed(2)}deg`);
        card.style.setProperty('--lift', `${state.currentLift.toFixed(2)}px`);

        const stillMoving =
          Math.abs(state.targetX - state.currentX) > 0.05 ||
          Math.abs(state.targetY - state.currentY) > 0.05 ||
          Math.abs(state.targetLift - state.currentLift) > 0.05;

        if (stillMoving) {
          state.raf = window.requestAnimationFrame(animate);
        } else {
          state.raf = null;
        }
      };

      const kick = () => {
        if (!state.raf) {
          state.raf = window.requestAnimationFrame(animate);
        }
      };

      card.addEventListener('mousemove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        state.targetX = ((y / rect.height) - 0.5) * -12;
        state.targetY = ((x / rect.width) - 0.5) * 14;
        state.targetLift = -6;
        kick();
      });

      card.addEventListener('mouseleave', () => {
        state.targetX = 0;
        state.targetY = 0;
        state.targetLift = 0;
        kick();
      });
    });
  }

  function initParallaxGlow() {
    if (COARSE_POINTER) return;
    const hero = document.querySelector('.hero');
    if (!hero) return;

    window.addEventListener(
      'scroll',
      () => {
        const depth = Math.min(window.scrollY * 0.08, 36);
        hero.style.backgroundPosition = `center ${depth}px`;
      },
      { passive: true }
    );
  }

  function initScrollDepth() {
    if (REDUCED_MOTION || COARSE_POINTER) return;

    const depthItems = document.querySelectorAll('.hero, .hero-panel, .section-card.panel, .content-grid > .section-card');
    if (!depthItems.length) return;

    let rafPending = false;

    const updateDepth = () => {
      rafPending = false;
      const viewportCenterY = window.innerHeight / 2;
      const viewportCenterX = window.innerWidth / 2;
      depthItems.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > window.innerHeight + 100) {
          return;
        }
        const centerY = rect.top + rect.height / 2;
        const centerX = rect.left + rect.width / 2;
        const distanceY = (centerY - viewportCenterY) / viewportCenterY;
        const distanceX = (centerX - viewportCenterX) / viewportCenterX;
        const clampedY = Math.max(-1, Math.min(1, distanceY));
        const clampedX = Math.max(-1, Math.min(1, distanceX));
        const rotateX = clampedY * -6;
        const rotateY = clampedX * 4;
        const translateY = clampedY * -14;
        const scale = 1 - Math.abs(clampedY) * 0.025;
        el.style.setProperty('--scroll-rx', `${rotateX}deg`);
        el.style.setProperty('--scroll-ry', `${rotateY}deg`);
        el.style.setProperty('--scroll-y', `${translateY}px`);
        el.style.setProperty('--scroll-scale', `${scale}`);
      });
    };

    const onScroll = () => {
      if (!rafPending) {
        rafPending = true;
        window.requestAnimationFrame(updateDepth);
      }
    };

    updateDepth();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

  function initPageTransition3D() {
    // Replaced by route-bubble navigation effect.
  }

  function initPointerParallax() {
    if (REDUCED_MOTION || COARSE_POINTER) return;
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const move = (event) => {
      const x = (event.clientX / window.innerWidth) * 100;
      const y = (event.clientY / window.innerHeight) * 100;
      root.style.setProperty('--mx', `${x}%`);
      root.style.setProperty('--my', `${y}%`);
      hero.style.setProperty('--hero-tilt-y', `${((x - 50) / 50) * 3}deg`);
      hero.style.setProperty('--hero-tilt-x', `${((50 - y) / 50) * 3}deg`);
    };

    window.addEventListener('pointermove', move, { passive: true });
  }

  function initNavBubble() {
    const nav = document.querySelector('.nav-links');
    const bubble = document.getElementById('navBubble');
    const links = nav ? Array.from(nav.querySelectorAll('a')) : [];
    if (!nav || !bubble || links.length === 0) return;

    const bubbleEnabled = () => window.innerWidth > 760 && !COARSE_POINTER;

    const moveTo = (link, immediate = false) => {
      const navRect = nav.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      const left = linkRect.left - navRect.left;
      const top = linkRect.top - navRect.top;
      bubble.style.setProperty('--nav-x', `${left}px`);
      bubble.style.setProperty('--nav-y', `${top}px`);
      bubble.style.setProperty('--nav-w', `${linkRect.width}px`);
      bubble.style.setProperty('--nav-h', `${linkRect.height}px`);
      if (immediate) {
        bubble.classList.add('is-immediate');
        requestAnimationFrame(() => bubble.classList.remove('is-immediate'));
      }
    };

    const activeLink = nav.querySelector('a.active') || links[0];
    if (bubbleEnabled()) {
      moveTo(activeLink, true);
    }

    links.forEach((link) => {
      link.addEventListener('mouseenter', () => {
        if (bubbleEnabled()) moveTo(link);
      });
      link.addEventListener('focus', () => {
        if (bubbleEnabled()) moveTo(link);
      });
      link.addEventListener('mouseleave', () => {
        if (bubbleEnabled()) moveTo(activeLink);
      });
      link.addEventListener('blur', () => {
        if (bubbleEnabled()) moveTo(activeLink);
      });

      link.addEventListener('click', (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank') return;
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

        const targetUrl = new URL(link.href, window.location.href);
        if (targetUrl.origin !== window.location.origin) return;
        if (targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search) return;

        event.preventDefault();
        if (bubbleEnabled()) moveTo(link);
        nav.classList.add('nav-switching');
        document.body.classList.add('menu-switching');
        setTimeout(() => {
          window.location.href = targetUrl.href;
        }, 240);
      });
    });

    window.addEventListener('resize', () => {
      const currentActive = nav.querySelector('a.active') || activeLink;
      if (bubbleEnabled()) {
        moveTo(currentActive, true);
      }
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initScrollProgress();
    initReveal();
    initTilt();
    initParallaxGlow();
    initScrollDepth();
    initPageTransition3D();
    initPointerParallax();
    initNavBubble();
  });
})();
