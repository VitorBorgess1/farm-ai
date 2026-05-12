/* ============================================================
   FarmAI — script.js
   Interactive behaviors & UI logic
   Shared across all pages + page-specific handlers
   ============================================================ */

// 1. Configuração SupaBase
const supabaseUrl = 'https://bydyipretbicpvbqmuvb.supabase.co';
const supabaseKey = 'sb_publishable_2RPgrQBaMC4utot6oGU-gQ_jVeJ3a9k';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// 2. Função para buscar os dados reais e substituir a tabela estática
async function carregarLeituras() {
    console.log("1. A função carregarLeituras começou a rodar!");

    const tbody = document.getElementById('corpoTabelaLeituras');
    console.log("2. Elemento tbody encontrado:", tbody);

    if (!tbody) {
        console.error("ERRO: O JavaScript não encontrou o id 'corpoTabelaLeituras' no HTML.");
        return;
    }

    try {
        console.log("3. Pedindo os dados ao Supabase...");

        const { data, error } = await supabaseClient
            .from('leituras_solo')
            .select('created_at, sensor_id, umidade_percentual, ph')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error("ERRO do Supabase:", error);
            return;
        }

        console.log("4. Resposta do Supabase chegou! Dados:", data);

        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhuma leitura encontrada no banco.</td></tr>';
            return;
        }

        data.forEach(leitura => {
            const dataFormatada = new Date(leitura.created_at);
            const horaMinutoSegundo = dataFormatada.toLocaleTimeString('pt-BR');

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="mon-td-time">${horaMinutoSegundo}</td>
                <td class="mon-td-id">${leitura.sensor_id ? leitura.sensor_id.substring(0,8) : 'S/N'}</td>
                <td class="mon-td-value">${leitura.umidade_percentual || 0}%</td>
                <td>${leitura.ph || '-'}</td>
                <td><span class="table-badge table-badge--active">Ativo</span></td>
            `;
            tbody.appendChild(tr);
        });

        console.log("5. Mágica feita! Linhas desenhadas na tabela.");

    } catch (err) {
        console.error("ERRO INESPERADO no código:", err);
    }
}

// 3. Buscar dados do solo para IA (última leitura + histórico)
async function buscarDadosSoloParaIA() {
  const { data, error } = await supabaseClient
    .from('leituras_solo')
    .select('created_at, umidade_percentual, ph, nitrogenio, fosforo')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Erro ao buscar dados para IA:', error);
    return [];
  }

  return data;
}

/* ────────────────────────────────────────────────────────────
   LÓGICA DINÂMICA DA PÁGINA IA
   Calcula Saúde do Solo, Última Leitura, Análise de Umidade,
   Análise de pH e Recomendações de Nutrientes com base nos
   dados reais do Supabase.
   ──────────────────────────────────────────────────────────── */

// Pontua um parâmetro com base nos limites ideais
function pontuarParametro(valor, minIdeal, maxIdeal) {
  if (valor === null || valor === undefined) return null;
  const v = parseFloat(valor);
  if (isNaN(v)) return null;

  if (v >= minIdeal && v <= maxIdeal) return 100;

  // Calcula desvio percentual em relação ao extremo mais próximo
  const desvio = v < minIdeal
    ? (minIdeal - v) / minIdeal
    : (v - maxIdeal) / maxIdeal;

  if (desvio <= 0.25) return 70;
  return 40;
}

// Calcula saúde do solo (média das pontuações dos 4 parâmetros)
function calcularSaudeSolo(leitura) {
  const pontos = [
    pontuarParametro(leitura.umidade_percentual, 40, 70),
    pontuarParametro(leitura.ph, 5.5, 7.0),
    pontuarParametro(leitura.nitrogenio, 20, 40),
    pontuarParametro(leitura.fosforo, 10, 20),
  ].filter(p => p !== null);

  if (pontos.length === 0) return null;
  return Math.round(pontos.reduce((a, b) => a + b, 0) / pontos.length);
}

// Retorna classificação textual da saúde
function classificarSaude(saude) {
  if (saude >= 90) return 'Excelente';
  if (saude >= 70) return 'Boa';
  if (saude >= 50) return 'Atenção';
  return 'Crítica';
}

// Formata data/hora em pt-BR
function formatarDataHora(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// Análise de umidade: retorna { prioridade, titulo, desc, badgeClass, iconClass }
function analisarUmidade(valor) {
  const v = parseFloat(valor);

  if (isNaN(v)) {
    return {
      prioridade: 'Sem dados',
      titulo: 'Sem leitura de umidade disponível',
      desc: 'Nenhum dado de umidade encontrado no banco. Verifique a conexão dos sensores.',
      badgeClass: 'badge-secondary',
      iconClass: 'icon-secondary',
    };
  }

  if (v < 40) {
    return {
      prioridade: 'Alta Prioridade',
      titulo: `Umidade abaixo da faixa ideal detectada (${v}%)`,
      desc: 'O solo apresenta umidade abaixo do recomendado. Recomenda-se irrigação nas próximas horas para evitar ressecamento e possível perda de produtividade.',
      badgeClass: 'badge-error',
      iconClass: 'icon-error',
    };
  }

  if (v > 70) {
    return {
      prioridade: 'Atenção',
      titulo: `Umidade elevada detectada no solo (${v}%)`,
      desc: 'A umidade do solo está acima da faixa recomendada. Evitar irrigação temporariamente e monitorar possível encharcamento ou desenvolvimento de fungos.',
      badgeClass: 'badge-tertiary',
      iconClass: 'icon-tertiary',
    };
  }

  return {
    prioridade: 'Normal',
    titulo: `Umidade dentro da faixa recomendada (${v}%)`,
    desc: 'O solo apresenta umidade adequada para a maioria das culturas. Manter monitoramento contínuo das leituras.',
    badgeClass: 'badge-secondary',
    iconClass: 'icon-secondary',
  };
}

// Análise de pH: retorna { prioridade, titulo, desc, badgeClass }
function analisarPH(valor) {
  const v = parseFloat(valor);

  if (isNaN(v)) {
    return {
      prioridade: '—',
      titulo: 'Sem leitura de pH disponível',
      desc: 'Nenhum dado de pH encontrado. Verifique os sensores.',
      badgeClass: 'badge-secondary',
    };
  }

  if (v < 5.5) {
    return {
      prioridade: 'Atenção',
      titulo: `pH ácido detectado (${v})`,
      desc: 'pH abaixo da faixa ideal. O solo apresenta acidez elevada, o que pode reduzir a disponibilidade de nutrientes. Considere calagem após análise agronômica.',
      badgeClass: 'badge-tertiary',
    };
  }

  if (v > 7.0) {
    return {
      prioridade: 'Atenção',
      titulo: `pH alcalino detectado (${v})`,
      desc: 'pH acima da faixa ideal. Monitorar disponibilidade de micronutrientes como ferro e manganês, que podem ser afetados pela alcalinidade.',
      badgeClass: 'badge-tertiary',
    };
  }

  return {
    prioridade: 'Ideal',
    titulo: `Nível de pH dentro da faixa recomendada (${v})`,
    desc: 'O solo está equilibrado. Nenhuma correção de pH necessária no momento.',
    badgeClass: 'badge-secondary',
  };
}

// Análise de nutriente: retorna { titulo, desc, badge, badgeClass }
function analisarNutriente(nome, valor, minIdeal, maxIdeal, unidade) {
  const v = parseFloat(valor);

  if (isNaN(v)) {
    return {
      titulo: `Sem leitura de ${nome}`,
      desc: 'Dado não disponível na última leitura.',
      badge: '—',
      badgeClass: 'badge-secondary',
      dotClass: 'dot-secondary',
    };
  }

  if (v < minIdeal) {
    return {
      titulo: `${nome} abaixo do ideal (${v}${unidade})`,
      desc: `Nível de ${nome.toLowerCase()} está baixo. Recomenda-se avaliar aplicação de corretivo com orientação agronômica.`,
      badge: 'Prioridade Média',
      badgeClass: 'badge-tertiary',
      dotClass: 'dot-tertiary',
    };
  }

  if (v > maxIdeal) {
    return {
      titulo: `${nome} acima do ideal (${v}${unidade})`,
      desc: `Nível de ${nome.toLowerCase()} elevado. Evitar aplicação adicional e monitorar absorção pela cultura.`,
      badge: 'Prioridade Baixa',
      badgeClass: 'badge-secondary',
      dotClass: 'dot-secondary',
    };
  }

  return {
    titulo: `${nome} dentro da faixa ideal (${v}${unidade})`,
    desc: `Nível de ${nome.toLowerCase()} adequado. Manter cronograma de monitoramento.`,
    badge: 'Prioridade Baixa',
    badgeClass: 'badge-secondary',
    dotClass: 'dot-secondary',
  };
}

// Atualiza todos os elementos dinâmicos da página ia.html
async function atualizarPaginaIA() {
  const dados = await buscarDadosSoloParaIA();
  const leitura = dados && dados.length > 0 ? dados[0] : null;

  /* ── Hero: Saúde do Solo ──────────────────────────── */
  const elSaude = document.getElementById('heroSaudeSolo');
  if (elSaude) {
    if (leitura) {
      const saude = calcularSaudeSolo(leitura);
      if (saude !== null) {
        elSaude.textContent = `${saude}% — ${classificarSaude(saude)}`;
      } else {
        elSaude.textContent = 'Sem dados';
      }
    } else {
      elSaude.textContent = 'Sem dados';
    }
  }

  /* ── Hero: Última Leitura ─────────────────────────── */
  const elUltimaLeitura = document.getElementById('heroUltimaLeitura');
  if (elUltimaLeitura) {
    elUltimaLeitura.textContent = leitura
      ? formatarDataHora(leitura.created_at)
      : 'Sem leituras';
  }

  /* ── Card Umidade ─────────────────────────────────── */
  const analiseUmidade = analisarUmidade(leitura?.umidade_percentual);
  const elUmidadeBadge  = document.getElementById('umidadeBadge');
  const elUmidadeTitulo = document.getElementById('umidadeTitulo');
  const elUmidadeDesc   = document.getElementById('umidadeDesc');
  const elUmidadeIcon   = document.getElementById('umidadeIconBox');

  if (elUmidadeBadge)  {
    elUmidadeBadge.textContent = analiseUmidade.prioridade;
    elUmidadeBadge.className = `badge ${analiseUmidade.badgeClass}`;
  }
  if (elUmidadeTitulo) elUmidadeTitulo.textContent = analiseUmidade.titulo;
  if (elUmidadeDesc)   elUmidadeDesc.textContent   = analiseUmidade.desc;
  if (elUmidadeIcon)   elUmidadeIcon.className = `icon-box ${analiseUmidade.iconClass}`;

  /* ── Card pH ──────────────────────────────────────── */
  const analisePH = analisarPH(leitura?.ph);
  const elPhBadge  = document.getElementById('phBadge');
  const elPhTitulo = document.getElementById('phTitulo');
  const elPhDesc   = document.getElementById('phDesc');

  if (elPhBadge)  {
    elPhBadge.textContent = analisePH.prioridade;
    elPhBadge.className = `badge ${analisePH.badgeClass}`;
  }
  if (elPhTitulo) elPhTitulo.textContent = analisePH.titulo;
  if (elPhDesc)   elPhDesc.textContent   = analisePH.desc;

  /* ── Card Nitrogênio ──────────────────────────────── */
  const analiseN = analisarNutriente('Nitrogênio', leitura?.nitrogenio, 20, 40, ' mg/kg');
  const elNTitulo = document.getElementById('recNitrogenioTitulo');
  const elNDesc   = document.getElementById('recNitrogenioDesc');
  const elNBadge  = document.getElementById('recNitrogenioBadge');
  const elDotN    = document.getElementById('dotNitrogenio');

  if (elNTitulo) elNTitulo.textContent = analiseN.titulo;
  if (elNDesc)   elNDesc.textContent   = analiseN.desc;
  if (elNBadge)  {
    elNBadge.textContent = analiseN.badge;
    elNBadge.className = `badge ${analiseN.badgeClass}`;
  }
  if (elDotN) elDotN.className = `dot ${analiseN.dotClass}`;

  /* ── Card Fósforo ─────────────────────────────────── */
  const analiseF = analisarNutriente('Fósforo', leitura?.fosforo, 10, 20, ' mg/kg');
  const elFTitulo = document.getElementById('recFosforoTitulo');
  const elFDesc   = document.getElementById('recFosforoDesc');
  const elFBadge  = document.getElementById('recFosforoBadge');
  const elDotF    = document.getElementById('dotFosforo');

  if (elFTitulo) elFTitulo.textContent = analiseF.titulo;
  if (elFDesc)   elFDesc.textContent   = analiseF.desc;
  if (elFBadge)  {
    elFBadge.textContent = analiseF.badge;
    elFBadge.className = `badge ${analiseF.badgeClass}`;
  }
  if (elDotF) elDotF.className = `dot ${analiseF.dotClass}`;

  /* ── Card Ações da Semana: timestamp ─────────────── */
  const elAcoesTs = document.getElementById('acoesSemanaAtualizadoEm');
  if (elAcoesTs) {
    elAcoesTs.textContent = leitura
      ? `Atualizado em ${formatarDataHora(leitura.created_at)}`
      : 'Sem dados disponíveis';
  }

  /* ── Card Qualidade dos Dados ─────────────────────── */
  const elQualDesc = document.getElementById('qualidadeDadosDesc');
  const elQualMeta = document.getElementById('qualidadeDadosMeta');
  if (leitura && elQualDesc && elQualMeta) {
    const totalCampos = ['umidade_percentual', 'ph', 'nitrogenio', 'fosforo']
      .filter(k => leitura[k] !== null && leitura[k] !== undefined).length;
    const pct = Math.round((totalCampos / 4) * 100);
    elQualDesc.textContent = `${totalCampos} de 4 parâmetros presentes na última leitura dos sensores. Integridade dos dados: ${pct}%.`;
    elQualMeta.textContent = `${pct}% dos campos preenchidos`;
  } else if (elQualDesc) {
    elQualDesc.textContent = 'Nenhuma leitura encontrada no banco de dados.';
    if (elQualMeta) elQualMeta.textContent = 'Sem dados';
  }
}


document.addEventListener('DOMContentLoaded', () => {
    carregarLeituras();

    // Executa atualização dinâmica apenas na página ia.html
    if (document.getElementById('heroSaudeSolo')) {
      atualizarPaginaIA();
    }
});

  /* ── Detect current page ─────────────────────────────────── */
  const currentFile = window.location.pathname.split('/').pop() || 'index.html';

  /* ── Nav link active state ───────────────────────────────── */
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    const href = link.getAttribute('href') || '';

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

      applyFilter('.bento-grid .card');
      applyFilter('.stat-card-box, .trends-card, .field-map-card');
      applyFilter('.mon-table tbody tr');
      applyFilter('.mon-chart-card, .mon-metric-card');
      applyFilter('.alr-card');
      applyFilter('.alr-resolved-item');
      applyFilter('.alr-sector-item');
    });
  }

  /* ──────────────────────────────────────────────────────────
     AI INSIGHTS PAGE  (ia.html) specific behaviors
     — Removidos: acknowledgeBtn / badge "Resolvido" / ações falsas
     ────────────────────────────────────────────────────────── */

  /* Recommendation arrow buttons — apenas navegação */
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
    });
  }

  /* ──────────────────────────────────────────────────────────
     MONITORING PAGE  (monitoring.html) specific behaviors
     ────────────────────────────────────────────────────────── */

  const filterBtns = document.querySelectorAll('.filter-btn[data-filter]');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('filter-btn--active'));
      btn.classList.add('filter-btn--active');
      console.log(`[FarmAI] Time filter: "${btn.dataset.filter}"`);
    });
  });

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

  const executeIrrigationPlan = document.getElementById('executeIrrigationPlan');
  if (executeIrrigationPlan) {
    executeIrrigationPlan.addEventListener('click', () => {
      executeIrrigationPlan.textContent = '✓ Plano Iniciado às 18:00';
      executeIrrigationPlan.style.background = 'var(--secondary-fixed)';
      executeIrrigationPlan.style.color = 'var(--on-secondary-fixed)';
      executeIrrigationPlan.disabled = true;
    });
  }

  const addSensorBtn = document.querySelector('.mon-compare-add');
  if (addSensorBtn) {
    addSensorBtn.addEventListener('click', () => {
      console.log('[FarmAI] Open sensor picker modal');
    });
  }

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

  const dispatchTechBtn = document.getElementById('dispatchTechBtn');
  if (dispatchTechBtn) {
    dispatchTechBtn.addEventListener('click', () => {
      const orig = dispatchTechBtn.textContent;
      dispatchTechBtn.textContent = '✓ Técnico Acionado';
      dispatchTechBtn.disabled = true;
      setTimeout(() => { dispatchTechBtn.textContent = orig; dispatchTechBtn.disabled = false; }, 4000);
    });
  }

  const exportLogsBtn = document.getElementById('exportLogsBtn');
  if (exportLogsBtn) {
    exportLogsBtn.addEventListener('click', () => {
      const orig = exportLogsBtn.innerHTML;
      exportLogsBtn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Registros Exportados!';
      exportLogsBtn.disabled = true;
      setTimeout(() => { exportLogsBtn.innerHTML = orig; exportLogsBtn.disabled = false; }, 3000);
    });
  }

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

  const deviceSearchInput = document.getElementById('deviceSearchInput');
  if (deviceSearchInput) {
    deviceSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      devCards.forEach(card => {
        card.style.transition = 'opacity 0.25s';
        card.style.opacity = (!query || card.textContent.toLowerCase().includes(query)) ? '1' : '0.25';
      });
      document.querySelectorAll('.dev-log-row').forEach(row => {
        row.style.transition = 'opacity 0.25s';
        row.style.opacity = (!query || row.textContent.toLowerCase().includes(query)) ? '1' : '0.25';
      });
    });
  }

  const addDeviceBtn = document.getElementById('addDeviceBtn');
  if (addDeviceBtn) {
    addDeviceBtn.addEventListener('click', () => {
      console.log('[FarmAI] Open add device modal');
    });
  }

  const viewFullHistoryBtn = document.getElementById('viewFullHistoryBtn');
  if (viewFullHistoryBtn) {
    viewFullHistoryBtn.addEventListener('click', () => {
      console.log('[FarmAI] Navigate to full connection log');
    });
  }

  document.querySelectorAll('.dev-card-more').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.dev-card');
      const name = card?.querySelector('.dev-card-name')?.textContent || 'device';
      console.log(`[FarmAI] Open context menu for: "${name}"`);
    });
  });

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

  if (chatOverlay && triggerInput) {

  const conversationHistory = [];

  const SYSTEM_PROMPT = `You are an expert agronomist assistant for FarmAI, a precision agriculture platform.
You help farmers analyze soil sensor data and make practical crop management decisions.

== LANGUAGE ==
Always respond in Brazilian Portuguese (pt-BR), regardless of the language of these instructions.

== ROLE ==
You are a decision-support assistant. You analyze data, interpret sensor readings, and recommend actions.
You do NOT control devices, activate irrigation, apply fertilizers, or execute any physical action.
Always make clear that recommendations must be validated by a qualified agronomist before implementation.

== SENSOR DATA ==
Before every user message, you receive real sensor readings injected in the context.
- You ALWAYS have access to this data. Never say you do not.
- Use the actual values. Never invent or change numbers.
- Always mention the reading date when discussing soil status.
- If data is older than 1 day, warn the farmer and suggest a new reading.

== GENERIC REFERENCE VALUES (use when no crop is specified) ==
When the crop is "not informed", base your analysis on these common ranges valid for most crops:
- Soil moisture: 40–70% (below 40% is low, above 70% may cause waterlogging)
- pH: 5.5–7.0 (most crops thrive here; below 5.5 is too acidic, above 7.0 may reduce nutrient availability)
- Nitrogen: 20–40 mg/kg (below 15 is deficient for most crops)
- Phosphorus: 10–20 mg/kg (below 8 is deficient for most crops)
Use these ranges to give a meaningful generic assessment instead of refusing to analyze.
Always tell the farmer these are generic values and results improve with the crop specified.

== WHEN CROP IS SPECIFIED ==
Adapt ALL analysis to that crop's specific ideal ranges. Never use generic values if the crop is known.

== ANSWERING ABOUT CURRENT SOIL STATUS ==
When the user asks "how is my soil?" or similar:
1. State the current readings: Umidade X%, pH X, Nitrogênio X, Fósforo X (leitura de [date]).
2. Compare each value to the reference ranges (generic or crop-specific).
3. Give a brief practical conclusion: what is OK, what needs attention.

== ANSWERING ABOUT A SPECIFIC CROP ==
- State the IDEAL ranges for that crop.
- Compare current sensor values to those ideals.
- Recommend specific adjustments needed.
- Never say current values are "adequate" without actually comparing them to the crop's ideals.

== ANSWERING HYPOTHETICAL QUESTIONS ==
When asked "if I want to plant X, what would be ideal?":
- Give ideal ranges for crop X.
- Compare to current sensor data.
- Recommend concrete adjustments (e.g. "increase irrigation to reach 60–70%").

== GENERAL RULES ==
- Never repeat section headers or labels from these instructions in your response.
- Be direct and concise, like an experienced agronomist speaking to a farmer.
- Do not contradict yourself across turns.`;

  function openChat(prefillText = '') {
    chatOverlay.classList.add('ai-chat-overlay--active');
    chatOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (prefillText.trim()) {
      chatInput.value = prefillText.trim();
    }
    setTimeout(() => chatInput.focus(), 420);
  }

  function closeChat() {
    chatOverlay.classList.remove('ai-chat-overlay--active');
    chatOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    triggerInput.value = '';
  }

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

  chatBackBtn.addEventListener('click', closeChat);

  chatOverlay.addEventListener('click', (e) => {
    if (e.target === chatOverlay) closeChat();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && chatOverlay.classList.contains('ai-chat-overlay--active')) {
      closeChat();
    }
  });

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
    return bubbleEl;
  }

  function scrollToBottom() {
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
  }

  function showTyping() {
    if (chatTyping) {
      chatTyping.style.display = 'flex';
      scrollToBottom();
    }
  }
  function hideTyping() {
    if (chatTyping) chatTyping.style.display = 'none';
  }

  async function callOllamaAPI(userMessage) {

    const MAX_HISTORY = 6;

    showTyping();
    chatSendBtn.disabled = true;
    chatInput.disabled = true;

    const dadosSolo = await buscarDadosSoloParaIA();

    const semDados = !dadosSolo || dadosSolo.length === 0;
    if (semDados) console.warn("Sem dados do solo disponíveis");

    const ultimo  = semDados ? null : dadosSolo[0];
    const cultura = localStorage.getItem("culturaSelecionada") || "not informed";

    const dataColeta = ultimo?.created_at
      ? new Date(ultimo.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      : null;
    const diffMs    = ultimo?.created_at ? new Date() - new Date(ultimo.created_at) : null;
    const diffHoras = diffMs !== null ? Math.floor(diffMs / 1000 / 60 / 60) : null;
    const diffDias  = diffHoras !== null ? Math.floor(diffHoras / 24) : null;

    let contextoSolo = '';
    if (semDados) {
      contextoSolo = `[SENSOR DATA]: No sensor readings available.
[CROP]: ${cultura}
Use general agronomic best practices. Make clear the answer is generic due to missing sensor data.`;
    } else {
      let staleness = '';
      if (diffDias !== null && diffDias >= 2) {
        staleness = ` WARNING: data is ${diffDias} day(s) old — warn the farmer and suggest a new reading.`;
      } else if (diffHoras !== null && diffHoras >= 6) {
        staleness = ` Note: data is ${diffHoras} hour(s) old — minor variations may exist.`;
      }
      contextoSolo = `[SENSOR DATA — collected ${dataColeta}]:${staleness}
- Soil moisture: ${ultimo?.umidade_percentual ?? 'N/A'}%
- pH: ${ultimo?.ph ?? 'N/A'}
- Nitrogen: ${ultimo?.nitrogenio ?? 'N/A'}
- Phosphorus: ${ultimo?.fosforo ?? 'N/A'}
[CROP]: ${cultura}`;
    }

    const systemContext = SYSTEM_PROMPT + "\n\n" + contextoSolo;

    const messages = [
      {
        role: 'user',
        content: systemContext + "\n\nAcknowledge you have the sensor data and are ready."
      },
      {
        role: 'assistant',
        content: semDados
          ? "Understood. No sensor data available. I'll answer based on general agronomic best practices."
          : `Understood. I have the sensor readings from ${dataColeta}: moisture ${ultimo?.umidade_percentual}%, pH ${ultimo?.ph}, nitrogen ${ultimo?.nitrogenio}, phosphorus ${ultimo?.fosforo}. Crop: ${cultura}. Ready to analyze.`
      },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    console.log('[FarmAI] context sent:', contextoSolo);
    console.log('[FarmAI] question:', userMessage);

    try {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3.2',
          messages: messages,
          stream: false,
          options: {
            temperature: 0.4,
            top_p: 0.9,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const data = await response.json();
      const assistantText = data.message?.content || 'Sem resposta do modelo.';

      console.log('[FarmAI] response:', assistantText);
      hideTyping();
      appendMessage(assistantText, 'assistant');

      conversationHistory.push({ role: 'user',      content: userMessage });
      conversationHistory.push({ role: 'assistant', content: assistantText });

      while (conversationHistory.length > MAX_HISTORY) {
        conversationHistory.shift();
      }

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

  async function handleSend() {
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';
    appendMessage(text, 'user');
    await callOllamaAPI(text);
  }

  chatSendBtn.addEventListener('click', handleSend);

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  } // end if (chatOverlay && triggerInput)