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
      acknowledgeBtn.textContent = '✓ Confirmado';
      acknowledgeBtn.style.background = '#2e7d5a';
      acknowledgeBtn.disabled = true;

      if (card) {
        const badge = card.querySelector('.badge-error');
        if (badge) {
          badge.textContent = 'Resolvido';
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
      irrigationBtn.innerHTML = '<span class="material-symbols-outlined filled">check_circle</span> Irrigação Ativada';
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
      insightBtn.textContent = '✓ Recomendação Aplicada';
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
      startIrrigationBtn.textContent = '✓ Irrigação Iniciada';
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
      dispatchTechBtn.textContent = '✓ Técnico Acionado';
      dispatchTechBtn.disabled = true;
      setTimeout(() => { dispatchTechBtn.textContent = orig; dispatchTechBtn.disabled = false; }, 4000);
    });
  }

  /* Export Logs button */
  const exportLogsBtn = document.getElementById('exportLogsBtn');
  if (exportLogsBtn) {
    exportLogsBtn.addEventListener('click', () => {
      const orig = exportLogsBtn.innerHTML;
      exportLogsBtn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Registros Exportados!';
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
        muteAllBtn.innerHTML = '<span class="material-symbols-outlined">notifications_active</span> Desilenciar Todos';
        muteAllBtn.style.background = 'var(--on-surface-variant)';
      } else {
        muteAllBtn.innerHTML = '<span class="material-symbols-outlined">notifications_off</span> Silenciar Todos';
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

  /* ──────────────────────────────────────────────────────────
     DEVICES PAGE  (device.html) specific behaviors
     ────────────────────────────────────────────────────────── */

  /* Device category filter pills */
  const devFilterPills = document.querySelectorAll('.dev-filter-pill');
  const devCards = document.querySelectorAll('.dev-grid .dev-card, .dev-grid .dev-card-add');

  devFilterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      devFilterPills.forEach(p => p.classList.remove('dev-filter-pill--active'));
      pill.classList.add('dev-filter-pill--active');

      const type = pill.dataset.type;
      devCards.forEach(card => {
        card.style.transition = 'opacity 0.25s';
        if (type === 'all' || !card.dataset.type || card.dataset.type === type) {
          card.style.opacity = '1';
          card.style.pointerEvents = '';
        } else {
          card.style.opacity = '0.3';
          card.style.pointerEvents = 'none';
        }
      });
      console.log(`[FarmAI] Device filter: "${type}"`);
    });
  });

  /* Device-specific inline search (separate from topbar search) */
  const deviceSearchInput = document.getElementById('deviceSearchInput');
  if (deviceSearchInput) {
    deviceSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      devCards.forEach(card => {
        card.style.transition = 'opacity 0.25s';
        card.style.opacity = (!query || card.textContent.toLowerCase().includes(query)) ? '1' : '0.25';
      });

      /* Also filter log rows */
      document.querySelectorAll('.dev-log-row').forEach(row => {
        row.style.transition = 'opacity 0.25s';
        row.style.opacity = (!query || row.textContent.toLowerCase().includes(query)) ? '1' : '0.25';
      });
    });
  }

  /* Add Device button */
  const addDeviceBtn = document.getElementById('addDeviceBtn');
  if (addDeviceBtn) {
    addDeviceBtn.addEventListener('click', () => {
      console.log('[FarmAI] Open add device modal');
      // Future: open QR scan / serial entry modal
    });
  }

  /* View full history button */
  const viewFullHistoryBtn = document.getElementById('viewFullHistoryBtn');
  if (viewFullHistoryBtn) {
    viewFullHistoryBtn.addEventListener('click', () => {
      console.log('[FarmAI] Navigate to full connection log');
      // Future: navigate to logs page or expand inline
    });
  }

  /* Card "more" buttons — per-card context menu stub */
  document.querySelectorAll('.dev-card-more').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.dev-card');
      const name = card?.querySelector('.dev-card-name')?.textContent || 'device';
      console.log(`[FarmAI] Open context menu for: "${name}"`);
    });
  });

  /* Also extend unified topbar search to cover device cards */
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase().trim();
      document.querySelectorAll('.dev-grid .dev-card').forEach(card => {
        card.style.transition = 'opacity 0.25s';
        card.style.opacity = (!query || card.textContent.toLowerCase().includes(query)) ? '1' : '0.35';
      });
    });
  }

  /* ══════════════════════════════════════════════════════════
     AI CHAT OVERLAY — logic for ia.html
     ══════════════════════════════════════════════════════════ */

  const chatOverlay    = document.getElementById('aiChatOverlay');
  const chatPanel      = document.getElementById('aiChatPanel');
  const chatBackBtn    = document.getElementById('aiChatBackBtn');
  const chatInput      = document.getElementById('aiChatInput');
  const chatSendBtn    = document.getElementById('aiChatSendBtn');
  const chatMessages   = document.getElementById('aiChatMessages');
  const chatTyping     = document.getElementById('aiChatTyping');
  const triggerInput   = document.getElementById('aiChatTriggerInput');
  const triggerBtn     = document.getElementById('aiChatTriggerBtn');

  /* Only run chat logic if overlay elements exist on the page */
  if (!chatOverlay || !triggerInput) return;

  /* ── Conversation history for the API ───────────────────── */
  const conversationHistory = [];

  /* System prompt: farm-specific assistant context */
  const SYSTEM_PROMPT = `Você é o Assistente IA da FarmAI, uma plataforma inteligente de monitoramento agrícola. 
Você é especializado em:
- Irrigação e gestão hídrica
- Análise de solo (pH, nutrientes, umidade)
- Previsão climática e seu impacto nas lavouras
- Detecção e controle de pragas e doenças
- Fertilização e manejo de nutrientes
- Otimização de produção e sustentabilidade

Responda sempre em português do Brasil. Seja preciso, prático e objetivo. Use dados e porcentagens quando relevante. Formate listas com marcadores simples quando listar várias opções. Não use markdown pesado. Mantenha respostas concisas (máximo 3-4 parágrafos) mas completas. Se não souber algo específico sobre a fazenda do usuário, peça os dados necessários.`;

  /* ── Open / Close helpers ────────────────────────────────── */
  function openChat(prefillText = '') {
    chatOverlay.classList.add('ai-chat-overlay--active');
    chatOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // prevent bg scroll

    // Move any text already typed in the trigger into the chat input
    if (prefillText.trim()) {
      chatInput.value = prefillText.trim();
    }

    // Focus the chat input after the animation settles
    setTimeout(() => chatInput.focus(), 420);
  }

  function closeChat() {
    chatOverlay.classList.remove('ai-chat-overlay--active');
    chatOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    // Clear trigger input
    triggerInput.value = '';
  }

  /* ── Trigger: click on the input bar or its trigger button ─ */
  triggerInput.addEventListener('focus', () => {
    openChat(triggerInput.value);
  });

  triggerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && triggerInput.value.trim()) {
      openChat(triggerInput.value);
    }
  });

  if (triggerBtn) {
    triggerBtn.addEventListener('click', () => {
      openChat(triggerInput.value);
    });
  }

  /* ── Close: back button ──────────────────────────────────── */
  chatBackBtn.addEventListener('click', closeChat);

  /* ── Close: click on the dark backdrop (outside panel) ───── */
  chatOverlay.addEventListener('click', (e) => {
    if (e.target === chatOverlay) closeChat();
  });

  /* ── Close: Escape key ───────────────────────────────────── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chatOverlay.classList.contains('ai-chat-overlay--active')) {
      closeChat();
    }
  });

  /* ── Append a message bubble ─────────────────────────────── */
  function appendMessage(text, role) {
    const msgEl = document.createElement('div');
    msgEl.classList.add('ai-msg', role === 'user' ? 'ai-msg--user' : 'ai-msg--bot');

    const avatarEl = document.createElement('div');
    avatarEl.classList.add('ai-msg-avatar');
    avatarEl.innerHTML = role === 'user'
      ? '<span class="material-symbols-outlined filled">person</span>'
      : '<span class="material-symbols-outlined filled">eco</span>';

    if (role === 'user') {
      avatarEl.style.background = 'var(--secondary-container)';
      avatarEl.querySelector('.material-symbols-outlined').style.color = 'var(--on-secondary-container)';
    }

    const bubbleEl = document.createElement('div');
    bubbleEl.classList.add('ai-msg-bubble');
    // Preserve line breaks in API response
    bubbleEl.innerHTML = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    if (role === 'user') {
      msgEl.appendChild(bubbleEl);
      msgEl.appendChild(avatarEl);
    } else {
      msgEl.appendChild(avatarEl);
      msgEl.appendChild(bubbleEl);
    }

    chatMessages.appendChild(msgEl);
    scrollToBottom();
    return bubbleEl; // return for streaming updates
  }

  /* ── Smooth scroll to bottom of messages ────────────────── */
  function scrollToBottom() {
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
  }

  /* ── Show / hide typing indicator ───────────────────────── */
  function showTyping() {
    if (chatTyping) {
      chatTyping.style.display = 'flex';
      scrollToBottom();
    }
  }
  function hideTyping() {
    if (chatTyping) chatTyping.style.display = 'none';
  }

  /* ── Call Ollama API (local) ─────────────────────────────── */
  async function callClaudeAPI(userMessage) {
    conversationHistory.push({ role: 'user', content: userMessage });

    showTyping();
    chatSendBtn.disabled = true;
    chatInput.disabled = true;

    // Monta o histórico com system prompt como primeira mensagem
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory
    ];

    try {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sike_aditya/AgriLlama',
          messages: messages,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const data = await response.json();
      const assistantText = data.message?.content || 'Sem resposta do modelo.';

      hideTyping();
      appendMessage(assistantText, 'assistant');

      // Salva resposta no histórico
      conversationHistory.push({ role: 'assistant', content: assistantText });

    } catch (err) {
      hideTyping();
      console.error('[FarmAI Chat] Erro Ollama:', err);
      appendMessage(
        'Não foi possível conectar ao Ollama. Verifique se ele está rodando na sua máquina e tente novamente.',
        'assistant'
      );
    } finally {
      chatSendBtn.disabled = false;
      chatInput.disabled = false;
      chatInput.focus();
    }
  }

  /* ── Send message handler ────────────────────────────────── */
  async function handleSend() {
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';
    appendMessage(text, 'user');
    await callClaudeAPI(text);
  }

  /* ── Send on button click ────────────────────────────────── */
  chatSendBtn.addEventListener('click', handleSend);

  /* ── Send on Enter (Shift+Enter = new line) ──────────────── */
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  /* ── If there's prefill text and user presses Enter on overlay open ─ */
  chatInput.addEventListener('keydown', (e) => {
    // Already handled above; this redundancy is intentional for clarity.
  });

});