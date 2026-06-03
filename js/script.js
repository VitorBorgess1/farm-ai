/* ============================================================
   FarmAI — script.js
   Comportamentos interativos e lógica de UI
   Compartilhado entre todas as páginas + handlers específicos
   ============================================================ */

// 1. Configuração do Supabase
const supabaseUrl = 'https://bydyipretbicpvbqmuvb.supabase.co';
const supabaseKey = 'sb_publishable_2RPgrQBaMC4utot6oGU-gQ_jVeJ3a9k';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// 2. Busca as leituras mais recentes para preencher a tabela na página de monitoramento
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
            .select('created_at, sensor_id, temp_ar, umid_ar, umid_solo, luz_ambiente')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error("ERRO do Supabase:", error);
            return;
        }

        console.log("4. Resposta do Supabase chegou! Dados:", data);

        tbody.innerHTML = '';

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhuma leitura encontrada no banco.</td></tr>';
            return;
        }

        data.forEach(leitura => {
            const dataFormatada = new Date(leitura.created_at);
            const horaMinutoSegundo = dataFormatada.toLocaleTimeString('pt-BR');

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="mon-td-time">${horaMinutoSegundo}</td>
                <td class="mon-td-id">${leitura.sensor_id ? leitura.sensor_id.toString().substring(0, 8) : 'S/N'}</td>
                <td class="mon-td-value">${leitura.temp_ar ?? '—'}°C</td>
                <td>${leitura.umid_ar ?? '—'}%</td>
                <td>${leitura.umid_solo ?? '—'}</td>
                <td><span class="table-badge table-badge--active">Ativo</span></td>
            `;
            tbody.appendChild(tr);
        });

        console.log("5. Mágica feita! Linhas desenhadas na tabela.");

    } catch (err) {
        console.error("ERRO INESPERADO no código:", err);
    }
}

// 3. Busca os dados reais dos sensores para alimentar a página de IA
async function buscarDadosSoloParaIA() {
    const { data, error } = await supabaseClient
        .from('leituras_solo')
        .select('created_at, temp_ar, umid_ar, umid_solo, luz_ambiente')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Erro ao buscar dados para IA:', error);
        return [];
    }

    return data;
}

/* ════════════════════════════════════════════════════════════
   CLASSIFICADORES DE SENSORES
   Toda interpretação dos valores brutos acontece aqui.
   A IA e a UI recebem apenas classificações prontas — nunca
   tentam inferir o significado dos números por conta própria.

   Tabela de referência:
   ┌─────────────────┬──────────────┬─────────────────────────────┐
   │ Parâmetro       │ Coluna       │ Faixas                      │
   ├─────────────────┼──────────────┼─────────────────────────────┤
   │ Temperatura ar  │ temp_ar      │ < 10 | 10–15 | 15–35 | >35 │
   │ Umidade do ar   │ umid_ar      │ < 30 | 30–40 | 40–85 | >85 │
   │ Umidade solo    │ umid_solo    │ ADC: <1000 | 1000–1800 |    │
   │  (capacitivo)   │              │   1800–3000 | 3000–3500 |   │
   │  alto = seco    │              │   >3500                     │
   │ Luz ambiente    │ luz_ambiente │ ADC: <500 | 500–3000 | >3000│
   └─────────────────┴──────────────┴─────────────────────────────┘

   Pontuação para o score geral (ponderado):
     Ideal   = 100 pts  |  Atenção = 70 pts  |  Crítico = 40 pts
   Pesos: umid_solo 40% | temp_ar 25% | umid_ar 20% | luz 15%
   ════════════════════════════════════════════════════════════ */

// Formata uma string ISO em data/hora pt-BR legível
function formatarDataHora(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

/* ── Classificação da umidade do solo (valor já em %) ─────────
   Valores convertidos de ADC para percentual real no banco.
   4095 (sensor no ar) é filtrado antes de chegar aqui.
   Faixas:
     < 15%    → Muito seco  (crítico)
     15–25%   → Seco        (atenção)
     25–70%   → Ideal       ✓
     70–85%   → Úmido       (atenção)
     > 85%    → Encharcado  (crítico)
   ──────────────────────────────────────────────────────────── */
function classificarUmidadeSolo(valor) {
    const v = parseFloat(valor);
    if (isNaN(v) || v >= 4095) return { label: 'Sem dados',  nivel: 'sem_dados', pontos: null };
    if (v < 15)  return { label: 'Muito seco',  nivel: 'critico',   pontos: 40  };
    if (v < 25)  return { label: 'Seco',        nivel: 'atencao',   pontos: 70  };
    if (v <= 70) return { label: 'Ideal',       nivel: 'ideal',     pontos: 100 };
    if (v <= 85) return { label: 'Úmido',       nivel: 'atencao',   pontos: 70  };
    return             { label: 'Encharcado',   nivel: 'critico',   pontos: 40  };
}

/* ── Classificação da temperatura do ar (°C) ──────────────────
   Faixas:
     < 10°C    → Muito fria  (crítico)
     10–15°C   → Fria        (atenção)
     15–35°C   → Ideal       ✓
     35–38°C   → Elevada     (atenção)
     > 38°C    → Muito alta  (crítico)
   ──────────────────────────────────────────────────────────── */
function classificarTemperaturaAr(valor) {
    const v = parseFloat(valor);
    if (isNaN(v))  return { label: 'Sem dados',    nivel: 'sem_dados', pontos: null  };
    if (v < 10)    return { label: 'Muito fria',   nivel: 'critico',   pontos: 40    };
    if (v < 15)    return { label: 'Fria',         nivel: 'atencao',   pontos: 70    };
    if (v <= 35)   return { label: 'Ideal',        nivel: 'ideal',     pontos: 100   };
    if (v <= 38)   return { label: 'Elevada',      nivel: 'atencao',   pontos: 70    };
    return               { label: 'Muito alta',    nivel: 'critico',   pontos: 40    };
}

/* ── Classificação da umidade do ar (%) ───────────────────────
   Faixas:
     < 30%    → Muito seca   (crítico)
     30–40%   → Seca         (atenção)
     40–85%   → Ideal        ✓
     > 85%    → Muito úmida  (atenção)
   ──────────────────────────────────────────────────────────── */
function classificarUmidadeAr(valor) {
    const v = parseFloat(valor);
    if (isNaN(v))  return { label: 'Sem dados',    nivel: 'sem_dados', pontos: null  };
    if (v < 30)    return { label: 'Muito seca',   nivel: 'critico',   pontos: 40    };
    if (v < 40)    return { label: 'Seca',         nivel: 'atencao',   pontos: 70    };
    if (v <= 85)   return { label: 'Ideal',        nivel: 'ideal',     pontos: 100   };
    return               { label: 'Muito úmida',   nivel: 'atencao',   pontos: 70    };
}

/* ── Classificação da luminosidade (ADC bruto) ────────────────
   Faixas:
     < 500      → Baixa        (atenção)
     500–3000   → Adequada     ✓
     > 3000     → Intensa      (atenção)
   ──────────────────────────────────────────────────────────── */
function classificarLuzAmbiente(valor) {
    const v = parseFloat(valor);
    if (isNaN(v))   return { label: 'Sem dados',   nivel: 'sem_dados', pontos: null  };
    if (v < 500)    return { label: 'Baixa',       nivel: 'atencao',   pontos: 70    };
    if (v <= 3000)  return { label: 'Adequada',    nivel: 'ideal',     pontos: 100   };
    return                { label: 'Intensa',      nivel: 'atencao',   pontos: 70    };
}

/* ── Monta o objeto completo de classificações de uma leitura ──
   Este objeto é a única fonte de verdade: UI e IA o consomem.
   Nunca interpretam os valores brutos diretamente.
   ──────────────────────────────────────────────────────────── */
function classificarLeitura(leitura) {
    if (!leitura) return null;

    const solo  = classificarUmidadeSolo(leitura.umid_solo);
    const temp  = classificarTemperaturaAr(leitura.temp_ar);
    const umidAr = classificarUmidadeAr(leitura.umid_ar);
    const luz   = classificarLuzAmbiente(leitura.luz_ambiente);

    return {
        temp_ar:               leitura.temp_ar,
        classificacao_temp:    temp.label,
        nivel_temp:            temp.nivel,

        umid_ar:               leitura.umid_ar,
        classificacao_umid_ar: umidAr.label,
        nivel_umid_ar:         umidAr.nivel,

        umid_solo:             leitura.umid_solo,
        classificacao_umid_solo: solo.label,
        nivel_umid_solo:       solo.nivel,

        luz_ambiente:          leitura.luz_ambiente,
        classificacao_luz:     luz.label,
        nivel_luz:             luz.nivel,

        // Pontuações individuais para o score geral
        _pontos: { solo: solo.pontos, temp: temp.pontos, umidAr: umidAr.pontos, luz: luz.pontos },
    };
}

/* ── Score geral ponderado ────────────────────────────────────
   Pesos: umid_solo 40% | temp_ar 25% | umid_ar 20% | luz 15%
   Resultado: ≥90 Excelente | ≥70 Boa | ≥50 Atenção | <50 Crítica
   ──────────────────────────────────────────────────────────── */
function calcularScoreGeral(cls) {
    if (!cls) return null;
    const { solo, temp, umidAr, luz } = cls._pontos;

    // Calcula apenas com os parâmetros que têm leitura disponível
    let soma = 0, pesoTotal = 0;
    const pesos = [
        { valor: solo,  peso: 0.40 },
        { valor: temp,  peso: 0.25 },
        { valor: umidAr, peso: 0.20 },
        { valor: luz,   peso: 0.15 },
    ];
    pesos.forEach(({ valor, peso }) => {
        if (valor !== null) { soma += valor * peso; pesoTotal += peso; }
    });

    if (pesoTotal === 0) return null;
    return Math.round(soma / pesoTotal);
}

// Converte pontuação numérica em rótulo de classificação final
function rotularScore(score) {
    if (score >= 90) return 'Excelente';
    if (score >= 70) return 'Boa';
    if (score >= 50) return 'Atenção';
    return 'Crítica';
}

/* ── Helpers de UI: converte nível semântico em classes CSS ────
   nivel: 'ideal' | 'atencao' | 'critico' | 'sem_dados'
   ──────────────────────────────────────────────────────────── */
function nivelParaBadgeClass(nivel) {
    if (nivel === 'ideal')    return 'badge-secondary';
    if (nivel === 'atencao')  return 'badge-tertiary';
    if (nivel === 'critico')  return 'badge-error';
    return 'badge-secondary';
}
function nivelParaIconClass(nivel) {
    if (nivel === 'ideal')    return 'icon-secondary';
    if (nivel === 'atencao')  return 'icon-tertiary';
    if (nivel === 'critico')  return 'icon-error';
    return 'icon-secondary';
}
function nivelParaDotClass(nivel) {
    if (nivel === 'ideal')    return 'dot-secondary';
    if (nivel === 'atencao')  return 'dot-tertiary';
    if (nivel === 'critico')  return 'dot-error';
    return 'dot-secondary';
}

/* ── Textos descritivos para a UI (gerados a partir da classificação) ──
   Recebem o objeto classificado — nunca os valores brutos.
   ──────────────────────────────────────────────────────────── */
function textoUmidadeSolo(cls) {
    const v = parseFloat(cls.umid_solo);
    switch (cls.nivel_umid_solo) {
        case 'critico':
            if (v > 85) return {
                prioridade: 'Alta Prioridade',
                titulo: `Solo encharcado detectado (${v.toFixed(1)}%)`,
                desc: 'Excesso de água no solo. Suspenda a irrigação imediatamente e avalie a drenagem. Risco elevado de apodrecimento radicular e proliferação de fungos.',
            };
            return {
                prioridade: 'Alta Prioridade',
                titulo: `Solo muito seco detectado (${v.toFixed(1)}%)`,
                desc: 'Umidade do solo criticamente baixa. Recomenda-se irrigação nas próximas horas para evitar estresse hídrico severo e queda de produtividade.',
            };
        case 'atencao':
            if (v > 70) return {
                prioridade: 'Atenção',
                titulo: `Solo úmido, acima da faixa ideal (${v.toFixed(1)}%)`,
                desc: 'Solo com umidade levemente elevada. Monitore a drenagem e evite nova irrigação até retornar à faixa ideal (25–70%).',
            };
            return {
                prioridade: 'Atenção',
                titulo: `Solo seco, abaixo da faixa ideal (${v.toFixed(1)}%)`,
                desc: 'Umidade levemente abaixo do recomendado. Considere irrigação moderada e acompanhe a evolução nas próximas horas.',
            };
        case 'ideal':
            return {
                prioridade: 'Normal',
                titulo: `Umidade do solo na faixa ideal (${v.toFixed(1)}%)`,
                desc: 'Solo com umidade adequada para a maioria das culturas. Manter monitoramento contínuo.',
            };
        default:
            return {
                prioridade: 'Sem dados',
                titulo: 'Sem leitura de umidade do solo',
                desc: 'Nenhum dado disponível. Verifique a conexão do sensor.',
            };
    }
}

function textoTemperaturaAr(cls) {
    const v = cls.temp_ar;
    switch (cls.nivel_temp) {
        case 'critico':
            if (v < 10) return {
                prioridade: 'Alta Prioridade',
                titulo: `Temperatura muito baixa (${v}°C)`,
                desc: 'Frio intenso pode causar estresse fisiológico e danos celulares. Considere proteção para culturas sensíveis ao frio.',
            };
            return {
                prioridade: 'Alta Prioridade',
                titulo: `Temperatura muito elevada (${v}°C)`,
                desc: 'Calor intenso pode causar desidratação foliar e queda de produtividade. Temperaturas elevadas aumentam a evaporação da água do solo — aumente a frequência de irrigação.',
            };
        case 'atencao':
            if (v < 15) return {
                prioridade: 'Atenção',
                titulo: `Temperatura fria (${v}°C)`,
                desc: 'Temperatura abaixo da faixa ideal. Monitore culturas mais sensíveis e considere proteção noturna se a tendência continuar.',
            };
            return {
                prioridade: 'Atenção',
                titulo: `Temperatura elevada (${v}°C)`,
                desc: 'Temperatura acima da faixa ideal. Monitore sinais de estresse hídrico e ajuste a irrigação se necessário.',
            };
        case 'ideal':
            return {
                prioridade: 'Ideal',
                titulo: `Temperatura do ar adequada (${v}°C)`,
                desc: 'Temperatura dentro da faixa favorável para a maioria das culturas. Nenhuma ação imediata necessária.',
            };
        default:
            return {
                prioridade: '—',
                titulo: 'Sem leitura de temperatura do ar',
                desc: 'Nenhum dado disponível. Verifique o sensor.',
            };
    }
}

function textoUmidadeAr(cls) {
    switch (cls.nivel_umid_ar) {
        case 'critico':
            return {
                badge: 'Prioridade Alta',
                titulo: `Umidade do ar muito baixa (${cls.umid_ar}%)`,
                desc: 'Ar muito seco acelera a evapotranspiração e o ressecamento foliar. Aumente a frequência de irrigação para compensar a perda de umidade.',
            };
        case 'atencao':
            if (cls.umid_ar < 40) return {
                badge: 'Prioridade Média',
                titulo: `Umidade do ar baixa (${cls.umid_ar}%)`,
                desc: 'Umidade abaixo do ideal. Monitore sinais de estresse hídrico nas plantas e considere irrigação por aspersão leve.',
            };
            return {
                badge: 'Prioridade Média',
                titulo: `Umidade do ar muito elevada (${cls.umid_ar}%)`,
                desc: 'Alta umidade favorece o desenvolvimento de fungos e doenças foliares. Melhore a ventilação e monitore sinais de míldio ou ferrugem.',
            };
        case 'ideal':
            return {
                badge: 'Normal',
                titulo: `Umidade do ar adequada (${cls.umid_ar}%)`,
                desc: 'Umidade do ar dentro da faixa recomendada. Condições favoráveis para a maioria das culturas.',
            };
        default:
            return {
                badge: '—',
                titulo: 'Sem leitura de umidade do ar',
                desc: 'Dado não disponível na última leitura.',
            };
    }
}

function textoLuzAmbiente(cls) {
    switch (cls.nivel_luz) {
        case 'atencao':
            if (cls.luz_ambiente < 500) return {
                badge: 'Atenção',
                titulo: `Luminosidade baixa (ADC: ${cls.luz_ambiente})`,
                desc: 'Pouca luz detectada. Se for período diurno, verifique possível sombreamento excessivo que pode reduzir a fotossíntese e o crescimento da cultura.',
            };
            return {
                badge: 'Atenção',
                titulo: `Luminosidade intensa (ADC: ${cls.luz_ambiente})`,
                desc: 'Radiação solar elevada. Em conjunto com altas temperaturas, pode causar queimaduras foliares. Monitore culturas mais sensíveis.',
            };
        case 'ideal':
            return {
                badge: 'Normal',
                titulo: `Luminosidade adequada (ADC: ${cls.luz_ambiente})`,
                desc: 'Nível de luz ambiente favorável para o desenvolvimento das culturas. Sem ação necessária.',
            };
        default:
            return {
                badge: '—',
                titulo: 'Sem leitura de luminosidade',
                desc: 'Dado não disponível na última leitura.',
            };
    }
}

// Atualiza todos os elementos dinâmicos da página ia.html com base nas classificações
async function atualizarPaginaIA() {
    const dados = await buscarDadosSoloParaIA();
    const leitura = dados && dados.length > 0 ? dados[0] : null;

    // Gera o objeto de classificações — fonte única de verdade para UI e IA
    const cls = classificarLeitura(leitura);

    /* ── Hero: Score Geral ────────────────────────────── */
    const elCondicao = document.getElementById('heroCondicaoGeral');
    if (elCondicao) {
        const score = calcularScoreGeral(cls);
        elCondicao.textContent = score !== null
            ? `${score}% — ${rotularScore(score)}`
            : 'Sem dados';
    }

    /* ── Hero: Última Leitura ─────────────────────────── */
    const elUltimaLeitura = document.getElementById('heroUltimaLeitura');
    if (elUltimaLeitura) {
        elUltimaLeitura.textContent = leitura
            ? formatarDataHora(leitura.created_at)
            : 'Sem leituras';
    }

    /* ── Card Umidade do Solo ─────────────────────────── */
    const tSolo = cls ? textoUmidadeSolo(cls) : { prioridade: 'Sem dados', titulo: 'Sem leitura', desc: 'Verifique os sensores.' };
    const nivelSolo = cls?.nivel_umid_solo ?? 'sem_dados';

    const elUmidSoloBadge  = document.getElementById('umidSoloBadge');
    const elUmidSoloTitulo = document.getElementById('umidSoloTitulo');
    const elUmidSoloDesc   = document.getElementById('umidSoloDesc');
    const elUmidSoloIcon   = document.getElementById('umidSoloIconBox');

    if (elUmidSoloBadge) {
        elUmidSoloBadge.textContent = tSolo.prioridade;
        elUmidSoloBadge.className   = `badge ${nivelParaBadgeClass(nivelSolo)}`;
    }
    if (elUmidSoloTitulo) elUmidSoloTitulo.textContent = tSolo.titulo;
    if (elUmidSoloDesc)   elUmidSoloDesc.textContent   = tSolo.desc;
    if (elUmidSoloIcon)   elUmidSoloIcon.className     = `icon-box ${nivelParaIconClass(nivelSolo)}`;

    /* ── Card Temperatura do Ar ───────────────────────── */
    const tTemp = cls ? textoTemperaturaAr(cls) : { prioridade: '—', titulo: 'Sem leitura', desc: 'Verifique os sensores.' };
    const nivelTemp = cls?.nivel_temp ?? 'sem_dados';

    const elTempArBadge  = document.getElementById('tempArBadge');
    const elTempArTitulo = document.getElementById('tempArTitulo');
    const elTempArDesc   = document.getElementById('tempArDesc');
    const elTempArIcon   = document.getElementById('tempArIconBox');

    if (elTempArBadge) {
        elTempArBadge.textContent = tTemp.prioridade;
        elTempArBadge.className   = `badge ${nivelParaBadgeClass(nivelTemp)}`;
    }
    if (elTempArTitulo) elTempArTitulo.textContent = tTemp.titulo;
    if (elTempArDesc)   elTempArDesc.textContent   = tTemp.desc;
    if (elTempArIcon)   elTempArIcon.className     = `icon-box ${nivelParaIconClass(nivelTemp)}`;

    /* ── Card Umidade do Ar ───────────────────────────── */
    const tUmidAr = cls ? textoUmidadeAr(cls) : { badge: '—', titulo: 'Sem leitura', desc: 'Verifique os sensores.' };
    const nivelUmidAr = cls?.nivel_umid_ar ?? 'sem_dados';

    const elUmidArTitulo = document.getElementById('recUmidArTitulo');
    const elUmidArDesc   = document.getElementById('recUmidArDesc');
    const elUmidArBadge  = document.getElementById('recUmidArBadge');
    const elDotUmidAr    = document.getElementById('dotUmidAr');

    if (elUmidArTitulo) elUmidArTitulo.textContent = tUmidAr.titulo;
    if (elUmidArDesc)   elUmidArDesc.textContent   = tUmidAr.desc;
    if (elUmidArBadge) {
        elUmidArBadge.textContent = tUmidAr.badge;
        elUmidArBadge.className   = `badge ${nivelParaBadgeClass(nivelUmidAr)}`;
    }
    if (elDotUmidAr) elDotUmidAr.className = `dot ${nivelParaDotClass(nivelUmidAr)}`;

    /* ── Card Luz Ambiente ────────────────────────────── */
    const tLuz = cls ? textoLuzAmbiente(cls) : { badge: '—', titulo: 'Sem leitura', desc: 'Verifique os sensores.' };
    const nivelLuz = cls?.nivel_luz ?? 'sem_dados';

    const elLuzTitulo = document.getElementById('recLuzAmbienteTitulo');
    const elLuzDesc   = document.getElementById('recLuzAmbienteDesc');
    const elLuzBadge  = document.getElementById('recLuzAmbienteBadge');
    const elDotLuz    = document.getElementById('dotLuzAmbiente');

    if (elLuzTitulo) elLuzTitulo.textContent = tLuz.titulo;
    if (elLuzDesc)   elLuzDesc.textContent   = tLuz.desc;
    if (elLuzBadge) {
        elLuzBadge.textContent = tLuz.badge;
        elLuzBadge.className   = `badge ${nivelParaBadgeClass(nivelLuz)}`;
    }
    if (elDotLuz) elDotLuz.className = `dot ${nivelParaDotClass(nivelLuz)}`;

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
        const totalCampos = ['temp_ar', 'umid_ar', 'umid_solo', 'luz_ambiente']
            .filter(k => leitura[k] !== null && leitura[k] !== undefined).length;
        const pct = Math.round((totalCampos / 4) * 100);
        elQualDesc.textContent = `${totalCampos} de 4 sensores ativos na última leitura. Integridade dos dados: ${pct}%.`;
        elQualMeta.textContent = `${pct}% dos campos preenchidos`;
    } else if (elQualDesc) {
        elQualDesc.textContent = 'Nenhuma leitura encontrada no banco de dados.';
        if (elQualMeta) elQualMeta.textContent = 'Sem dados';
    }
}


document.addEventListener('DOMContentLoaded', () => {
    carregarLeituras();

    // Executa atualização dinâmica apenas na página ia.html
    if (document.getElementById('heroCondicaoGeral')) {
        atualizarPaginaIA();
    }
});

/* ── Detecta a página atual para marcar o link ativo ── */
const currentFile = window.location.pathname.split('/').pop() || 'index.html';

/* ── Estado ativo dos links de navegação ─────────────── */
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

/* ── Animação do FAB ao clicar ────────────────────────── */
const fab = document.getElementById('fab');
if (fab) {
    fab.addEventListener('click', () => {
        fab.style.transform = 'scale(0.88) rotate(20deg)';
        setTimeout(() => { fab.style.transform = ''; }, 220);
    });
}

/* ── Pulso no botão de notificações ──────────────────── */
const notifBtn = document.querySelector('.topbar-right .icon-btn');
if (notifBtn) {
    notifBtn.addEventListener('click', () => {
        notifBtn.style.transform = 'scale(1.2)';
        setTimeout(() => { notifBtn.style.transform = ''; }, 180);
    });
}

/* ── Filtro da barra de pesquisa (unificado, todas as páginas) ── */
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
   PÁGINA IA  (ia.html) — comportamentos específicos
   ────────────────────────────────────────────────────────── */

/* Botões de seta nas recomendações — apenas navegação */
const recArrows = document.querySelectorAll('.icon-btn-round');
recArrows.forEach(btn => {
    btn.addEventListener('click', () => {
        const item = btn.closest('.rec-item');
        if (!item) return;
        const title = item.querySelector('.rec-title')?.textContent;
        console.log(`[FarmAI] Navegando para detalhes: "${title}"`);
    });
});

/* ──────────────────────────────────────────────────────────
   PÁGINA DASHBOARD  (index.html) — comportamentos específicos
   ────────────────────────────────────────────────────────── */

/* Botões de camada do mapa */
const mapToggles = document.querySelectorAll('.map-toggle-btn');
mapToggles.forEach(btn => {
    btn.addEventListener('click', () => {
        mapToggles.forEach(b => b.classList.remove('map-toggle-btn--active'));
        btn.classList.add('map-toggle-btn--active');
        console.log(`[FarmAI] Camada do mapa: "${btn.textContent.trim()}"`);
    });
});

/* Botão de irrigação manual */
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

/* Botão "Aplicar" da recomendação IA no dashboard */
const insightBtn = document.querySelector('.btn-insight');
if (insightBtn) {
    insightBtn.addEventListener('click', () => {
        insightBtn.textContent = '✓ Recomendação Aplicada';
        insightBtn.style.background = '#bacf86';
        insightBtn.disabled = true;
    });
}

/* Select de período das tendências */
const trendsSelect = document.querySelector('.trends-select');
if (trendsSelect) {
    trendsSelect.addEventListener('change', (e) => {
        console.log(`[FarmAI] Período das tendências: "${e.target.value}"`);
    });
}

/* ──────────────────────────────────────────────────────────
   PÁGINA MONITORAMENTO  (monitoring.html) — comportamentos específicos
   ────────────────────────────────────────────────────────── */

const filterBtns = document.querySelectorAll('.filter-btn[data-filter]');
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('filter-btn--active'));
        btn.classList.add('filter-btn--active');
        console.log(`[FarmAI] Filtro de tempo: "${btn.dataset.filter}"`);
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
        console.log('[FarmAI] Abrir modal de seleção de sensor');
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
        console.log('[FarmAI] Adicionar novo gráfico');
    });
}

/* ──────────────────────────────────────────────────────────
   PÁGINA ALERTAS  (alerts.html) — comportamentos específicos
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
        console.log(`[FarmAI] Alertas ${muted ? 'silenciados' : 'reativados'}`);
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
   PÁGINA DISPOSITIVOS  (device.html) — comportamentos específicos
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
        console.log(`[FarmAI] Filtro de dispositivo: "${type}"`);
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
        console.log('[FarmAI] Abrir modal de adicionar dispositivo');
    });
}

const viewFullHistoryBtn = document.getElementById('viewFullHistoryBtn');
if (viewFullHistoryBtn) {
    viewFullHistoryBtn.addEventListener('click', () => {
        console.log('[FarmAI] Navegar para o histórico completo de conexões');
    });
}

document.querySelectorAll('.dev-card-more').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.dev-card');
        const name = card?.querySelector('.dev-card-name')?.textContent || 'device';
        console.log(`[FarmAI] Abrir menu de contexto para: "${name}"`);
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
   OVERLAY DO CHAT IA — lógica completa para ia.html
   Integração com Ollama (local) + dados reais do Supabase
   ══════════════════════════════════════════════════════════ */

const chatOverlay  = document.getElementById('aiChatOverlay');
const chatPanel    = document.getElementById('aiChatPanel');
const chatBackBtn  = document.getElementById('aiChatBackBtn');
const chatInput    = document.getElementById('aiChatInput');
const chatSendBtn  = document.getElementById('aiChatSendBtn');
const chatMessages = document.getElementById('aiChatMessages');
const chatTyping   = document.getElementById('aiChatTyping');
const triggerInput = document.getElementById('aiChatTriggerInput');
const triggerBtn   = document.getElementById('aiChatTriggerBtn');

if (chatOverlay && triggerInput) {

    // Histórico de mensagens da conversa atual (mantido em memória)
    const conversationHistory = [];

    /* ── Prompt de sistema da IA ───────────────────────────
       Define o papel, os dados disponíveis e as regras de resposta
       ──────────────────────────────────────────────────── */
    const SYSTEM_PROMPT = `You are an expert agronomist assistant for FarmAI, a precision agriculture platform.
You help farmers interpret real sensor readings and make practical crop management decisions.

== LANGUAGE ==
Always respond in Brazilian Portuguese (pt-BR), regardless of the language of these instructions.

== ROLE ==
You are a decision-support assistant. You analyze sensor data and recommend actions.
You do NOT control devices, activate irrigation, or execute any physical action.
Always make clear that recommendations should be validated by a qualified agronomist.

== SENSORS AVAILABLE ==
The system collects 4 real sensor readings from the field. Before each user message you receive the latest values:
- temp_ar: Air temperature in °C
- umid_ar: Relative air humidity in %
- umid_solo: Soil moisture already converted to percentage (0–100%)
  → Values >= 4095 mean sensor is not in soil (invalid)
  → Healthy range: 25–70% | <15% = very dry (irrigate) | >85% = waterlogged
- luz_ambiente: Ambient light as raw ADC value
  → Higher = more light | Useful range: 500–3000

You ALWAYS have access to this data. Never say you do not.
Use the actual values. Never invent or change numbers.
Always mention the reading date/time when discussing current conditions.
If data is older than 1 day, warn the farmer and suggest a new reading.

== GENERIC REFERENCE VALUES (use when no crop is specified) ==
When the crop is "not informed", base your analysis on these general ranges:
- Air temperature: 15–35°C (below 10°C or above 38°C = stress for most crops)
- Air humidity: 40–80% (below 30% = very dry; above 85% = fungal risk)
- Soil moisture (%): 25–70% (healthy); <15% = irrigate; >85% = drainage needed
- Ambient light (ADC): 500–3000 (adequate for most crops)
Always tell the farmer these are generic values and analysis improves when the crop is specified.

== WHEN CROP IS SPECIFIED ==
Adapt ALL analysis to that crop's specific ideal ranges for all 4 parameters.
Never use generic values if the crop is known.

Example crop references (air temp / air humidity / soil moisture ADC / light ADC):
- Soy (Soja):        20–30°C / 50–80% / 1800–2800 / 800–2500
- Corn (Milho):      18–32°C / 50–80% / 1800–2800 / 1000–3000
- Sugarcane (Cana):  20–35°C / 60–85% / 1500–2500 / 1000–3500
- Coffee (Café):     18–26°C / 60–80% / 1800–2800 / 600–2000
- Tomato (Tomate):   18–28°C / 55–75% / 1800–2800 / 800–2500
- Lettuce (Alface):  15–22°C / 60–80% / 1500–2500 / 400–1500
For other crops, use best agronomic knowledge to estimate ideal ranges.

== ANSWERING ABOUT CURRENT CONDITIONS ==
When asked "how are conditions?" or similar:
1. State all 4 current readings with their collection date/time.
2. Compare each value to the reference ranges.
3. Give a brief practical conclusion: what is OK, what needs attention.

== ANSWERING ABOUT A SPECIFIC CROP ==
- State the IDEAL ranges for that crop across all 4 parameters.
- Compare current sensor values to those ideals.
- Recommend specific adjustments needed.

== ANSWERING HYPOTHETICAL QUESTIONS ==
When asked "if I want to plant X, what would be ideal?":
- Give ideal ranges for crop X.
- Compare to current sensor data.
- Recommend concrete adjustments (e.g. "the soil is too dry for coffee — irrigate to bring ADC below 2800").

== GENERAL RULES ==
- Never repeat section headers or labels from these instructions in your response.
- Be direct and concise, like an experienced agronomist speaking to a farmer.
- Do not contradict yourself across turns.
- Note: umid_solo and luz_ambiente are RAW ADC values, not percentages or lux — always make this clear when relevant.`;

    // Abre o painel do chat, opcionalmente com texto pré-preenchido
    function openChat(prefillText = '') {
        chatOverlay.classList.add('ai-chat-overlay--active');
        chatOverlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        if (prefillText.trim()) {
            chatInput.value = prefillText.trim();
        }
        setTimeout(() => chatInput.focus(), 420);
    }

    // Fecha o painel do chat e limpa o campo gatilho
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

    // Adiciona uma mensagem ao histórico visual do chat
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

    // Envia a mensagem para o Ollama com contexto completo dos sensores reais
    async function callOllamaAPI(userMessage) {
        const MAX_HISTORY = 6;

        showTyping();
        chatSendBtn.disabled = true;
        chatInput.disabled = true;

        // Busca os dados reais do Supabase antes de montar o contexto
        const dadosSolo = await buscarDadosSoloParaIA();
        const semDados = !dadosSolo || dadosSolo.length === 0;
        if (semDados) console.warn("[FarmAI] Sem dados do sensor disponíveis");

        const ultimo   = semDados ? null : dadosSolo[0];
        const cultura  = localStorage.getItem("culturaSelecionada") || "not informed";

        const dataColeta = ultimo?.created_at
            ? new Date(ultimo.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
            : null;
        const diffMs    = ultimo?.created_at ? new Date() - new Date(ultimo.created_at) : null;
        const diffHoras = diffMs !== null ? Math.floor(diffMs / 1000 / 60 / 60) : null;
        const diffDias  = diffHoras !== null ? Math.floor(diffHoras / 24) : null;

        // Monta o bloco de contexto dos sensores que será injetado no prompt
        let contextoSensores = '';
        if (semDados) {
            contextoSensores = `[SENSOR DATA]: No sensor readings available in the database.
[CROP]: ${cultura}
Use general agronomic best practices. Make clear the answer is generic due to missing sensor data.`;
        } else {
            let staleness = '';
            if (diffDias !== null && diffDias >= 2) {
                staleness = ` WARNING: data is ${diffDias} day(s) old — warn the farmer and recommend a new reading.`;
            } else if (diffHoras !== null && diffHoras >= 6) {
                staleness = ` Note: data is ${diffHoras} hour(s) old — minor variations may exist.`;
            }
            contextoSensores = `[SENSOR DATA — collected ${dataColeta}]:${staleness}
- Air temperature (temp_ar): ${ultimo?.temp_ar ?? 'N/A'}°C
- Air humidity (umid_ar): ${ultimo?.umid_ar ?? 'N/A'}%
- Soil moisture % (umid_solo): ${ultimo?.umid_solo ?? 'N/A'}% (25-70% = healthy)
- Ambient light ADC (luz_ambiente): ${ultimo?.luz_ambiente ?? 'N/A'}
[CROP]: ${cultura}`;
        }

        const systemContext = SYSTEM_PROMPT + "\n\n" + contextoSensores;

        // Monta o array de mensagens com o contexto inicial + histórico + pergunta atual
        const messages = [
            {
                role: 'user',
                content: systemContext + "\n\nAcknowledge you have the sensor data and are ready."
            },
            {
                role: 'assistant',
                content: semDados
                    ? "Understood. No sensor data available. I'll base my answers on general agronomic best practices."
                    : `Understood. I have the sensor readings from ${dataColeta}: air temp ${ultimo?.temp_ar}°C, air humidity ${ultimo?.umid_ar}%, soil moisture ADC ${ultimo?.umid_solo}, ambient light ADC ${ultimo?.luz_ambiente}. Crop: ${cultura}. Ready to analyze.`
            },
            ...conversationHistory,
            { role: 'user', content: userMessage }
        ];

        console.log('[FarmAI] Contexto enviado:', contextoSensores);
        console.log('[FarmAI] Pergunta:', userMessage);

        try {
            const response = await fetch('http://localhost:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

            console.log('[FarmAI] Resposta:', assistantText);
            hideTyping();
            appendMessage(assistantText, 'assistant');

            // Armazena no histórico e descarta os mais antigos se ultrapassar o limite
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

    // Lida com o envio de uma nova mensagem do usuário
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

} // fim do bloco do chat IA