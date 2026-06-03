/* ============================================================
   FarmAI — alerts.js
   Central de Inteligência: alertas gerados dinamicamente
   a partir dos dados reais do Supabase + classificadores
   do script.js
   ============================================================ */

const SUPABASE_URL_ALR = 'https://bydyipretbicpvbqmuvb.supabase.co';
const SUPABASE_KEY_ALR = 'sb_publishable_2RPgrQBaMC4utot6oGU-gQ_jVeJ3a9k';
const supabaseAlr = window.supabase.createClient(SUPABASE_URL_ALR, SUPABASE_KEY_ALR);

const soilPctAlr = raw => (raw == null || Number(raw) >= 4095) ? null : Number(raw);

function fmtAlr(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function tempoAlr(iso) {
  const diff = Math.floor(Math.abs(Date.now() - new Date(iso)) / 1000);
  if (diff < 60)    return `${diff}s atrás`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

// ─── Gera alertas com base na classificação ──────────────────
function gerarAlertas(cls, leitura) {
  if (!cls || !leitura) return [];

  const alertas = [];
  const ts = tempoAlr(leitura.created_at);

  // Umidade do solo
  if (cls.nivel_umid_solo === 'critico') {
    const pct = soilPctAlr(leitura.umid_solo);
    alertas.push({
      nivel: 'critical',
      icone: 'water_drop',
      urgencia: 'Urgência: Crítica',
      titulo: pct < 15
        ? `Solo muito seco — ESP32 Sensor 1 (${pct?.toFixed(1)}%)`
        : `Solo encharcado — ESP32 Sensor 1 (${pct?.toFixed(1)}%)`,
      desc: pct < 15
        ? 'Umidade do solo criticamente baixa. Recomenda-se irrigação imediata para evitar estresse hídrico e perda de produtividade.'
        : 'Excesso de água detectado no solo. Suspenda a irrigação e verifique a drenagem para evitar apodrecimento radicular.',
      ts,
      acoes: ['Iniciar Irrigação', 'Ver Monitoramento'],
    });
  } else if (cls.nivel_umid_solo === 'atencao') {
    const pct = soilPctAlr(leitura.umid_solo);
    alertas.push({
      nivel: 'warning',
      icone: 'water_drop',
      urgencia: 'Urgência: Média',
      titulo: `Solo fora da faixa ideal — ESP32 Sensor 1 (${pct?.toFixed(1)}%)`,
      desc: pct < 25
        ? 'Umidade levemente abaixo do recomendado. Considere irrigação moderada nas próximas horas.'
        : 'Solo com umidade levemente elevada. Evite nova irrigação até retornar à faixa ideal.',
      ts,
      acoes: ['Ver Monitoramento'],
    });
  }

  // Temperatura do ar
  if (cls.nivel_temp === 'critico') {
    const t = Number(leitura.temp_ar);
    alertas.push({
      nivel: 'critical',
      icone: 'thermostat',
      urgencia: 'Urgência: Crítica',
      titulo: t < 10
        ? `Temperatura muito baixa — ESP32 Sensor 1 (${t.toFixed(1)}°C)`
        : `Temperatura muito elevada — ESP32 Sensor 1 (${t.toFixed(1)}°C)`,
      desc: t < 10
        ? 'Frio intenso pode causar danos celulares e estresse fisiológico. Considere proteção para culturas sensíveis.'
        : 'Calor intenso acelera a evaporação e pode causar desidratação foliar. Aumente a frequência de irrigação.',
      ts,
      acoes: ['Ver Monitoramento'],
    });
  } else if (cls.nivel_temp === 'atencao') {
    const t = Number(leitura.temp_ar);
    alertas.push({
      nivel: 'warning',
      icone: 'thermostat',
      urgencia: 'Urgência: Média',
      titulo: `Temperatura fora da faixa ideal — ESP32 Sensor 1 (${t.toFixed(1)}°C)`,
      desc: t > 35
        ? 'Temperatura acima do ideal. Monitore sinais de estresse hídrico e ajuste a irrigação se necessário.'
        : 'Temperatura abaixo do ideal. Monitore culturas sensíveis ao frio.',
      ts,
      acoes: ['Ver Monitoramento'],
    });
  }

  // Umidade do ar
  if (cls.nivel_umid_ar === 'critico') {
    alertas.push({
      nivel: 'warning',
      icone: 'air',
      urgencia: 'Urgência: Média',
      titulo: `Umidade do ar crítica — ESP32 Sensor 1 (${Number(leitura.umid_ar).toFixed(0)}%)`,
      desc: 'Ar muito seco acelera a evapotranspiração e resseca as folhas. Aumente a frequência de irrigação.',
      ts,
      acoes: ['Ver Monitoramento'],
    });
  }

  return alertas;
}

// ─── Renderiza o feed de alertas ativos ──────────────────────
function renderFeedAtivo(alertas) {
  const feed  = document.getElementById('alrActiveFeed');
  const count = document.getElementById('alrPriorityCount');
  if (!feed) return;

  const criticos = alertas.filter(a => a.nivel === 'critical').length;
  const total    = alertas.length;

  if (count) {
    count.textContent = total === 0
      ? 'Nenhuma urgência'
      : `${total} ação${total > 1 ? 'ões' : ''} prioritária${total > 1 ? 's' : ''}`;
  }

  if (total === 0) {
    feed.innerHTML = `
      <div style="padding:32px;text-align:center;font-family:Manrope,sans-serif;">
        <span class="material-symbols-outlined" style="font-size:36px;color:#4ade80;display:block;margin-bottom:8px;">check_circle</span>
        <p style="color:#4ade80;font-weight:600;font-size:14px;margin:0 0 4px;">Tudo sob controle</p>
        <p style="color:#94a3b8;font-size:12px;margin:0;">Nenhuma urgência detectada no momento.</p>
      </div>`;
    return;
  }

  feed.innerHTML = alertas.map((a, i) => `
    <article class="alr-card ${a.nivel === 'critical' ? 'alr-card--critical' : 'alr-card--warning'}" id="alertCard${i}">
      ${a.nivel === 'critical' ? '<div class="alr-card-glow alr-card-glow--error"></div>' : ''}
      <div class="alr-card-body">
        <div class="alr-card-icon icon-box ${a.nivel === 'critical' ? 'icon-error' : 'icon-tertiary'}">
          <span class="material-symbols-outlined filled">${a.icone}</span>
        </div>
        <div class="alr-card-content">
          <div class="alr-card-meta">
            <span class="alr-urgency-label ${a.nivel === 'critical' ? 'alr-urgency-label--critical' : 'alr-urgency-label--warning'}">${a.urgencia}</span>
            <span class="alr-timestamp">${a.ts}</span>
          </div>
          <h4 class="alr-card-title">${a.titulo}</h4>
          <p class="alr-card-desc">${a.desc}</p>
          <div class="alr-card-actions">
            ${a.acoes.map((acao, j) => `
              <button class="${j === 0 && a.nivel === 'critical' ? 'btn-alert-primary' : 'btn-alert-secondary'}"
                onclick="${acao === 'Iniciar Irrigação' ? `document.getElementById('alertCard${i}').style.opacity='0.5';this.textContent='✓ Irrigação Iniciada';this.disabled=true` : "window.location.href='monitoring.html'"}">
                ${acao}
              </button>`).join('')}
          </div>
        </div>
      </div>
    </article>`).join('');
}

// ─── Renderiza histórico das últimas leituras normais ────────
function renderHistorico(leituras) {
  const feed = document.getElementById('alrResolvedFeed');
  if (!feed) return;

  const normais = leituras
    .filter(r => {
      const cls = classificarLeitura(r);
      return cls && cls.nivel_umid_solo === 'ideal' && cls.nivel_temp === 'ideal';
    })
    .slice(0, 5);

  if (!normais.length) {
    feed.innerHTML = `<p style="padding:12px;color:#94a3b8;font-size:13px;font-family:Manrope,sans-serif;">Nenhum registro normal recente encontrado.</p>`;
    return;
  }

  feed.innerHTML = normais.map(r => {
    const pct = soilPctAlr(r.umid_solo);
    return `
      <div class="alr-resolved-item">
        <div class="icon-box icon-secondary alr-resolved-icon">
          <span class="material-symbols-outlined">check_circle</span>
        </div>
        <div class="alr-resolved-text">
          <h5 class="alr-resolved-title">Leitura Normal — ESP32 Sensor 1</h5>
          <p class="alr-resolved-desc">
            Solo: ${pct != null ? pct.toFixed(1) + '%' : '—'} · Temp: ${Number(r.temp_ar).toFixed(1)}°C · Umid. Ar: ${Number(r.umid_ar).toFixed(0)}%
          </p>
        </div>
        <div class="alr-resolved-time">
          <span class="alr-resolved-day">${new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
          <span class="alr-resolved-clock">${new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>`;
  }).join('');
}

// ─── Resumo semanal ──────────────────────────────────────────
function renderResumoSemanal(leituras) {
  const validas = leituras.filter(r => soilPctAlr(r.umid_solo) != null);
  const total   = leituras.length;

  // % de leituras normais
  const normais = leituras.filter(r => {
    const cls = classificarLeitura(r);
    return cls && cls.nivel_umid_solo === 'ideal' && cls.nivel_temp === 'ideal';
  }).length;
  const pctNormal = total > 0 ? Math.round((normais / total) * 100) : 0;

  // Médias
  const mediaUmid = validas.length > 0
    ? validas.reduce((s, r) => s + soilPctAlr(r.umid_solo), 0) / validas.length
    : null;
  const mediaTemp = leituras.filter(r => r.temp_ar != null).length > 0
    ? leituras.filter(r => r.temp_ar != null).reduce((s, r) => s + Number(r.temp_ar), 0) / leituras.filter(r => r.temp_ar != null).length
    : null;

  const el = (id) => document.getElementById(id);
  if (el('alrPctNormal'))  el('alrPctNormal').textContent  = `${pctNormal}%`;
  if (el('alrBarNormal'))  el('alrBarNormal').style.width  = `${pctNormal}%`;
  if (el('alrMediaUmid'))  el('alrMediaUmid').textContent  = mediaUmid != null ? `${mediaUmid.toFixed(1)}%` : '—';
  if (el('alrBarUmid'))    el('alrBarUmid').style.width    = mediaUmid != null ? `${mediaUmid}%` : '0%';
  if (el('alrMediaTemp'))  el('alrMediaTemp').textContent  = mediaTemp != null ? `${mediaTemp.toFixed(1)}°C` : '—';
  if (el('alrBarTemp'))    el('alrBarTemp').style.width    = mediaTemp != null ? `${Math.min(100, (mediaTemp / 50) * 100)}%` : '0%';
}

// ─── Status do sensor ────────────────────────────────────────
function renderStatusSensor(leitura, cls) {
  const el = document.getElementById('alrSensorStatus');
  if (!el) return;

  const score  = calcularScoreGeral(cls);
  const rotulo = score != null ? rotularScore(score) : 'Sem dados';
  const cor    = score >= 90 ? 'ok' : score >= 70 ? 'ok' : score >= 50 ? 'critical' : 'critical';
  const diff   = leitura ? Math.floor(Math.abs(Date.now() - new Date(leitura.created_at)) / 60000) : null;
  const online = diff != null && diff < 60;

  el.innerHTML = `
    <div class="alr-sector-item ${online ? 'alr-sector-item--ok' : 'alr-sector-item--critical'}">
      <div class="alr-sector-item-left">
        <span class="alr-sector-dot alr-sector-dot--${online ? 'ok' : 'critical'}"></span>
        <span class="alr-sector-name">ESP32 — Sensor 1</span>
      </div>
      <span class="alr-sector-status alr-sector-status--${online ? 'ok' : 'critical'}">
        ${online ? rotulo.toUpperCase() : 'OFFLINE'}
      </span>
    </div>
    <div style="padding:8px 4px;font-size:11px;color:#94a3b8;font-family:Manrope,sans-serif;">
      ${leitura ? `Última leitura: ${tempoAlr(leitura.created_at)}` : 'Sem leituras recentes'}
    </div>`;
}

// ─── Card de última leitura (satellite card) ─────────────────
function renderUltimaLeitura(leitura, cls) {
  const el = document.getElementById('alrLastReadingText');
  if (!el || !leitura) return;
  const pct = soilPctAlr(leitura.umid_solo);
  el.textContent = `Solo: ${pct != null ? pct.toFixed(1) + '%' : '—'} · ${Number(leitura.temp_ar).toFixed(1)}°C · Umid. Ar: ${Number(leitura.umid_ar).toFixed(0)}% · ${fmtAlr(leitura.created_at)}`;
}

// ─── Inicialização principal ─────────────────────────────────
async function initAlertas() {
  // Última leitura válida de umid_solo
  const { data: dataValida } = await supabaseAlr
    .from('leituras_solo')
    .select('created_at, temp_ar, umid_ar, umid_solo, luz_ambiente')
    .lt('umid_solo', 4095)
    .order('created_at', { ascending: false })
    .limit(1);

  // Leitura mais recente (para temp/umid_ar/luz)
  const { data: dataRecente } = await supabaseAlr
    .from('leituras_solo')
    .select('created_at, temp_ar, umid_ar, umid_solo, luz_ambiente')
    .order('created_at', { ascending: false })
    .limit(1);

  const recente = dataRecente?.[0] ?? null;
  const valida  = dataValida?.[0]  ?? null;

  const leitura = recente ? { ...recente, umid_solo: valida?.umid_solo ?? recente.umid_solo } : null;
  const cls     = classificarLeitura(leitura);

  // Gera e renderiza alertas
  const alertas = gerarAlertas(cls, leitura);
  renderFeedAtivo(alertas);
  renderStatusSensor(recente, cls);
  renderUltimaLeitura(leitura, cls);

  // Últimos 7 dias para histórico e resumo
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  const { data: semana } = await supabaseAlr
    .from('leituras_solo')
    .select('created_at, temp_ar, umid_ar, umid_solo, luz_ambiente')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false })
    .limit(300);

  const leiturasSemana = semana || [];
  renderResumoSemanal(leiturasSemana);
  renderHistorico(leiturasSemana);
}

// ─── Exportar Registros (CSV da semana) ──────────────────────
async function exportarRegistros() {
  const btn = document.getElementById('exportLogsBtn');
  if (!btn) return;

  const original = btn.innerHTML;
  btn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> Gerando...';
  btn.disabled = true;

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const { data } = await supabaseAlr
      .from('leituras_solo')
      .select('created_at, sensor_id, temp_ar, umid_ar, umid_solo, luz_ambiente')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(500);

    if (!data?.length) {
      btn.innerHTML = '<span class="material-symbols-outlined">error</span> Sem dados';
      setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 2000);
      return;
    }

    const headers = ['Horário', 'Sensor ID', 'Umidade Solo (%)', 'Temp. Ar (°C)', 'Umidade Ar (%)', 'Luz Ambiente', 'Status'];
    const rows = data.map(r => {
      const pct = soilPctAlr(r.umid_solo);
      const cls = classificarLeitura(r);
      const score = calcularScoreGeral(cls);
      const status = score != null ? rotularScore(score) : 'Sem dados';
      return [
        new Date(r.created_at).toLocaleString('pt-BR'),
        r.sensor_id ?? '',
        pct != null ? pct.toFixed(1) : '',
        r.temp_ar != null ? Number(r.temp_ar).toFixed(1) : '',
        r.umid_ar != null ? Number(r.umid_ar).toFixed(1) : '',
        r.luz_ambiente != null ? Number(r.luz_ambiente).toFixed(0) : '',
        status,
      ].join(',');
    });

    const csv  = [headers.join(','), ...rows].join('
');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const agora = new Date().toISOString().slice(0, 10);
    a.href     = url;
    a.download = `farmai-alertas-${agora}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    btn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Exportado!';
    setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 3000);

  } catch (err) {
    console.error('[Alertas] Erro ao exportar:', err);
    btn.innerHTML = original;
    btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initAlertas();
  document.getElementById('exportLogsBtn')?.addEventListener('click', exportarRegistros);
});