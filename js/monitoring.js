// ============================================================
// FarmAI — Monitoring Page Script
// Tabela: leituras_solo
// Colunas: id, created_at, sensor_id, temp_ar, umid_ar,
//          umid_solo, luz_ambiente
// ============================================================

// ────────────────────────────────────────────────────────────
// 1. CONFIGURAÇÃO SUPABASE  ← Edite aqui
// ────────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://bydyipretbicpvbqmuvb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_2RPgrQBaMC4utot6oGU-gQ_jVeJ3a9k';

const supabaseClientMonitoring = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ────────────────────────────────────────────────────────────
// 2. ESTADO GLOBAL
// ────────────────────────────────────────────────────────────
const state = {
  filter: '24h',
  selectedSensors: [],
  allSensors: [],
  readings: [],
  chart: null,
  chartPh: null,
  realtimeChannel: null,
};

// ────────────────────────────────────────────────────────────
// 3. HELPERS
// ────────────────────────────────────────────────────────────
function getStartDate(filter) {
  const now = new Date();
  if (filter === '24h')     now.setHours(now.getHours() - 24);
  else if (filter === '7d') now.setDate(now.getDate() - 7);
  else {
    const v = document.getElementById('customStart')?.value;
    if (v) return new Date(v);
    now.setDate(now.getDate() - 1);
  }
  return now;
}

const fmt  = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtD = iso => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// ────────────────────────────────────────────────────────────
// 4. BUSCA DE DADOS
// ────────────────────────────────────────────────────────────
async function fetchSensors() {
  const { data, error } = await supabaseClientMonitoring
    .from('leituras_solo')
    .select('sensor_id')
    .not('sensor_id', 'is', null);

  if (error) { console.error('[fetchSensors]', error); return []; }

  const unique = [...new Set(data.map(r => r.sensor_id))].filter(Boolean);
  state.allSensors = unique;
  return unique;
}

async function fetchReadings() {
  const startDate = getStartDate(state.filter).toISOString();

  let query = supabaseClientMonitoring
    .from('leituras_solo')
    .select('id, created_at, sensor_id, temp_ar, umid_ar, umid_solo, luz_ambiente')
    .gte('created_at', startDate)
    .order('created_at', { ascending: true })
    .limit(500);

  if (state.selectedSensors.length > 0) {
    query = query.in('sensor_id', state.selectedSensors);
  }

  const { data, error } = await query;
  if (error) { console.error('[fetchReadings]', error); return []; }

  state.readings = data || [];
  return state.readings;
}

// ────────────────────────────────────────────────────────────
// 5. GRÁFICO PRINCIPAL — Umidade do Solo
// ────────────────────────────────────────────────────────────
function buildMainChart(readings) {
  const canvas = document.getElementById('mainChartCanvas');
  if (!canvas) return;

  if (!readings.length) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#64748b';
    ctx.font = '13px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sem leituras no período selecionado', canvas.width / 2, canvas.height / 2);
    if (state.chart) { state.chart.destroy(); state.chart = null; }
    return;
  }

  // Agrupa por sensor_id (null → 'Sem ID')
  const sensorIds = [...new Set(readings.map(r => r.sensor_id ?? 'Sem ID'))];

  const palette = [
    { line: '#4ade80', fill: 'rgba(74,222,128,0.12)' },
    { line: '#60a5fa', fill: 'rgba(96,165,250,0.08)' },
    { line: '#f97316', fill: 'rgba(249,115,22,0.08)' },
    { line: '#c084fc', fill: 'rgba(192,132,252,0.08)' },
  ];

  const allTimes = readings.map(r => r.created_at);
  const labels   = allTimes.map(fmt);

  const datasets = sensorIds.map((sid, i) => {
    const sr  = readings.filter(r => (r.sensor_id ?? 'Sem ID') === sid);
    const map = Object.fromEntries(sr.map(r => [r.created_at, r.umid_solo]));
    const c   = palette[i % palette.length];
    return {
      label: `Sensor ${sid}`,
      data: allTimes.map(t => map[t] ?? null),
      borderColor: c.line,
      backgroundColor: c.fill,
      fill: i === 0,
      tension: 0.42,
      pointRadius: readings.length < 20 ? 4 : 2,
      pointHoverRadius: 6,
      borderWidth: 2.5,
      spanGaps: true,
    };
  });

  if (state.chart) state.chart.destroy();

  state.chart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: sensorIds.length > 1,
          labels: { color: '#94a3b8', font: { family: 'Manrope', size: 12 }, boxWidth: 12 },
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(74,222,128,0.25)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) : '--'}%`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#64748b', maxTicksLimit: 8, font: { size: 11 } },
          grid:  { color: 'rgba(255,255,255,0.04)' },
        },
        y: {
          min: 0, max: 100,
          ticks: { color: '#64748b', callback: v => v + '%', font: { size: 11 } },
          grid:  { color: 'rgba(255,255,255,0.06)' },
        },
      },
    },
  });

  // KPI — média das últimas 20 leituras
  const recentes = readings.slice(-20).filter(r => r.umid_solo != null);
  if (recentes.length) {
    const avg = recentes.reduce((s, r) => s + r.umid_solo, 0) / recentes.length;
    const el  = document.querySelector('.mon-chart-kpi-value');
    if (el) el.textContent = avg.toFixed(1) + '%';
  }
}

// ────────────────────────────────────────────────────────────
// 6. MINI GRÁFICO — Temperatura do ar ao longo do tempo (barras)
// ────────────────────────────────────────────────────────────
function buildPhMiniChart(readings) {
  const canvas = document.getElementById('tempChartCanvas');
  if (!canvas) return;

  const withTemp = readings.filter(r => r.temp_ar != null).slice(-8);

  if (state.chartPh) state.chartPh.destroy();

  // Atualiza valor numérico no card
  const latestTemp = withTemp.at(-1)?.temp_ar;
  const firstVal = document.querySelector('.mon-metric-value');
  if (firstVal) firstVal.textContent = latestTemp != null ? latestTemp.toFixed(1) : '--';

  if (!withTemp.length) return;

  state.chartPh = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: withTemp.map(r => fmt(r.created_at)),
      datasets: [{
        data: withTemp.map(r => r.temp_ar),
        backgroundColor: withTemp.map(r =>
          r.temp_ar > 35 ? 'rgba(248,113,113,0.75)' :
          r.temp_ar < 10 ? 'rgba(96,165,250,0.75)'  :
                           'rgba(74,222,128,0.70)'
        ),
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          bodyColor: '#94a3b8',
          callbacks: { label: ctx => ` Temp: ${ctx.parsed.y.toFixed(1)}°C` },
        },
      },
      scales: { x: { display: false }, y: { display: false, min: 0, max: 50 } },
    },
  });
}

// ────────────────────────────────────────────────────────────
// 7. CARD Temperatura (dark)
// ────────────────────────────────────────────────────────────
function updatePhCard(readings) {
  const latest = readings.filter(r => r.temp_ar != null).at(-1);
  if (!latest) return;

  const temp    = latest.temp_ar;
  const allVals = document.querySelectorAll('.mon-metric-value');
  if (allVals[1]) allVals[1].textContent = temp.toFixed(1);

  const badgeText = document.querySelector('.mon-metric-badge-healthy span:last-child');
  if (badgeText) {
    badgeText.textContent =
      temp > 35 ? 'Muito Quente' :
      temp < 10 ? 'Muito Frio'   : 'Normal';
  }

  const dot = document.querySelector('.mon-metric-badge-dot');
  if (dot) {
    dot.style.background =
      temp > 35 ? '#f87171' :
      temp < 10 ? '#60a5fa' : '#4ade80';
  }
}

// ────────────────────────────────────────────────────────────
// 8. TABELA — colunas: umid_solo, temp_ar, umid_ar, luz_ambiente
// ────────────────────────────────────────────────────────────
function renderTable(readings) {
  const tbody = document.getElementById('corpoTabelaLeituras');
  if (!tbody) return;

  const rows = [...readings].reverse().slice(0, 50);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748b;padding:24px;">Nenhuma leitura encontrada no período</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const status      = getStatus(r);
    const sensorLabel = r.sensor_id != null
      ? `<span class="sensor-badge">${r.sensor_id}</span>`
      : '<span style="color:#475569">—</span>';

    return `
      <tr>
        <td>${fmtD(r.created_at)}</td>
        <td>${sensorLabel}</td>
        <td>${r.umid_solo != null ? r.umid_solo.toFixed(1) + '%' : '—'}</td>
        <td>${r.temp_ar != null ? r.temp_ar.toFixed(1) + '°C' : '—'}</td>
        <td><span class="status-chip status-chip--${status.cls}">${status.label}</span></td>
      </tr>`;
  }).join('');
}

function getStatus(r) {
  const u    = r.umid_solo;
  const temp = r.temp_ar;
  if (u    != null && u    < 20)           return { cls: 'danger', label: 'Crítico'    };
  if (u    != null && u    < 35)           return { cls: 'warn',   label: 'Alerta'     };
  if (temp != null && (temp > 35 || temp < 10)) return { cls: 'warn', label: 'Temp. Fora' };
  return { cls: 'ok', label: 'Normal' };
}

// ────────────────────────────────────────────────────────────
// 9. SELETOR DE SENSORES
// ────────────────────────────────────────────────────────────
function renderSensorSelector() {
  const list   = document.querySelector('.mon-compare-list');
  if (!list) return;
  const addBtn = list.querySelector('.mon-compare-add');

  list.querySelectorAll('.sensor-toggle').forEach(el => el.remove());

  if (!state.allSensors.length) {
    const msg = document.createElement('p');
    msg.style.cssText = 'color:#64748b;font-size:12px;margin:8px 0;';
    msg.textContent   = 'Nenhum sensor_id cadastrado ainda.';
    addBtn?.before(msg);
    return;
  }

  const items = state.allSensors.map(sid => {
    const active = state.selectedSensors.includes(sid);
    return `
      <div class="mon-compare-item sensor-toggle ${active ? 'active' : ''}" data-sid="${sid}">
        <span>Sensor ${sid}</span>
        <span class="material-symbols-outlined mon-compare-check">
          ${active ? 'check_circle' : 'radio_button_unchecked'}
        </span>
      </div>`;
  }).join('');

  addBtn?.insertAdjacentHTML('beforebegin', items);

  list.querySelectorAll('.sensor-toggle').forEach(el => {
    el.addEventListener('click', () => {
      const sid = Number(el.dataset.sid);
      const idx = state.selectedSensors.indexOf(sid);
      if (idx === -1) state.selectedSensors.push(sid);
      else            state.selectedSensors.splice(idx, 1);
      renderSensorSelector();
      refreshData();
    });
  });
}

// ────────────────────────────────────────────────────────────
// 10. EXPORT CSV
// ────────────────────────────────────────────────────────────
function exportCSV() {
  const headers = ['Horário', 'Sensor ID', 'Umidade Solo (%)', 'Temp. Ar (°C)', 'Umidade Ar (%)', 'Luz Ambiente', 'Status'];
  const rows = state.readings.map(r => {
    const s = getStatus(r);
    return [
      fmtD(r.created_at),
      r.sensor_id ?? '',
      r.umid_solo?.toFixed(1)     ?? '',
      r.temp_ar?.toFixed(1)       ?? '',
      r.umid_ar?.toFixed(1)       ?? '',
      r.luz_ambiente?.toFixed(0)  ?? '',
      s.label,
    ].join(',');
  });

  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `farmai_leituras_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ────────────────────────────────────────────────────────────
// 11. REALTIME
// ────────────────────────────────────────────────────────────
function subscribeRealtime() {
  if (state.realtimeChannel) supabase.removeChannel(state.realtimeChannel);

  state.realtimeChannel = supabaseClientMonitoring
    .channel('leituras-solo-rt')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'leituras_solo' },
      payload => {
        state.readings.push(payload.new);
        if (state.readings.length > 500) state.readings.shift();
        buildMainChart(state.readings);
        buildPhMiniChart(state.readings);
        updatePhCard(state.readings);
        renderTable(state.readings);
        showRealtimePulse();
      }
    )
    .subscribe(status => {
      const badge = document.getElementById('realtimeBadge');
      if (!badge) return;
      if (status === 'SUBSCRIBED') {
        badge.style.color = '#4ade80';
        badge.style.borderColor = 'rgba(74,222,128,0.3)';
      } else {
        badge.style.color = '#f87171';
        badge.style.borderColor = 'rgba(248,113,113,0.3)';
      }
    });
}

function showRealtimePulse() {
  const badge = document.getElementById('realtimeBadge');
  if (!badge) return;
  badge.classList.add('pulse');
  setTimeout(() => badge.classList.remove('pulse'), 2000);
}

// ────────────────────────────────────────────────────────────
// 12. REFRESH
// ────────────────────────────────────────────────────────────
async function refreshData() {
  showLoading(true);
  await fetchReadings();
  buildMainChart(state.readings);
  buildPhMiniChart(state.readings);
  updatePhCard(state.readings);
  renderTable(state.readings);
  showLoading(false);
}

function showLoading(on) {
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.opacity = on ? '1' : '0';
}

// ────────────────────────────────────────────────────────────
// 13. INJEÇÃO DE DOM
// ────────────────────────────────────────────────────────────
function injectCanvases() {
  // Gráfico principal (substitui SVG/conteúdo estático)
  const chartBody = document.querySelector('.mon-chart-body');
  if (chartBody) {
    chartBody.innerHTML = `<canvas id="mainChartCanvas" style="width:100%;height:100%;display:block;"></canvas>`;
  }

  // Mini gráfico pH (substitui barras estáticas do card Temperatura)
  const miniBars = document.querySelector('.mon-mini-bars');
  if (miniBars) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'height:48px;margin-top:8px;';
    wrap.innerHTML = '<canvas id="tempChartCanvas"></canvas>';
    miniBars.replaceWith(wrap);
  }

  // Renomeia o card de métricas para "Temperatura do Ar"
  const labelEls = document.querySelectorAll('.mon-metric-label');
  labelEls.forEach(el => {
    if (el.textContent.trim() === 'Temperatura') {
      el.textContent = 'Temperatura do Ar';
      const unit = el.closest('.mon-metric-card')?.querySelector('.mon-metric-unit');
      if (unit) unit.textContent = '°C';
    }
  });

  // Badge "Ao Vivo"
  const topbarRight = document.querySelector('.topbar-right');
  if (topbarRight && !document.getElementById('realtimeBadge')) {
    const badge = document.createElement('div');
    badge.id = 'realtimeBadge';
    badge.innerHTML = `<span class="material-symbols-outlined" style="font-size:15px;">sensors</span> Ao Vivo`;
    badge.style.cssText = `
      display:flex;align-items:center;gap:4px;font-size:11px;font-weight:600;
      color:#4ade80;background:rgba(74,222,128,0.08);
      border:1px solid rgba(74,222,128,0.2);
      border-radius:20px;padding:4px 10px;transition:all .3s;cursor:default;
    `;
    topbarRight.prepend(badge);
  }

  // Overlay loading
  if (!document.getElementById('loadingOverlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(2,8,23,0.5);z-index:9999;
      display:flex;align-items:center;justify-content:center;
      opacity:0;pointer-events:none;transition:opacity .2s;backdrop-filter:blur(2px);
    `;
    overlay.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
        <div class="farmai-spinner"></div>
        <p style="color:#94a3b8;font-size:13px;font-family:Manrope,sans-serif;">Carregando dados...</p>
      </div>`;
    document.body.appendChild(overlay);
  }
}

// ────────────────────────────────────────────────────────────
// 14. ESTILOS DINÂMICOS
// ────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('farmai-mon-styles')) return;
  const style = document.createElement('style');
  style.id = 'farmai-mon-styles';
  style.textContent = `
    .farmai-spinner {
      width:34px;height:34px;border-radius:50%;
      border:3px solid rgba(74,222,128,0.15);
      border-top-color:#4ade80;
      animation:farmai-spin .7s linear infinite;
    }
    @keyframes farmai-spin { to { transform:rotate(360deg); } }

    #realtimeBadge.pulse {
      background:rgba(74,222,128,0.18) !important;
      border-color:#4ade80 !important;
      box-shadow:0 0 10px rgba(74,222,128,0.25);
    }

    .sensor-toggle { cursor:pointer; transition:background .15s; border-radius:8px; }
    .sensor-toggle:hover { background:rgba(255,255,255,0.05); }
    .sensor-toggle.active .mon-compare-check { color:#4ade80; }

    .sensor-badge {
      font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;
      background:rgba(96,165,250,0.12);color:#60a5fa;font-family:monospace;
    }

    .status-chip {
      font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;
      display:inline-flex;align-items:center;
    }
    .status-chip--ok     { background:rgba(74,222,128,0.12); color:#4ade80; }
    .status-chip--warn   { background:rgba(250,204,21,0.12);  color:#facc15; }
    .status-chip--danger { background:rgba(239,68,68,0.12);   color:#f87171; }

    .mon-table tbody tr { transition:background .15s; }
    .mon-table tbody tr:hover { background:rgba(255,255,255,0.03); }
    @keyframes rowIn { from{opacity:0;transform:translateY(-3px)} to{opacity:1;transform:none} }
    .mon-table tbody tr { animation:rowIn .18s ease both; }
  `;
  document.head.appendChild(style);
}

// ────────────────────────────────────────────────────────────
// 15. DATE PICKER PERSONALIZADO
// ────────────────────────────────────────────────────────────
function injectCustomDatePicker() {
  const filterBar = document.querySelector('.filter-bar');
  if (!filterBar || document.getElementById('customDatePicker')) return;

  const picker = document.createElement('div');
  picker.id = 'customDatePicker';
  picker.style.cssText = 'display:none;align-items:center;gap:8px;flex-wrap:wrap;';
  picker.innerHTML = `
    <label style="font-size:12px;color:#94a3b8;">De</label>
    <input id="customStart" type="datetime-local"
      style="background:#1e293b;border:1px solid rgba(255,255,255,0.1);color:#e2e8f0;border-radius:6px;padding:4px 8px;font-size:12px;">
    <label style="font-size:12px;color:#94a3b8;">Até</label>
    <input id="customEnd" type="datetime-local"
      style="background:#1e293b;border:1px solid rgba(255,255,255,0.1);color:#e2e8f0;border-radius:6px;padding:4px 8px;font-size:12px;">
    <button id="applyCustomFilter"
      style="background:#4ade80;color:#020817;border:none;border-radius:6px;
             padding:4px 12px;font-size:12px;font-weight:700;cursor:pointer;">
      Aplicar
    </button>
  `;
  filterBar.appendChild(picker);
  document.getElementById('applyCustomFilter')?.addEventListener('click', refreshData);
}

function toggleDatePicker(show) {
  const el = document.getElementById('customDatePicker');
  if (el) el.style.display = show ? 'flex' : 'none';
}

// ────────────────────────────────────────────────────────────
// 16. EVENTOS
// ────────────────────────────────────────────────────────────
function bindEvents() {
  document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('filter-btn--active'));
      btn.classList.add('filter-btn--active');
      state.filter = btn.dataset.filter;
      toggleDatePicker(state.filter === 'custom');
      if (state.filter !== 'custom') refreshData();
    });
  });

  document.querySelector('.mon-export-btn')?.addEventListener('click', exportCSV);

  const execBtn = document.getElementById('executeIrrigationPlan');
  if (execBtn) {
    execBtn.addEventListener('click', async () => {
      execBtn.disabled = true;
      execBtn.textContent = 'Executando...';
      await new Promise(r => setTimeout(r, 2000));
      execBtn.textContent = '✓ Plano Iniciado';
      setTimeout(() => { execBtn.disabled = false; execBtn.textContent = 'Executar Plano Automático'; }, 5000);
    });
  }

  document.getElementById('fabChart')?.addEventListener('click', () => {
    alert('Em breve: adicionar métricas customizadas!');
  });
}

// ────────────────────────────────────────────────────────────
// 17. LOAD CHART.JS
// ────────────────────────────────────────────────────────────
async function loadChartJS() {
  if (window.Chart) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ────────────────────────────────────────────────────────────
// 18. INICIALIZAÇÃO
// ────────────────────────────────────────────────────────────
async function init() {
  injectStyles();
  injectCanvases();
  injectCustomDatePicker();
  bindEvents();

  await loadChartJS();

  const sensors = await fetchSensors();
  state.selectedSensors = sensors.slice(0, 2);
  renderSensorSelector();

  await refreshData();
  subscribeRealtime();
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();