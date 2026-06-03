/* ============================================================
   FarmAI — dashboard.js
   Lógica exclusiva do index.html (Painel de Controle)
   Usa as funções de classificação definidas em script.js
   ============================================================ */

// ─── Exportar Relatório (screenshot da página) ────────────────
async function exportarRelatorio() {
  const btn = document.getElementById('exportReportBtn');
  if (!btn) return;

  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<span class="material-symbols-outlined">hourglass_top</span> Gerando...';
  btn.disabled = true;

  try {
    // Carrega html2canvas dinamicamente se não estiver disponível
    if (!window.html2canvas) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    const canvas = await html2canvas(document.querySelector('.content-canvas'), {
      scale: 2,
      useCORS: true,
      backgroundColor: getComputedStyle(document.body).backgroundColor || '#f8fafc',
      logging: false,
    });

    // Data e hora no nome do arquivo
    const agora = new Date().toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).replace(/[/:, ]/g, '-').replace(/--/g, '-');

    const link = document.createElement('a');
    link.download = `farmai-relatorio-${agora}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    btn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Exportado!';
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }, 3000);

  } catch (err) {
    console.error('[Dashboard] Erro ao exportar:', err);
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
}

const SUPABASE_URL_DASH = 'https://bydyipretbicpvbqmuvb.supabase.co';
const SUPABASE_KEY_DASH = 'sb_publishable_2RPgrQBaMC4utot6oGU-gQ_jVeJ3a9k';
const supabaseDash = window.supabase.createClient(SUPABASE_URL_DASH, SUPABASE_KEY_DASH);

// ─── Helpers ────────────────────────────────────────────────
const soilPctDash = raw => (raw == null || Number(raw) >= 4095) ? null : Number(raw);

function luzParaPct(adc) {
  // Converte ADC raw (0–4095) para percentual visual
  if (adc == null) return null;
  return Math.min(100, Math.round((Number(adc) / 4095) * 100));
}

function tempParaPct(temp) {
  // Mapeia 0–50°C para 0–100% na barra
  return Math.min(100, Math.max(0, Math.round((Number(temp) / 50) * 100)));
}

function tempoRelativo(isoString) {
  if (!isoString) return 'Desconhecido';
  const diff = Math.floor(Math.abs(Date.now() - new Date(isoString)) / 1000);
  if (diff < 60)   return `${diff} segundo(s) atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minuto(s) atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hora(s) atrás`;
  return `${Math.floor(diff / 86400)} dia(s) atrás`;
}

// ─── Gerador de Insight baseado nos dados reais ───────────────
function gerarInsight(cls) {
  if (!cls) return 'Sem dados disponíveis dos sensores. Verifique a conexão do ESP32.';

  const { nivel_umid_solo, nivel_temp, nivel_umid_ar, nivel_luz } = cls;

  // Prioridade: solo crítico > temperatura crítica > umidade do ar > luz
  if (nivel_umid_solo === 'critico') {
    if (Number(cls.umid_solo) < 20) {
      return `Solo encharcado detectado (${cls.umid_solo}%). Suspenda a irrigação imediatamente e avalie a drenagem para evitar apodrecimento radicular.`;
    }
    return `Umidade do solo criticamente baixa (${cls.umid_solo}%). Recomendamos irrigação nas próximas horas para prevenir estresse hídrico severo e queda de produtividade.`;
  }

  if (nivel_temp === 'critico') {
    if (Number(cls.temp_ar) < 10) {
      return `Temperatura muito baixa detectada (${cls.temp_ar}°C). Considere proteção para culturas sensíveis ao frio. Monitore a tendência nas próximas horas.`;
    }
    return `Temperatura muito elevada (${cls.temp_ar}°C). Aumente a frequência de irrigação para compensar a evaporação acelerada e reduzir o estresse hídrico.`;
  }

  if (nivel_umid_solo === 'atencao') {
    if (Number(cls.umid_solo) < 35) {
      return `Umidade do solo levemente abaixo do ideal (${cls.umid_solo}%). Considere irrigação moderada e acompanhe a evolução nas próximas horas.`;
    }
    return `Solo com umidade levemente elevada (${cls.umid_solo}%). Monitore a drenagem e evite nova irrigação até retornar à faixa ideal.`;
  }

  if (nivel_temp === 'atencao') {
    return `Temperatura ${Number(cls.temp_ar) > 35 ? 'acima' : 'abaixo'} da faixa ideal (${cls.temp_ar}°C). Monitore sinais de estresse nas plantas e ajuste a irrigação se necessário.`;
  }

  if (nivel_umid_ar === 'critico') {
    return `Umidade do ar muito baixa (${cls.umid_ar}%). O ar seco acelera a evapotranspiração. Aumente a frequência de irrigação para compensar.`;
  }

  // Tudo OK
  return `Condições gerais favoráveis: solo com ${cls.umid_solo}% de umidade, temperatura de ${cls.temp_ar}°C e umidade do ar em ${cls.umid_ar}%. Mantenha o monitoramento contínuo.`;
}

// ─── Carrega última leitura e atualiza cards ──────────────────
async function atualizarDashboard() {
  try {
    // Busca a última leitura com umid_solo válida (sensor no solo, não no ar)
    const { data: dataValida, error: errValida } = await supabaseDash
      .from('leituras_solo')
      .select('created_at, sensor_id, temp_ar, umid_ar, umid_solo, luz_ambiente')
      .lt('umid_solo', 4095)
      .order('created_at', { ascending: false })
      .limit(1);

    // Busca a leitura mais recente para temperatura/umid_ar/luz (pode ter sensor no ar)
    const { data, error } = await supabaseDash
      .from('leituras_solo')
      .select('created_at, sensor_id, temp_ar, umid_ar, umid_solo, luz_ambiente')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) { console.error('[Dashboard]', error); return; }

    const leitura = data?.[0] ?? null;
    const leituraValida = dataValida?.[0] ?? null;

    // Mescla: usa umid_solo da leitura válida, resto da mais recente
    const leituraCompleta = leitura ? {
      ...leitura,
      umid_solo: leituraValida?.umid_solo ?? leitura.umid_solo,
    } : null;

    // Usa os classificadores do script.js (já carregado antes deste arquivo)
    const cls = classificarLeitura(leituraCompleta);

    // ── Última sincronização ──────────────────────────────
    const elSync = document.getElementById('dashLastSync');
    if (elSync) elSync.textContent = leitura
      ? `Última sincronização: ${tempoRelativo(leitura.created_at)}`
      : 'Sem dados do sensor';

    // ── Badge de saúde geral ──────────────────────────────
    const score = calcularScoreGeral(cls);
    const elStatus = document.getElementById('dashStatusLabel');
    if (elStatus && score !== null) elStatus.textContent = rotularScore(score);

    // ── Card: Umidade do Solo ────────────────────────────
    const pct = soilPctDash(leituraCompleta?.umid_solo);
    const elUmidValor = document.getElementById('dashUmidSoloValor');
    const elUmidBadge = document.getElementById('dashUmidSoloBadge');
    const elUmidBar   = document.getElementById('dashUmidSoloBar');

    if (elUmidValor) elUmidValor.textContent = pct != null ? pct.toFixed(1) : '—';
    if (elUmidBar)   elUmidBar.style.width   = pct != null ? `${pct}%` : '0%';
    if (elUmidBadge && cls) {
      elUmidBadge.textContent = cls.classificacao_umid_solo;
      elUmidBadge.className   = `badge badge-primary-sm`;
    }

    // ── Card: Temperatura do Ar ──────────────────────────
    const temp = leitura?.temp_ar != null ? Number(leitura.temp_ar) : null;
    const elTempValor = document.getElementById('dashTempValor');
    const elTempBadge = document.getElementById('dashTempBadge');
    const elTempBar   = document.getElementById('dashTempBar');

    if (elTempValor) elTempValor.textContent = temp != null ? temp.toFixed(1) : '—';
    if (elTempBar)   elTempBar.style.width   = temp != null ? `${tempParaPct(temp)}%` : '0%';
    if (elTempBadge && cls) {
      elTempBadge.textContent = cls.classificacao_temp;
      elTempBadge.className   = `badge badge-secondary-sm`;
    }

    // ── Card: Luminosidade ───────────────────────────────
    const luzAdc = leitura?.luz_ambiente != null ? Number(leitura.luz_ambiente) : null;
    const luzPct = luzParaPct(luzAdc);
    const elLuzValor   = document.getElementById('dashLuzValor');
    const elLuzBadge   = document.getElementById('dashLuzBadge');
    const elLuzWarning = document.getElementById('dashLuzWarning');
    const elLuzWarnTxt = document.getElementById('dashLuzWarningText');

    if (elLuzValor) elLuzValor.textContent = luzPct != null ? luzPct : '—';
    if (elLuzBadge && cls) {
      elLuzBadge.textContent = cls.classificacao_luz;
      elLuzBadge.className   = `badge badge-secondary-sm`;
    }
    if (elLuzWarning && cls) {
      const mostrarAviso = cls.nivel_luz === 'atencao';
      elLuzWarning.style.display = mostrarAviso ? 'flex' : 'none';
      if (mostrarAviso && elLuzWarnTxt) {
        elLuzWarnTxt.textContent = luzAdc < 500
          ? 'Luminosidade baixa — verifique sombreamento'
          : 'Radiação intensa — monitore queimaduras foliares';
      }
    }

    // ── Mapa: tooltip e legenda ──────────────────────────
    const elMapTooltip = document.getElementById('mapSensorTooltip');
    const elMapUmid    = document.getElementById('mapLegendUmid');
    const elMapTemp    = document.getElementById('mapLegendTemp');
    const elMapStatus  = document.getElementById('mapLegendStatus');

    if (elMapTooltip) {
      elMapTooltip.textContent = pct != null
        ? `${pct.toFixed(0)}% umidade · ${temp?.toFixed(1)}°C`
        : 'Sem leitura recente';
    }
    if (elMapUmid) elMapUmid.textContent = `Umidade: ${pct != null ? pct.toFixed(1) + '%' : '—'}`;
    if (elMapTemp) elMapTemp.textContent = `Temperatura: ${temp != null ? temp.toFixed(1) + '°C' : '—'}`;
    if (elMapStatus && cls) {
      const rotulo = rotularScore(score);
      elMapStatus.textContent = `Status: ${rotulo}`;
      const dot = document.getElementById('mapLegendStatusDot');
      if (dot) {
        dot.style.background = score >= 70 ? '#4ade80' : score >= 50 ? '#facc15' : '#f87171';
      }
    }

    // ── Insight de IA ────────────────────────────────────
    const elInsight = document.getElementById('aiInsightText');
    if (elInsight) elInsight.textContent = gerarInsight(cls);

  } catch (err) {
    console.error('[Dashboard] Erro inesperado:', err);
  }
}

// ─── Gráfico de Tendências ────────────────────────────────────
let trendsChart = null;

async function carregarGraficoTendencias(filtro = '7d') {
  const startDate = new Date();
  if (filtro === '24h') startDate.setHours(startDate.getHours() - 24);
  else startDate.setDate(startDate.getDate() - 7);

  const { data, error } = await supabaseDash
    .from('leituras_solo')
    .select('created_at, umid_solo')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true })
    .limit(300);

  if (error) { console.error('[Dashboard Trends]', error); return; }

  const leituras = (data || []).map(r => ({
    t: new Date(r.created_at),
    v: soilPctDash(r.umid_solo),
  })).filter(r => r.v != null);

  const labels = leituras.map(r =>
    filtro === '24h'
      ? r.t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : r.t.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  );
  const valores = leituras.map(r => r.v);

  // ── KPIs da tendência ────────────────────────────────
  const elMedia = document.getElementById('trendsMedia');
  const elTend  = document.getElementById('trendsTendencia');

  if (valores.length > 0) {
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    if (elMedia) elMedia.textContent = media.toFixed(1) + '%';

    if (valores.length >= 2) {
      const primeiro = valores.slice(0, Math.ceil(valores.length / 2));
      const ultimo   = valores.slice(Math.floor(valores.length / 2));
      const mediaP   = primeiro.reduce((a, b) => a + b, 0) / primeiro.length;
      const mediaU   = ultimo.reduce((a, b) => a + b, 0) / ultimo.length;
      const diff     = mediaU - mediaP;
      if (elTend) elTend.textContent = diff > 1 ? '↑ Subindo' : diff < -1 ? '↓ Caindo' : '→ Estável';
    }
  } else {
    if (elMedia) elMedia.textContent = '—';
    if (elTend)  elTend.textContent  = '—';
  }

  // ── Chart.js ─────────────────────────────────────────
  const container = document.getElementById('trendsChartContainer');
  if (!container) return;

  // Recria canvas para evitar bug do Chart.js ao atualizar
  container.innerHTML = '<canvas id="trendsCanvas"></canvas>';
  const canvas = document.getElementById('trendsCanvas');

  if (trendsChart) { trendsChart.destroy(); trendsChart = null; }

  trendsChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Umidade Solo',
        data: valores,
        borderColor: '#4ade80',
        backgroundColor: 'rgba(0,45,28,0.6)',
        fill: true,
        tension: 0.42,
        pointRadius: valores.length < 20 ? 3 : 0,
        pointHoverRadius: 5,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          callbacks: { label: ctx => ` ${ctx.parsed.y.toFixed(1)}%` },
        },
      },
      scales: {
        x: { ticks: { color: '#64748b', maxTicksLimit: 6, font: { size: 10 } }, grid: { display: false } },
        y: { min: 0, max: 100, ticks: { color: '#64748b', callback: v => v + '%', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
      },
    },
  });
}

// ─── Carrega Chart.js e inicializa tudo ──────────────────────
async function initDashboard() {
  // Carrega Chart.js se não estiver disponível
  if (!window.Chart) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  await atualizarDashboard();
  await carregarGraficoTendencias('7d');

  // Troca de filtro do gráfico
  const sel = document.getElementById('trendsSelect');
  if (sel) sel.addEventListener('change', e => carregarGraficoTendencias(e.target.value));

  // Botão exportar relatório
  const exportBtn = document.getElementById('exportReportBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportarRelatorio);
}


// ─── Mapa de Calor / Visual / NDVI ───────────────────────────
function initMapToggles() {
  const btns       = document.querySelectorAll('.map-toggle-btn');
  const mapImg     = document.getElementById('fieldMapImage');
  const heatOverlay = document.getElementById('heatmapOverlay');
  const ndviOverlay = document.getElementById('ndviOverlay');
  const ndviLegend  = document.getElementById('ndviLegend');
  const heatLegend  = document.getElementById('heatLegend');

  if (!btns.length || !mapImg) return;

  const modes = {
    'Mapa de Calor': () => {
      mapImg.style.filter       = 'saturate(0.6) brightness(0.85)';
      heatOverlay.style.display = 'block';
      ndviOverlay.style.display = 'none';
      heatLegend.style.display  = 'block';
      ndviLegend.style.display  = 'none';
    },
    'Visual': () => {
      mapImg.style.filter       = 'none';
      heatOverlay.style.display = 'none';
      ndviOverlay.style.display = 'none';
      heatLegend.style.display  = 'none';
      ndviLegend.style.display  = 'none';
    },
    'NDVI': () => {
      mapImg.style.filter       = 'saturate(0.3) brightness(0.75) contrast(1.1)';
      ndviOverlay.style.display = 'block';
      heatOverlay.style.display = 'none';
      ndviLegend.style.display  = 'block';
      heatLegend.style.display  = 'none';
    },
  };

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('map-toggle-btn--active'));
      btn.classList.add('map-toggle-btn--active');
      const mode = btn.textContent.trim();
      if (modes[mode]) modes[mode]();
    });
  });

  // Inicia no modo Mapa de Calor
  modes['Mapa de Calor']();
}

document.addEventListener('DOMContentLoaded', () => { initDashboard(); initMapToggles(); });