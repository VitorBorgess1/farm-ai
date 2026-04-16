/* ============================================================
   FarmAI — app.js
   Interactive behaviors & UI logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── FAB click feedback ──────────────────────────────────── */
  const fab = document.getElementById('fab');
  if (fab) {
    fab.addEventListener('click', () => {
      fab.style.transform = 'scale(0.88) rotate(20deg)';
      setTimeout(() => { fab.style.transform = ''; }, 200);
    });
  }

  /* ── "Acknowledge" button ────────────────────────────────── */
  const acknowledgeBtn = document.querySelector('.btn-primary');
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

  /* ── Search bar filter (UI feedback) ────────────────────── */
  const searchInput = document.querySelector('.search-bar input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const cards = document.querySelectorAll('.bento-grid .card');

      cards.forEach(card => {
        if (!query) {
          card.style.opacity = '1';
          card.style.transition = 'opacity 0.25s';
          return;
        }
        const text = card.textContent.toLowerCase();
        card.style.transition = 'opacity 0.25s';
        card.style.opacity = text.includes(query) ? '1' : '0.35';
      });
    });
  }

  /* ── Recommendation arrow buttons ───────────────────────── */
  const recArrows = document.querySelectorAll('.icon-btn-round');
  recArrows.forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.rec-item');
      if (!item) return;
      const title = item.querySelector('.rec-title')?.textContent;
      console.log(`[FarmAI] Navigating to detail for: "${title}"`);
      // Future: route to detail view
    });
  });

  /* ── Nav link active state ───────────────────────────────── */
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href') || '';
            const currentFile = window.location.pathname.split('/').pop() || 'index.html';
            
            if (href === currentFile || href === '#' || href === '') {
                e.preventDefault();
            }
            
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

  /* ── Notification bell ripple ────────────────────────────── */
  const notifBtn = document.querySelector('.topbar-right .icon-btn');
  if (notifBtn) {
    notifBtn.addEventListener('click', () => {
      notifBtn.style.transform = 'scale(1.2)';
      setTimeout(() => { notifBtn.style.transform = ''; }, 180);
    });
  }

});