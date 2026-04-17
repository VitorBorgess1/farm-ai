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

  /* ── Search bar filter (unified, all pages) ─────────────── */
  const searchInput = document.querySelector('.search-bar input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();

      const applyFilter = (selector) => {
        document.querySelectorAll(selector).forEach(el => {
          el.style.transition = 'opacity 0.25s';
          el.style.opacity = (!query || el.textContent.toLowerCase().includes(query)) ? '1' : '0.35';
        });
      };

      // AI Insights page — bento cards
      applyFilter('.bento-grid .card');

      // Dashboard page — stat/map/trend cards
      applyFilter('.stat-card-box, .trends-card, .field-map-card');

      // Monitoring page — table rows and metric cards
      applyFilter('.mon-table tbody tr');
      applyFilter('.mon-chart-card, .mon-metric-card');

      // Alerts page — alert cards, resolved items, sector items
      applyFilter('.alr-card');
      applyFilter('.alr-resolved-item');
      applyFilter('.alr-sector-item');
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

  /* ──────────────────────────────────────────────────────────
     MONITORING PAGE  (monitoring.html) specific behaviors
     ────────────────────────────────────────────────────────── */

  /* Time range filter buttons */
  const filterBtns = document.querySelectorAll('.filter-btn[data-filter]');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('filter-btn--active'));
      btn.classList.add('filter-btn--active');
      console.log(`[FarmAI] Time filter: "${btn.dataset.filter}"`);
      // Future: reload chart data for selected range
    });
  });

  /* Compare sensors button */
  const compareSensorsBtn = document.getElementById('compareSensorsBtn');
  if (compareSensorsBtn) {
    compareSensorsBtn.addEventListener('click', () => {
      const compareCard = document.querySelector('.mon-compare-card');
      if (compareCard) {
        compareCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        compareCard.style.outline = '2px solid var(--primary)';
        setTimeout(() => { compareCard.style.outline = ''; }, 1500);
      }
    });
  }

  /* Execute Irrigation Plan button */
  const executeIrrigationPlan = document.getElementById('executeIrrigationPlan');
  if (executeIrrigationPlan) {
    executeIrrigationPlan.addEventListener('click', () => {
      executeIrrigationPlan.textContent = '✓ Plano Iniciado às 18:00';
      executeIrrigationPlan.style.background = 'var(--secondary-fixed)';
      executeIrrigationPlan.style.color = 'var(--on-secondary-fixed)';
      executeIrrigationPlan.disabled = true;
    });
  }

  /* Add Sensor (comparison selector) */
  const addSensorBtn = document.querySelector('.mon-compare-add');
  if (addSensorBtn) {
    addSensorBtn.addEventListener('click', () => {
      console.log('[FarmAI] Open sensor picker modal');
      // Future: open a sensor selection modal
    });
  }

  /* Export CSV */
  const exportBtn = document.querySelector('.mon-export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const original = exportBtn.innerHTML;
      exportBtn.textContent = '✓ CSV Exportado';
      exportBtn.disabled = true;
      setTimeout(() => {
        exportBtn.innerHTML = original;
        exportBtn.disabled = false;
      }, 2500);
    });
  }

  /* FAB chart button (monitoring) */
  const fabChart = document.getElementById('fabChart');
  if (fabChart) {
    fabChart.addEventListener('click', () => {
      fabChart.style.transform = 'scale(0.88)';
      setTimeout(() => { fabChart.style.transform = ''; }, 200);
      console.log('[FarmAI] Add new chart');
    });
  }

  /* ──────────────────────────────────────────────────────────
     ALERTS PAGE  (alerts.html) specific behaviors
     ────────────────────────────────────────────────────────── */

  /* Start Irrigation button (critical alert) */
  const startIrrigationBtn = document.getElementById('startIrrigationBtn');
  if (startIrrigationBtn) {
    startIrrigationBtn.addEventListener('click', () => {
      startIrrigationBtn.textContent = '✓ Irrigation Started';
      startIrrigationBtn.style.background = '#2e7d5a';
      startIrrigationBtn.disabled = true;
      const card = document.getElementById('alertCritical');
      if (card) { card.style.opacity = '0.6'; card.style.transition = 'opacity 0.5s'; }
    });
  }

  /* Dispatch Technician button */
  const dispatchTechBtn = document.getElementById('dispatchTechBtn');
  if (dispatchTechBtn) {
    dispatchTechBtn.addEventListener('click', () => {
      const orig = dispatchTechBtn.textContent;
      dispatchTechBtn.textContent = '✓ Technician Dispatched';
      dispatchTechBtn.disabled = true;
      setTimeout(() => { dispatchTechBtn.textContent = orig; dispatchTechBtn.disabled = false; }, 4000);
    });
  }

  /* Export Logs button */
  const exportLogsBtn = document.getElementById('exportLogsBtn');
  if (exportLogsBtn) {
    exportLogsBtn.addEventListener('click', () => {
      const orig = exportLogsBtn.innerHTML;
      exportLogsBtn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Logs Exported';
      exportLogsBtn.disabled = true;
      setTimeout(() => { exportLogsBtn.innerHTML = orig; exportLogsBtn.disabled = false; }, 3000);
    });
  }

  /* Mute All toggle */
  const muteAllBtn = document.getElementById('muteAllBtn');
  if (muteAllBtn) {
    let muted = false;
    muteAllBtn.addEventListener('click', () => {
      muted = !muted;
      if (muted) {
        muteAllBtn.innerHTML = '<span class="material-symbols-outlined">notifications_active</span> Unmute All';
        muteAllBtn.style.background = 'var(--on-surface-variant)';
      } else {
        muteAllBtn.innerHTML = '<span class="material-symbols-outlined">notifications_off</span> Mute All';
        muteAllBtn.style.background = '';
      }
      console.log(`[FarmAI] Alerts ${muted ? 'muted' : 'unmuted'}`);
    });
  }

  /* Mobile bottom nav active state sync */
  const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
  bottomNavItems.forEach(item => {
    const href = item.getAttribute('href') || '';
    if (href === currentFile) {
      bottomNavItems.forEach(i => i.classList.remove('bottom-nav-item--active'));
      item.classList.add('bottom-nav-item--active');
    }
    item.addEventListener('click', () => {
      bottomNavItems.forEach(i => i.classList.remove('bottom-nav-item--active'));
      item.classList.add('bottom-nav-item--active');
    });
  });

});