(function () {
  const root = document.documentElement;
  const STORAGE_KEY = "arronex-theme";
  const REDUCED_MOTION = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const COARSE_POINTER = window.matchMedia(
    "(hover: none), (pointer: coarse)",
  ).matches;

  function getRippleOrigin(event) {
    if (
      event &&
      typeof event.clientX === "number" &&
      typeof event.clientY === "number" &&
      (event.clientX || event.clientY)
    ) {
      return { x: event.clientX, y: event.clientY };
    }
    const toggle = document.getElementById("themeToggle");
    if (!toggle) {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }
    const rect = toggle.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function runThemeRipple(event) {
    if (REDUCED_MOTION) return 0;
    const { x, y } = getRippleOrigin(event);
    const ripple = document.createElement("div");
    ripple.className = "theme-ripple";
    ripple.style.setProperty("--rx", `${x}px`);
    ripple.style.setProperty("--ry", `${y}px`);
    document.body.appendChild(ripple);

    requestAnimationFrame(() => {
      ripple.classList.add("is-active");
    });

    window.setTimeout(() => {
      ripple.remove();
    }, 780);

    return 120;
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    const toggle = document.getElementById("themeToggle");
    if (!toggle) return;
    toggle.classList.remove("is-dragging", "is-armed");
    toggle.style.removeProperty("--thumb-x");
    toggle.style.removeProperty("--drag-progress");
    const label = toggle.querySelector(".theme-text");
    const icon = toggle.querySelector(".theme-icon");
    toggle.classList.toggle("is-light", theme === "light");
    toggle.classList.toggle("is-dark", theme !== "light");
    if (label) {
      label.textContent = theme === "light" ? "Light mode" : "Dark mode";
    }
    if (icon) {
      icon.textContent = theme === "light" ? "\u263c" : "\u263e";
    }
    toggle.setAttribute(
      "aria-label",
      theme === "light" ? "Switch to dark mode" : "Switch to light mode",
    );
    toggle.setAttribute(
      "title",
      theme === "light" ? "Switch to dark mode" : "Switch to light mode",
    );
  }

  function initTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const preferred = window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
    applyTheme(saved || preferred);

    const toggle = document.getElementById("themeToggle");
    if (toggle) {
      let pointerId = null;
      let pointerStartX = 0;
      let pointerStartY = 0;
      let startThumbX = 0;
      let moved = false;
      let ignoreClickUntil = 0;
      const DRAG_DISTANCE_THRESHOLD = 8;
      const DRAG_AXIS_LOCK_RATIO = 1.35;

      const setTheme = (next, event) => {
        if (root.getAttribute("data-theme") === next) return;
        runThemeRipple(event);
        applyTheme(next);
        localStorage.setItem(STORAGE_KEY, next);
      };

      const getMaxThumbX = () => {
        const width = toggle.clientWidth || 92;
        return Math.max(0, width - 42);
      };

      const setDragThumb = (x) => {
        const max = getMaxThumbX();
        const clamped = Math.min(max, Math.max(0, x));
        toggle.style.setProperty("--thumb-x", `${clamped}px`);
        toggle.style.setProperty(
          "--drag-progress",
          max > 0 ? `${clamped / max}` : "0",
        );
        return clamped;
      };

      const clearDragState = () => {
        toggle.classList.remove("is-dragging", "is-armed");
        toggle.style.removeProperty("--thumb-x");
        toggle.style.removeProperty("--drag-progress");
      };

      const onPointerDown = (event) => {
        if (!event.isPrimary || event.button !== 0) return;
        pointerId = event.pointerId;
        pointerStartX = event.clientX;
        pointerStartY = event.clientY;
        moved = false;
        startThumbX =
          root.getAttribute("data-theme") === "dark" ? getMaxThumbX() : 0;
        toggle.classList.add("is-armed");
        if (toggle.setPointerCapture) {
          toggle.setPointerCapture(event.pointerId);
        }
      };

      const onPointerMove = (event) => {
        if (pointerId !== event.pointerId) return;
        const dx = event.clientX - pointerStartX;
        const dy = event.clientY - pointerStartY;
        if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        if (!moved && Math.abs(dy) > Math.abs(dx) * DRAG_AXIS_LOCK_RATIO) return;
        if (!moved) {
          moved = true;
          toggle.classList.add("is-dragging");
          toggle.style.setProperty("--thumb-x", `${startThumbX}px`);
        }
        setDragThumb(startThumbX + dx);
      };

      const onPointerEnd = (event) => {
        if (pointerId !== event.pointerId) return;
        const maxThumbX = getMaxThumbX();
        const dx = event.clientX - pointerStartX;
        const draggedFarEnough = Math.abs(dx) >= DRAG_DISTANCE_THRESHOLD;
        const finalThumbX = moved
          ? setDragThumb(startThumbX + dx)
          : startThumbX;
        const nextTheme = finalThumbX >= maxThumbX / 2 ? "dark" : "light";

        if (moved && draggedFarEnough) {
          ignoreClickUntil = Date.now() + 280;
          setTheme(nextTheme, event);
        } else {
          if (moved) {
            ignoreClickUntil = Date.now() + 280;
          }
          clearDragState();
        }

        if (
          toggle.releasePointerCapture &&
          toggle.hasPointerCapture &&
          toggle.hasPointerCapture(event.pointerId)
        ) {
          toggle.releasePointerCapture(event.pointerId);
        }
        pointerId = null;
        pointerStartX = 0;
        pointerStartY = 0;
        toggle.classList.remove("is-armed");
      };

      toggle.addEventListener("pointerdown", onPointerDown, { passive: true });
      toggle.addEventListener("pointermove", onPointerMove, { passive: true });
      toggle.addEventListener("pointerup", onPointerEnd);
      toggle.addEventListener("pointercancel", onPointerEnd);

      toggle.addEventListener("click", (event) => {
        const currentTheme = root.getAttribute("data-theme");
        if (currentTheme && Date.now() < ignoreClickUntil) {
          event.preventDefault();
          return;
        }
        const next = currentTheme === "light" ? "dark" : "light";
        ignoreClickUntil = 0;
        setTheme(next, event);
      });

      toggle.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const next = event.key === "ArrowRight" ? "dark" : "light";
        setTheme(next, event);
      });

      toggle.addEventListener("pointerleave", () => {
        if (pointerId === null) {
          toggle.classList.remove("is-armed");
        }
      });
    }
  }

  function initScrollProgress() {
    const progress = document.getElementById("scrollProgress");
    if (!progress) return;

    const updateProgress = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const pct = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
      progress.style.setProperty("--progress", `${pct}%`);
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
  }

  function initReveal() {
    const items = document.querySelectorAll(".reveal");
    items.forEach((el, i) => {
      if (!el.style.getPropertyValue("--reveal-delay")) {
        const delay = (i % 7) * 60;
        el.style.setProperty("--reveal-delay", `${delay}ms`);
      }
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: COARSE_POINTER ? 0.1 : 0.16,
        rootMargin: COARSE_POINTER ? "0px 0px -8% 0px" : "0px 0px -4% 0px",
      },
    );

    items.forEach((el) => observer.observe(el));
  }

  function initTilt() {
    if (REDUCED_MOTION || COARSE_POINTER) return;
    const interactive = document.querySelectorAll(
      ".service-card, .tile, .faq-item, .stat-card, .metric-card",
    );
    interactive.forEach((card) => {
      card.classList.add("fx-3d");
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

        card.style.setProperty("--tilt-x", `${state.currentX.toFixed(2)}deg`);
        card.style.setProperty("--tilt-y", `${state.currentY.toFixed(2)}deg`);
        card.style.setProperty("--lift", `${state.currentLift.toFixed(2)}px`);

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

      card.addEventListener("mousemove", (event) => {
        const rect = card.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        state.targetX = (y / rect.height - 0.5) * -12;
        state.targetY = (x / rect.width - 0.5) * 14;
        state.targetLift = -6;
        kick();
      });

      card.addEventListener("mouseleave", () => {
        state.targetX = 0;
        state.targetY = 0;
        state.targetLift = 0;
        kick();
      });
    });
  }

  function initParallaxGlow() {
    if (COARSE_POINTER) return;
    const hero = document.querySelector(".hero");
    if (!hero) return;

    window.addEventListener(
      "scroll",
      () => {
        const depth = Math.min(window.scrollY * 0.08, 36);
        hero.style.backgroundPosition = `center ${depth}px`;
      },
      { passive: true },
    );
  }

  function initScrollDepth() {
    if (REDUCED_MOTION || COARSE_POINTER) return;

    const depthItems = document.querySelectorAll(
      ".hero, .hero-panel, .section-card.panel, .content-grid > .section-card",
    );
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
        el.style.setProperty("--scroll-rx", `${rotateX}deg`);
        el.style.setProperty("--scroll-ry", `${rotateY}deg`);
        el.style.setProperty("--scroll-y", `${translateY}px`);
        el.style.setProperty("--scroll-scale", `${scale}`);
      });
    };

    const onScroll = () => {
      if (!rafPending) {
        rafPending = true;
        window.requestAnimationFrame(updateDepth);
      }
    };

    updateDepth();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  }

  function initPageTransition3D() {
    // Replaced by route-bubble navigation effect.
  }

  function initPointerParallax() {
    if (REDUCED_MOTION || COARSE_POINTER) return;
    const hero = document.querySelector(".hero");
    if (!hero) return;

    const move = (event) => {
      const x = (event.clientX / window.innerWidth) * 100;
      const y = (event.clientY / window.innerHeight) * 100;
      root.style.setProperty("--mx", `${x}%`);
      root.style.setProperty("--my", `${y}%`);
      hero.style.setProperty("--hero-tilt-y", `${((x - 50) / 50) * 3}deg`);
      hero.style.setProperty("--hero-tilt-x", `${((50 - y) / 50) * 3}deg`);
    };

    window.addEventListener("pointermove", move, { passive: true });
  }

  function initNavBubble() {
    const nav = document.querySelector(".nav-links");
    const bubble = document.getElementById("navBubble");
    const links = nav ? Array.from(nav.querySelectorAll("a")) : [];
    if (!nav || !bubble || links.length === 0) return;

    const bubbleEnabled = () => window.innerWidth > 760 && !COARSE_POINTER;

    const moveTo = (link, immediate = false) => {
      const navRect = nav.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      const left = linkRect.left - navRect.left;
      const top = linkRect.top - navRect.top;
      bubble.style.setProperty("--nav-x", `${left}px`);
      bubble.style.setProperty("--nav-y", `${top}px`);
      bubble.style.setProperty("--nav-w", `${linkRect.width}px`);
      bubble.style.setProperty("--nav-h", `${linkRect.height}px`);
      if (immediate) {
        bubble.classList.add("is-immediate");
        requestAnimationFrame(() => bubble.classList.remove("is-immediate"));
      }
    };

    const activeLink = nav.querySelector("a.active") || links[0];
    if (bubbleEnabled()) {
      moveTo(activeLink, true);
    }

    links.forEach((link) => {
      link.addEventListener("mouseenter", () => {
        if (bubbleEnabled()) moveTo(link);
      });
      link.addEventListener("focus", () => {
        if (bubbleEnabled()) moveTo(link);
      });
      link.addEventListener("mouseleave", () => {
        if (bubbleEnabled()) moveTo(activeLink);
      });
      link.addEventListener("blur", () => {
        if (bubbleEnabled()) moveTo(activeLink);
      });

      link.addEventListener("click", (event) => {
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          link.target === "_blank"
        )
          return;
        const href = link.getAttribute("href");
        if (
          !href ||
          href.startsWith("#") ||
          href.startsWith("mailto:") ||
          href.startsWith("tel:")
        )
          return;

        const targetUrl = new URL(link.href, window.location.href);
        if (targetUrl.origin !== window.location.origin) return;
        if (
          targetUrl.pathname === window.location.pathname &&
          targetUrl.search === window.location.search
        )
          return;

        event.preventDefault();
        if (bubbleEnabled()) moveTo(link);
        nav.classList.add("nav-switching");
        document.body.classList.add("menu-switching");
        setTimeout(() => {
          window.location.href = targetUrl.href;
        }, 240);
      });
    });

    window.addEventListener("resize", () => {
      const currentActive = nav.querySelector("a.active") || activeLink;
      if (bubbleEnabled()) {
        moveTo(currentActive, true);
      }
    });
  }

  function initCounterAnimation() {
    const counters = document.querySelectorAll(".counter[data-target]");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !entry.target.dataset.animated) {
            const target = parseInt(entry.target.dataset.target, 10);
            const duration = 2000;
            const startTime = Date.now();

            const animate = () => {
              const elapsed = Date.now() - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const current = Math.floor(target * progress);
              entry.target.textContent = current + (target > 100 ? "%" : "+");

              if (progress < 1) {
                requestAnimationFrame(animate);
              } else {
                entry.target.textContent = target + (target > 100 ? "%" : "+");
                entry.target.dataset.animated = "true";
              }
            };

            animate();
          }
        });
      },
      { threshold: 0.1 },
    );

    counters.forEach((counter) => observer.observe(counter));
  }

  function initPricingTabs() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const tabName = button.getAttribute("data-tab");

        tabButtons.forEach((btn) => btn.classList.remove("active"));
        tabContents.forEach((content) => content.classList.remove("active"));

        button.classList.add("active");
        const activeContent = document.getElementById(`tab-${tabName}`);
        if (activeContent) {
          activeContent.classList.add("active");
        }
      });
    });
  }

  function initFlashcards() {
    const flashcards = document.querySelectorAll(".flashcard");

    flashcards.forEach((card) => {
      card.addEventListener("click", () => {
        card.classList.toggle("flipped");
      });

      card.addEventListener("touchend", (e) => {
        if (e.cancelable) {
          e.preventDefault();
        }
        card.classList.toggle("flipped");
      });
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initScrollProgress();
    initReveal();
    initTilt();
    initParallaxGlow();
    initScrollDepth();
    initPageTransition3D();
    initPointerParallax();
    initNavBubble();
    initCounterAnimation();
    initPricingTabs();
    initFlashcards();
  });
})();
