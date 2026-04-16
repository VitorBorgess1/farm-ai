/* ============================================================
   FarmAI — script.js
   Interactive behaviors & UI logic
   Shared across all pages + page-specific handlers
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Detect current page ─────────────────────────────────── */
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';

  /* ── Nav link active state ───────────────────────────────── */
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    const href = link.getAttribute('href') || '';

    // Set active based on current URL
    if (href === currentFile) {
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    }

    link.addEventListener('click', (e) => {
      if (href === currentFile || href === '#' || href === '') {
        e.preventDefault();
      }
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  /* ── FAB click feedback ──────────────────────────────────── */
  const fab = document.getElementById('fab');
  if (fab) {
    fab.addEventListener('click', () => {
      fab.style.transform = 'scale(0.88) rotate(20deg)';
      setTimeout(() => { fab.style.transform = ''; }, 220);
    });
  }

  /* ── Notification bell pulse ─────────────────────────────── */
  const notifBtn = document.querySelector('.topbar-right .icon-btn');
  if (notifBtn) {
    notifBtn.addEventListener('click', () => {
      notifBtn.style.transform = 'scale(1.2)';
      setTimeout(() => { notifBtn.style.transform = ''; }, 180);
    });
  }

  /* ── Search bar filter ───────────────────────────────────── */
  const searchInput = document.querySelector('.search-bar input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();

      // Filter bento-grid cards (AI Insights page)
      const cards = document.querySelectorAll('.bento-grid .card');
      cards.forEach(card => {
        card.style.transition = 'opacity 0.25s';
        if (!query) {
          card.style.opacity = '1';
          return;
        }
        const text = card.textContent.toLowerCase();
        card.style.opacity = text.includes(query) ? '1' : '0.35';
      });

      // Filter stat cards (Dashboard page)
      const statCards = document.querySelectorAll('.stat-card-box, .trends-card, .field-map-card');
      statCards.forEach(card => {
        card.style.transition = 'opacity 0.25s';
        if (!query) {
          card.style.opacity = '1';
          return;
        }
        const text = card.textContent.toLowerCase();
        card.style.opacity = text.includes(query) ? '1' : '0.35';
      });
    });
  }

  /* ──────────────────────────────────────────────────────────
     AI INSIGHTS PAGE  (ia.html) specific behaviors
     ────────────────────────────────────────────────────────── */

  /* "Acknowledge" button */
  const acknowledgeBtn = document.querySelector('.card-large .btn-primary');
  if (acknowledgeBtn) {
    acknowledgeBtn.addEventListener('click', () => {
      const card = acknowledgeBtn.closest('.card');
      acknowledgeBtn.textContent = '✓ Acknowledged';
      acknowledgeBtn.style.background = '#2e7d5a';
      acknowledgeBtn.disabled = true;

      if (card) {
        const badge = card.querySelector('.badge-error');
        if (badge) {
          badge.textContent = 'Resolved';
          badge.classList.remove('badge-error');
          badge.classList.add('badge-secondary');
        }
      }
    });
  }

  /* Recommendation arrow buttons */
  const recArrows = document.querySelectorAll('.icon-btn-round');
  recArrows.forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.rec-item');
      if (!item) return;
      const title = item.querySelector('.rec-title')?.textContent;
      console.log(`[FarmAI] Navigating to detail for: "${title}"`);
    });
  });

  /* ──────────────────────────────────────────────────────────
     DASHBOARD PAGE  (index.html) specific behaviors
     ────────────────────────────────────────────────────────── */

  /* Map toggle buttons */
  const mapToggles = document.querySelectorAll('.map-toggle-btn');
  mapToggles.forEach(btn => {
    btn.addEventListener('click', () => {
      mapToggles.forEach(b => b.classList.remove('map-toggle-btn--active'));
      btn.classList.add('map-toggle-btn--active');
      console.log(`[FarmAI] Map layer: "${btn.textContent.trim()}"`);
    });
  });

  /* Manual Irrigation button */
  const irrigationBtn = document.getElementById('manualIrrigationBtn');
  if (irrigationBtn) {
    irrigationBtn.addEventListener('click', () => {
      const original = irrigationBtn.innerHTML;
      irrigationBtn.innerHTML = '<span class="material-symbols-outlined filled">check_circle</span> Irrigation Active';
      irrigationBtn.style.background = '#2e7d5a';
      irrigationBtn.disabled = true;
      setTimeout(() => {
        irrigationBtn.innerHTML = original;
        irrigationBtn.style.background = '';
        irrigationBtn.disabled = false;
      }, 4000);
    });
  }

  /* AI Insight "Apply" button */
  const insightBtn = document.querySelector('.btn-insight');
  if (insightBtn) {
    insightBtn.addEventListener('click', () => {
      insightBtn.textContent = '✓ Recommendation Applied';
      insightBtn.style.background = '#bacf86';
      insightBtn.disabled = true;
    });
  }

  /* Trends select */
  const trendsSelect = document.querySelector('.trends-select');
  if (trendsSelect) {
    trendsSelect.addEventListener('change', (e) => {
      console.log(`[FarmAI] Trends period: "${e.target.value}"`);
      // Future: fetch data and redraw chart
    });
  }

});