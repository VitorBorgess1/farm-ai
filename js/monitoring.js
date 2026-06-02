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

// 4095 = sensor no ar / leitura inválida; filtra e usa o valor direto (já em %)
const soilPct = raw => (raw == null || Number(raw) >= 4095) ? null : Number(raw);

// ────────────────────────────────────────────────────────────
// 4. BUSCA DE DADOS
// ────────────────────────────────────────────────────────────
// fetchSensors removido — sensor único (ESP32 Sensor 1)

async function fetchReadings() {
  const startDate = getStartDate(state.filter).toISOString();

  let query = supabaseClientMonitoring
    .from('leituras_solo')
    .select('id, created_at, sensor_id, temp_ar, umid_ar, umid_solo, luz_ambiente')
    .gte('created_at', startDate)
    .order('created_at', { ascending: true })
    .limit(500);

  // Aplica limite superior para filtro personalizado
  if (state.filter === 'custom') {
    const endVal = document.getElementById('customEnd')?.value;
    if (endVal) {
      const endDate = new Date(endVal);
      endDate.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endDate.toISOString());
    }
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

  // Label do eixo X: hora (filtro 24h) ou dia/hora (7d / custom)
  const use24h = state.filter === '24h';
  const labels = readings.map(r =>
    use24h
      ? new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  );

  // Atualiza subtítulo do card
  const sub = document.getElementById('chartSubLabel');
  if (sub) sub.textContent = use24h ? 'Evolução por hora — ESP32 Sensor 1' : 'Evolução por dia — ESP32 Sensor 1';

  const data = readings.map(r => soilPct(r.umid_solo));

  if (state.chart) state.chart.destroy();

  state.chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Umidade Solo',
        data,
        borderColor: '#4ade80',
        backgroundColor: 'rgba(74,222,128,0.12)',
        fill: true,
        tension: 0.42,
        pointRadius: readings.length < 30 ? 4 : 2,
        pointHoverRadius: 6,
        borderWidth: 2.5,
        spanGaps: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(74,222,128,0.25)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: ctx => ` Umidade: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) : '--'}%`,
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

  // KPI — média das últimas 20 leituras válidas
  const kpiEl = document.querySelector('.mon-chart-kpi-value');
  const recentes = readings.slice(-20).map(r => soilPct(r.umid_solo)).filter(v => v != null);
  if (kpiEl) kpiEl.textContent = recentes.length
    ? (recentes.reduce((s, v) => s + v, 0) / recentes.length).toFixed(1) + '%'
    : '--';
}

// ────────────────────────────────────────────────────────────
// 6. MINI GRÁFICO — Temperatura do ar ao longo do tempo (barras)
// ────────────────────────────────────────────────────────────
function buildPhMiniChart(readings) {
  const withTemp = readings.filter(r => r.temp_ar != null).slice(-8);

  // Atualiza valor numérico no card
  const latestTemp = withTemp.at(-1)?.temp_ar;
  const firstVal = document.querySelector('.mon-metric-value');
  if (firstVal) firstVal.textContent = latestTemp != null ? Number(latestTemp).toFixed(1) : '--';

  if (!withTemp.length) return;

  // Destrói chart anterior e recria o canvas para evitar que o Chart.js
  // remova o elemento do DOM ao fazer destroy()
  if (state.chartPh) { state.chartPh.destroy(); state.chartPh = null; }
  const wrap = document.getElementById('tempChartWrap');
  if (!wrap) return;
  wrap.innerHTML = '<canvas id="tempChartCanvas"></canvas>';
  const canvas = document.getElementById('tempChartCanvas');

  state.chartPh = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: withTemp.map(r => fmt(r.created_at)),
      datasets: [{
        data: withTemp.map(r => Number(r.temp_ar)),
        backgroundColor: withTemp.map(r =>
          Number(r.temp_ar) > 35 ? 'rgba(248,113,113,0.75)' :
          Number(r.temp_ar) < 10 ? 'rgba(96,165,250,0.75)'  :
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

  const temp    = Number(latest.temp_ar);
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
    const pct         = soilPct(r.umid_solo);
    const sensorLabel = r.sensor_id != null
      ? `<span class="sensor-badge">${r.sensor_id}</span>`
      : '<span style="color:#475569">—</span>';

    return `
      <tr>
        <td>${fmtD(r.created_at)}</td>
        <td>${sensorLabel}</td>
        <td>${pct != null ? pct.toFixed(1) + '%' : '—'}</td>
        <td>${r.temp_ar != null ? Number(r.temp_ar).toFixed(1) + '°C' : '—'}</td>
        <td><span class="status-chip status-chip--${status.cls}">${status.label}</span></td>
      </tr>`;
  }).join('');
}

function getStatus(r) {
  const u    = soilPct(r.umid_solo);
  const temp = r.temp_ar != null ? Number(r.temp_ar) : null;
  if (u    != null && u    < 20)                return { cls: 'danger', label: 'Crítico'    };
  if (u    != null && u    < 35)                return { cls: 'warn',   label: 'Alerta'     };
  if (temp != null && (temp > 35 || temp < 10)) return { cls: 'warn',   label: 'Temp. Fora' };
  return { cls: 'ok', label: 'Normal' };
}

// 9. Seletor de sensores removido — apenas ESP32 Sensor 1 ativo

// ────────────────────────────────────────────────────────────
// 10. EXPORT CSV
// ────────────────────────────────────────────────────────────
function exportCSV() {
  const headers = ['Horário', 'Sensor ID', 'Umidade Solo (%)', 'Temp. Ar (°C)', 'Umidade Ar (%)', 'Luz Ambiente', 'Status'];
  const rows = state.readings.map(r => {
    const s   = getStatus(r);
    const pct = soilPct(r.umid_solo);
    return [
      fmtD(r.created_at),
      r.sensor_id ?? '',
      pct != null ? pct.toFixed(1) : '',
      r.temp_ar != null ? Number(r.temp_ar).toFixed(1) : '',
      r.umid_ar != null ? Number(r.umid_ar).toFixed(1) : '',
      r.luz_ambiente != null ? Number(r.luz_ambiente).toFixed(0) : '',
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
  if (state.realtimeChannel) supabaseClientMonitoring.removeChannel(state.realtimeChannel);

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
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 10000)
    );
    await Promise.race([fetchReadings(), timeout]);
  } catch (err) {
    console.warn('[refreshData] erro ou timeout:', err.message);
  } finally {
    buildMainChart(state.readings);
    buildPhMiniChart(state.readings);
    updatePhCard(state.readings);
    renderTable(state.readings);
    showLoading(false);
  }
}

function showLoading(on) {
  const el = document.getElementById('loadingOverlay');
  if (!el) return;
  el.style.opacity = on ? '1' : '0';
  el.style.pointerEvents = on ? 'all' : 'none';
}

// ────────────────────────────────────────────────────────────
// 13. INJEÇÃO DE DOM
// ────────────────────────────────────────────────────────────
function injectCanvases() {
  const chartBody = document.querySelector('.mon-chart-body');
  if (chartBody) {
    chartBody.style.cssText = 'position:relative;height:220px;width:100%;';
    chartBody.innerHTML = `<canvas id="mainChartCanvas" style="position:absolute;inset:0;width:100%!important;height:100%!important;"></canvas>`;
  }

  // Injeta wrapper do mini gráfico apenas uma vez
  if (!document.getElementById('tempChartCanvas')) {
    const miniBars = document.querySelector('.mon-mini-bars');
    if (miniBars) {
      const wrap = document.createElement('div');
      wrap.id = 'tempChartWrap';
      wrap.style.cssText = 'height:48px;margin-top:8px;';
      wrap.innerHTML = '<canvas id="tempChartCanvas"></canvas>';
      miniBars.replaceWith(wrap);
    }
  }

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

    .custom-picker-panel {
      background: var(--color-surface, #fff);
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 12px;
      padding: 12px 16px;
      display: inline-flex;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    .custom-picker-row {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      flex-wrap: wrap;
    }
    .custom-picker-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .custom-picker-label {
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .custom-picker-input {
      background: rgba(0,0,0,0.03);
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 13px;
      font-family: Manrope, sans-serif;
      color: inherit;
      cursor: pointer;
    }
    .custom-picker-input:focus { outline: 2px solid #4ade80; }
    .custom-picker-sep {
      font-size: 16px;
      color: #94a3b8;
      padding-bottom: 6px;
    }
    .custom-picker-apply {
      background: #4ade80;
      color: #020817;
      border: none;
      border-radius: 8px;
      padding: 7px 16px;
      font-size: 13px;
      font-weight: 700;
      font-family: Manrope, sans-serif;
      cursor: pointer;
      transition: opacity .15s;
    }
    .custom-picker-apply:hover { opacity: 0.85; }

    .mon-sensor-info { padding: 4px 0; }
    .mon-sensor-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
    }
    .mon-sensor-icon { color: #4ade80; font-size: 22px; }
    .mon-sensor-name { font-size: 13px; font-weight: 600; margin: 0 0 2px; }
    .mon-sensor-desc { font-size: 11px; color: #94a3b8; margin: 0; }
  `;
  document.head.appendChild(style);
}

// ────────────────────────────────────────────────────────────
// 15. DATE PICKER — já está no HTML, só controla visibilidade
// ────────────────────────────────────────────────────────────
function toggleDatePicker(show) {
  const el = document.getElementById('customDatePicker');
  if (el) el.style.display = show ? 'block' : 'none';
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
  document.getElementById('applyCustomFilter')?.addEventListener('click', refreshData);

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
  bindEvents();

  await loadChartJS();
  await refreshData();
  subscribeRealtime();
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();