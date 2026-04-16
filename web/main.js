/* ============================================
   言墨 · JavaScript
   - Navbar scroll effect
   - Scroll reveal animations
   - Section-by-section wheel scroll
   ============================================ */

/* ---- Section Wheel Scroll ---- */
(function () {
  function getTargets() {
    return Array.from(document.querySelectorAll('section'));
  }

  var scrolling = false;
  var cooldown = 900;
  var snapThreshold = 30; // px – if already within this distance of section top, don't snap

  // Which section index the viewport top is currently inside
  function getCurrentIndex(targets) {
    var scrollTop = window.scrollY;
    for (var i = targets.length - 1; i >= 0; i--) {
      var rect = targets[i].getBoundingClientRect();
      var elTop = scrollTop + rect.top;
      if (scrollTop >= elTop - 10) return i;
    }
    return 0;
  }

  function scrollToIndex(targets, index) {
    if (index < 0 || index >= targets.length) return;
    scrolling = true;
    targets[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(function () { scrolling = false; }, cooldown);
  }

  // Accumulate wheel delta to filter out tiny touchpad ticks
  var wheelAccum = 0;
  var wheelResetTimer = null;
  var wheelDeltaThreshold = 50; // cumulative px before triggering a page switch
  var lastWheelTime = 0;

  window.addEventListener('wheel', function (e) {
    // Allow scroll inside overflowing inner elements (code blocks, etc.)
    var node = e.target;
    while (node && node !== document.body) {
      var st = window.getComputedStyle(node);
      var ov = st.overflowY;
      if ((ov === 'auto' || ov === 'scroll') && node.scrollHeight > node.clientHeight) return;
      node = node.parentElement;
    }

    var now = Date.now();
    if (scrolling || now - lastWheelTime < cooldown) return;

    // Accumulate delta; reset after a pause
    wheelAccum += e.deltaY;
    clearTimeout(wheelResetTimer);
    wheelResetTimer = setTimeout(function () { wheelAccum = 0; }, 300);

    // Only trigger when accumulated delta exceeds threshold
    if (Math.abs(wheelAccum) < wheelDeltaThreshold) return;

    var targets = getTargets();
    var idx = getCurrentIndex(targets);
    var el = targets[idx];
    var rect = el.getBoundingClientRect();
    var vh = window.innerHeight;
    var isTall = el.offsetHeight > vh + 5;

    if (wheelAccum > 0) {
      if (isTall && rect.bottom > vh + 5) { wheelAccum = 0; return; }
      wheelAccum = 0;
      lastWheelTime = now;
      scrollToIndex(targets, idx + 1);
    } else if (wheelAccum < 0) {
      if (isTall && rect.top < -5) { wheelAccum = 0; return; }
      wheelAccum = 0;
      lastWheelTime = now;
      scrollToIndex(targets, idx - 1);
    }
  }, { passive: true });

  // Scrollbar / keyboard scroll: snap after settling.
  var snapTimer = null;
  var lastObservedScrollY = window.scrollY;
  var lastScrollDirection = 0;
  window.addEventListener('scroll', function () {
    if (scrolling) return;

    var currentY = window.scrollY;
    if (Math.abs(currentY - lastObservedScrollY) > 1) {
      lastScrollDirection = currentY > lastObservedScrollY ? 1 : -1;
    }
    lastObservedScrollY = currentY;

    clearTimeout(snapTimer);
    snapTimer = setTimeout(function () {
      if (scrolling) return;

      var targets = getTargets();
      var idx = getCurrentIndex(targets);
      var el = targets[idx];
      var rect = el.getBoundingClientRect();
      var vh = window.innerHeight;
      var isTall = el.offsetHeight > vh + 5;

      // Tall section middle area: do not force snap.
      if (isTall && rect.top < -5 && rect.bottom > vh + 5) return;

      // Already close enough to section top – skip to avoid jitter
      if (Math.abs(rect.top) < snapThreshold) return;

      // Reaching boundary of tall section should move to adjacent page
      if (isTall && lastScrollDirection > 0 && rect.bottom <= vh + 5 && idx < targets.length - 1) {
        scrollToIndex(targets, idx + 1);
        return;
      }
      if (isTall && lastScrollDirection < 0 && rect.top >= -5 && idx > 0) {
        scrollToIndex(targets, idx - 1);
        return;
      }

      scrollToIndex(targets, idx);
    }, 350);
  }, { passive: true });
})();

/* ---- Navbar Scroll ---- */
(function () {
  const nav = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
})();

/* ---- Scroll Reveal ---- */
(function () {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();
/* ---- Recording Preview Start On First View ---- */
(function () {
  const section = document.querySelector('#recording');
  const video = section?.querySelector('.rec-vibe-preview video');

  if (!section || !video) return;

  let hasStarted = false;

  function ensureSource() {
    if (video.currentSrc || video.src) return;
    const source = video.dataset.src;
    if (!source) return;
    video.src = source;
    video.load();
  }

  function startPreview() {
    if (hasStarted) return;
    ensureSource();
    hasStarted = true;
    section.classList.add('recording-started');
    video.currentTime = 0;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        hasStarted = false;
      });
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        startPreview();
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.45 }
  );

  observer.observe(section);
})();

/* ---- Auto-update Download Links from GitHub Releases ---- */
/* Scans recent releases (newest to oldest) and picks the most recent .exe and .dmg independently. */
(function () {
  function findUrlsInAssets(assets, winUrl, macUrl) {
    if (!Array.isArray(assets)) return { winUrl: winUrl, macUrl: macUrl };

    for (var i = 0; i < assets.length; i++) {
      if (winUrl && macUrl) break;
      var url = assets[i] && assets[i].browser_download_url;
      if (!url) continue;
      var lower = String(url).toLowerCase();
      if (!winUrl && lower.endsWith('.exe')) winUrl = url;
      if (!macUrl && lower.endsWith('.dmg')) macUrl = url;
    }

    return { winUrl: winUrl, macUrl: macUrl };
  }

  function applyUrls(winUrl, macUrl) {
    if (winUrl) {
      var winBtn = document.getElementById('btn-download-windows');
      if (winBtn) winBtn.href = winUrl;
    }
    if (macUrl) {
      var macBtn = document.getElementById('btn-download-mac');
      if (macBtn) macBtn.href = macUrl;
    }
  }

  fetch('https://api.github.com/repos/yanmo-ai/yanmo/releases')
    .then(function (res) { return res.json(); })
    .then(function (releases) {
      if (!Array.isArray(releases) || releases.length === 0) return;

      // GitHub returns newest first; keep it simple and just scan forward.
      var winUrl = null;
      var macUrl = null;

      for (var i = 0; i < releases.length; i++) {
        if (winUrl && macUrl) break;
        var r = releases[i];
        if (!r || r.draft || r.prerelease) continue;
        var u = findUrlsInAssets(r.assets, winUrl, macUrl);
        winUrl = u.winUrl;
        macUrl = u.macUrl;
      }

      applyUrls(winUrl, macUrl);
    })
    .catch(function () { /* keep fallback links */ });
})();

/* ---- FAQ Smooth Open ---- */
(function () {
  document.querySelectorAll('.faq-item').forEach(item => {
    item.addEventListener('toggle', () => {
      if (item.open) {
        // close others
        document.querySelectorAll('.faq-item[open]').forEach(other => {
          if (other !== item) other.removeAttribute('open');
        });
      }
    });
  });
})();

