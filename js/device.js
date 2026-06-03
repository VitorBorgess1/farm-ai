/* ============================================================
   FarmAI — device.js
   Página de Dispositivos: dados reais do ESP32 via Supabase
   ============================================================ */

// Reutiliza o cliente Supabase já criado pelo script.js
const supabaseDev = window._farmaiSupabase || window.supabase?.createClient('https://bydyipretbicpvbqmuvb.supabase.co', 'sb_publishable_2RPgrQBaMC4utot6oGU-gQ_jVeJ3a9k');

const soilPctDev = raw => (raw == null || Number(raw) >= 4095) ? null : Number(raw);

function tempoRelDev(iso) {
  const diff = Math.floor(Math.abs(Date.now() - new Date(iso)) / 1000);
  if (diff < 60)    return `há ${diff}s`;
  if (diff < 3600)  return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `há ${Math.floor(diff / 86400)}d`;
}

function fmtDevLog(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function luzNivel(adc) {
  const v = Number(adc);
  if (v < 500)  return 'Baixa';
  if (v <= 3000) return 'Adequada';
  return 'Intensa';
}

// ─── Atualiza cards de dispositivos ──────────────────────────
function atualizarCards(leitura, leituraValida, sensor) {
  const el = id => document.getElementById(id);
  const agora = new Date();

  // ── Online/Offline: última leitura < 60min = online
  const diffMin = leitura
    ? Math.floor(Math.abs(agora - new Date(leitura.created_at)) / 60000)
    : null;
  const online = diffMin !== null && diffMin < 60;

  const statusPill  = document.getElementById('devEsp32Status');
  const statusLabel = el('devEsp32StatusLabel');
  if (statusPill && statusLabel) {
    statusPill.className = `dev-status-pill ${online ? 'dev-status-pill--online' : 'dev-status-pill--offline'}`;
    statusLabel.textContent = online ? 'Online' : 'Offline';
  }

  // ── Umidade do solo (última leitura válida)
  const pct = soilPctDev(leituraValida?.umid_solo);
  if (el('devEsp32Umid')) el('devEsp32Umid').textContent = pct != null ? pct.toFixed(1) + '%' : '—';

  // ── Bateria da tabela sensores
  if (el('devEsp32Bateria')) {
    const bat = sensor?.status_bateria;
    el('devEsp32Bateria').textContent = bat != null ? bat + '%' : 'N/D';
  }

  // ── Última sync
  if (el('devEsp32Sync')) {
    el('devEsp32Sync').textContent = leitura
      ? `Última sinc.: ${tempoRelDev(leitura.created_at)}`
      : 'Sem sincronização';
  }

  // ── Temperatura e umidade do ar
  if (leitura) {
    const temp = Number(leitura.temp_ar);
    const umidAr = Number(leitura.umid_ar);
    if (el('devTempValor'))   el('devTempValor').textContent   = temp.toFixed(1) + '°C';
    if (el('devUmidArValor')) el('devUmidArValor').textContent = umidAr.toFixed(0) + '%';
    if (el('devTempSync'))    el('devTempSync').textContent    = `Última sinc.: ${tempoRelDev(leitura.created_at)}`;

    // ── Luminosidade
    const luzAdc = Number(leitura.luz_ambiente);
    if (el('devLuzValor'))  el('devLuzValor').textContent  = luzAdc.toFixed(0);
    if (el('devLuzNivel'))  el('devLuzNivel').textContent  = luzNivel(luzAdc);
    if (el('devLuzSync'))   el('devLuzSync').textContent   = `Última sinc.: ${tempoRelDev(leitura.created_at)}`;
  }
}

// ─── KPIs do hero ────────────────────────────────────────────
async function atualizarKPIs(online, leituras) {
  const el = id => document.getElementById(id);

  // Ativos: 1 se online, 0 se não
  if (el('kpiAtivos')) el('kpiAtivos').textContent = online ? '1' : '0';

  // Alertas: classifica a última leitura
  const ultima = leituras[0] ?? null;
  const cls = classificarLeitura(ultima);
  const score = calcularScoreGeral(cls);
  const temAlerta = score != null && score < 70;
  if (el('kpiCriticos')) el('kpiCriticos').textContent = temAlerta ? '1' : '0';

  // Leituras hoje
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const leiturasHoje = leituras.filter(r => new Date(r.created_at) >= hoje).length;
  if (el('kpiLeituras')) el('kpiLeituras').textContent = leiturasHoje;
}

// ─── Intervalo médio entre leituras ──────────────────────────
function calcularIntervalo(leituras) {
  if (leituras.length < 2) return '—';
  const diffs = [];
  for (let i = 0; i < Math.min(10, leituras.length - 1); i++) {
    const diff = Math.abs(
      new Date(leituras[i].created_at) - new Date(leituras[i + 1].created_at)
    ) / 1000;
    diffs.push(diff);
  }
  const media = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  if (media < 60)  return `${Math.round(media)}s`;
  return `${Math.round(media / 60)}min`;
}

// ─── Registros de leitura (log dinâmico) ─────────────────────
function renderLogs(leituras) {
  const body = document.getElementById('devLogsBody');
  if (!body) return;

  if (!leituras.length) {
    body.innerHTML = `<div style="padding:24px;text-align:center;color:#94a3b8;font-size:13px;font-family:Manrope,sans-serif;">Nenhum registro encontrado.</div>`;
    return;
  }

  body.innerHTML = leituras.slice(0, 10).map(r => {
    const cls   = classificarLeitura(r);
    const score = calcularScoreGeral(cls);
    const ok    = score == null || score >= 70;
    const pct   = soilPctDev(r.umid_solo);

    const evento = pct != null
      ? `Leitura — Solo ${pct.toFixed(1)}% · ${Number(r.temp_ar).toFixed(1)}°C`
      : `Leitura — Temp ${Number(r.temp_ar).toFixed(1)}°C · Umid. Ar ${Number(r.umid_ar).toFixed(0)}%`;

    const badge = ok
      ? `<span class="table-badge table-badge--active">OK</span>`
      : `<span class="table-badge table-badge--warn">ATENÇÃO</span>`;

    return `
      <div class="dev-log-row">
        <div class="dev-log-device">ESP32 — Sensor 1</div>
        <div class="dev-log-event">${evento}</div>
        <div>${badge}</div>
        <div class="dev-log-time">${fmtDevLog(r.created_at)}</div>
      </div>`;
  }).join('');
}

// ─── Inicialização ────────────────────────────────────────────
async function initDevice() {
  // Todas as queries em paralelo
  const [
    { data: dataRecente },
    { data: dataValida },
    { data: dataSensor },
  ] = await Promise.all([
    supabaseDev
      .from('leituras_solo')
      .select('created_at, sensor_id, temp_ar, umid_ar, umid_solo, luz_ambiente')
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseDev
      .from('leituras_solo')
      .select('created_at, umid_solo')
      .lt('umid_solo', 4095)
      .order('created_at', { ascending: false })
      .limit(1),
    supabaseDev
      .from('sensores')
      .select('id, status_bateria')
      .eq('id', 1)
      .limit(1),
  ]);

  const leituras      = dataRecente || [];
  const recente       = leituras[0] ?? null;
  const leituraValida = dataValida?.[0] ?? null;
  const sensor        = dataSensor?.[0] ?? null;

  // Online se última leitura < 60min
  const diffMin = recente
    ? Math.floor(Math.abs(Date.now() - new Date(recente.created_at)) / 60000)
    : null;
  const online = diffMin !== null && diffMin < 60;

  // Intervalo médio
  const intervalo = calcularIntervalo(leituras);
  const elIntervalo = document.getElementById('devIntervaloDados');
  if (elIntervalo) elIntervalo.textContent = intervalo;

  atualizarCards(recente, leituraValida, sensor);
  await atualizarKPIs(online, leituras);
  renderLogs(leituras);
}

document.addEventListener('DOMContentLoaded', initDevice);