/* Funções compartilhadas dos painéis de bacia (sem framework, sem build). window.BACIA vem de cada página. */
const BACIA = window.BACIA || { nome: '', rio: 'rio', centro: [-15, -50], zoom: 4 };
const PAL = { escuro: '#294086', medio: '#0193DE', claro: '#80B5E1', marinho: '#000080', limite: '#C0504D',
              fsarh: '#E08A1E', cinza: '#6B7280', chuva: '#80B5E1', grade: '#E5E7EB' };
// usinas: só a defluência é exibida (a afluência horária do ONS é resíduo de balanço)
// cores distinguíveis entre si: defluência azul-escuro (total), turbinada verde-água, vertida laranja
const SERIES = { nivel_montante: PAL.escuro, nivel_jusante: PAL.claro, defluencia: PAL.escuro, vazao_turbinada: '#1B9E77',
                 vazao_vertida: '#E6791E', afluencia: '#8C9BB5', vazao_natural: '#8C9BB5', pct_volume_util: PAL.escuro };
const ROT = { nivel_montante: 'Nível montante', nivel_jusante: 'Nível jusante', defluencia: 'Defluência', vazao_turbinada: 'Turbinada',
              vazao_vertida: 'Vertida', afluencia: 'Afluência (ONS, resíduo de balanço)', vazao_natural: 'Vazão natural (diária)',
              pct_volume_util: 'Volume útil (%)' };
const PAGINAS = [['index.html', 'O rio agora'], ['chuva.html', 'Chuva'], ['catalogo.html', 'Catálogo']];
function trilha(itens) { return `<nav class="trilha">${itens.map(([h, t]) => h ? `<a href="${h}">${t}</a>` : `<span>${t}</span>`).join('<span class="sep">›</span>')}</nav>`; }
const PAPEL = { montante: 'estação fluviométrica a montante', afluente: 'afluente', barramento: 'estação fluviométrica no barramento', jusante: 'estação fluviométrica a jusante', pluviometro: 'pluviômetro' };

/* marcador de usina nos mapas: triângulo azul-escuro; rótulo fixo à direita ou só no hover */
// convenção do ONS: triângulo = UHE com reservatório de acumulação; círculo = UHE a fio d'água
const svgUsina = (tipo, cor = '#294086', tam = 18) => tipo === 'acumulacao'
  ? `<svg width="${tam}" height="${tam * 16 / 18}" viewBox="0 0 18 16"><path d="M9 1 L17 15 L1 15 Z" fill="${cor}" stroke="#fff" stroke-width="1.5"/></svg>`
  : `<svg width="${tam * 16 / 18}" height="${tam * 16 / 18}" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5" fill="${cor}" stroke="#fff" stroke-width="1.5"/></svg>`;
const SVG_TRIANGULO = svgUsina('acumulacao');
const LEGENDA_USINAS = `${svgUsina('acumulacao')}UHE com reservatório de acumulação<br>${svgUsina('fio_dagua')}UHE a fio d'água`;
function marcadorUsina(latlng, nome, rotuloFixo = false, tipo = 'acumulacao') {
  // âncora abaixo do símbolo: ele fica como um pino acima do ponto, sem cobrir a estação de barramento que tem a mesma coordenada
  const ic = L.divIcon({ className: '', iconSize: [18, 16], iconAnchor: [9, 26], html: svgUsina(tipo) });
  const m = L.marker(latlng, { icon: ic, zIndexOffset: 500 });
  if (rotuloFixo) m.bindTooltip(nome, { permanent: true, direction: 'right', offset: [8, -18], className: 'rotulo-usina' });
  else m.bindTooltip(nome, { direction: 'top', offset: [0, -26] });
  return m;
}

/* hidrografia (rio principal e afluentes monitorados, SNIRH) nos mapas; devolve a camada ou null */
async function desenharHidrografia(mapa, escala = 1, interativa = true) {
  try {
    const gj = await carregar('hidrografia.geojson');
    const cam = L.geoJSON(gj, {
      style: f => f.properties.classe === 'principal' ? { color: '#0B6BA8', weight: 2.6 * escala, opacity: .9 } : { color: '#3FB0E8', weight: 1.4 * escala, opacity: .85 },
      interactive: interativa,
      onEachFeature: (f, l) => { if (interativa) l.bindTooltip(f.properties.nome, { sticky: true }); },
    }).addTo(mapa);
    return cam;
  } catch (e) { console.warn('hidrografia', e); return null; }
}
const LEGENDA_HIDRO = '<i style="background:#0B6BA8;height:3px;border-radius:0"></i>' + BACIA.rio + '<br><i style="background:#3FB0E8;height:2px;border-radius:0"></i>afluente monitorado';

/* legenda do esquema longitudinal (início e trecho) */
function legendaEsquema(temRamal = false, temConfluencia = false) {
  const tri = '<svg width="15" height="13" viewBox="0 0 18 16"><path d="M9 1 L17 15 L1 15 Z" fill="#294086"/></svg>';
  const cir = '<svg width="13" height="13" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#294086"/></svg>';
  const pto = c => `<svg width="11" height="11" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="${c}"/></svg>`;
  const afl = '<svg width="22" height="16" viewBox="0 0 22 16"><path d="M0 2 H22" stroke="#80B5E1" stroke-width="3"/><path d="M9 3 L12 12" stroke="#80B5E1" stroke-width="2" stroke-dasharray="2.5 2"/><circle cx="12" cy="12.5" r="3" fill="#2E8B57"/></svg>';
  const item = (icone, texto) => `<div class="li"><span class="ic">${icone}</span><span>${texto}</span></div>`;
  return `<div class="legenda-esquema">
    <div class="grupo"><div class="tit">Símbolos</div>
      ${item(tri, 'UHE com reservatório de acumulação · número acima: defluência (m³/s) · <b>VU</b> abaixo: volume útil armazenado (%)')}
      ${item(cir, "UHE a fio d'água · número acima: defluência (m³/s)")}
      ${item(pto('#0193DE'), 'estação fluviométrica · número: vazão (m³/s)')}
      ${item(afl, 'afluente · margem direita acima do rio, margem esquerda abaixo')}
      ${temConfluencia ? item('<svg width="26" height="20" viewBox="0 0 26 20"><path d="M0 2 H26" stroke="#80B5E1" stroke-width="3"/><path d="M8 3 V9 M8 9 L9 16 M8 9 L20 13" stroke="#80B5E1" stroke-width="2" stroke-dasharray="2.5 2" fill="none"/><circle cx="9" cy="16.5" r="2.6" fill="#2E8B57"/><circle cx="20.5" cy="13" r="2.6" fill="#2E8B57"/></svg>', 'afluente de afluente · os dois se juntam antes de chegar ao rio') : ''}
      ${temRamal ? item('<svg width="22" height="14" viewBox="0 0 22 14"><path d="M21 12 H8 Q3 12 3 7 V1" stroke="#80B5E1" stroke-width="3" fill="none"/></svg>', 'afluente com usina · braço paralelo ao rio, que sobe até a confluência; clique para abrir o trecho do afluente') : ''}
    </div>
    <div class="grupo"><div class="tit">Idade do dado</div>
      <div class="li" style="color:var(--texto-suave)">cor das estações e do contorno das usinas</div>
      ${item(pto('#2E8B57'), 'até 2 h')}
      ${item(pto('#D9A400'), 'até 24 h')}
      ${item(pto('#9CA3AF'), 'sem dado recente')}
    </div>
    <div class="grupo"><div class="tit">Aviso</div>
      ${item(pto('#E08A1E'), 'ao lado do nome do trecho: há evento para olhar nas últimas 24 h')}
    </div>
  </div>`;
}

/* esquema longitudinal do rio: usinas e réguas em ordem, com o valor da última hora */
function desenharEsquema(el, todos, destaque = null) {
  // trecho em afluente (ramal_de: usina num tributário, como Mauá no Tibagi) não entra na linha do rio principal:
  // aparece como ramal na faixa do trecho onde o afluente chega
  const trechos = todos.filter(t => !t.ramal_de);
  const ramais = todos.filter(t => t.ramal_de);
  const unico = trechos.length === 1;
  const temSul = trechos.some(t => t.estacoes.some(e => e.papel === 'afluente' && e.margem === 'esquerda' && e.esquema !== false)) || ramais.some(r => r.margem === 'esquerda');
  // margem direita maior: os nomes das estações descem inclinados para a direita e a primeira coluna (cabeceira) fica na borda
  const COL = 56, MARG = unico ? 64 : 28, MARG_D = unico ? 64 : 128, Y = 180;
  let H = temSul ? 402 : 298;
  const cols = []; // {tipo, x, ...}
  trechos.forEach(t => {
    const ini = cols.length;
    const principais = t.estacoes.filter(e => e.esquema !== false && e.papel !== 'barramento');
    const barr = t.estacoes.find(e => e.papel === 'barramento');
    let usinaInserida = false;
    // afluente com usina (como o ONS desenha o rio Pardo no Grande): braço paralelo ao rio principal, com as estações
    // e a usina do afluente em ordem de rio, no lado de montante da faixa do trecho onde ele deságua
    ramais.filter(r => r.ramal_de === t.slug).forEach(r => {
      r._ini = cols.length;
      const ests = r.estacoes.filter(e => e.esquema !== false && e.papel !== 'barramento');
      const rb = r.estacoes.find(e => e.papel === 'barramento');
      let ui = false;
      ests.forEach(e => {
        if (e.papel === 'jusante' && r.usina && !ui) { cols.push({ tipo: 'ramal_usina', t: r, u: r.usina, barr: rb }); ui = true; }
        cols.push({ tipo: 'ramal_est', t: r, e });
      });
      if (r.usina && !ui) cols.push({ tipo: 'ramal_usina', t: r, u: r.usina, barr: rb });
      r._fim = cols.length;
    });
    principais.forEach(e => {
      if (e.papel === 'jusante' && t.usina && !usinaInserida) { cols.push({ tipo: 'usina', t, u: t.usina, barr }); usinaInserida = true; }
      if (e.papel !== 'afluente') { cols.push({ tipo: 'regua', t, e }); return; }
      // afluentes vizinhos do mesmo lado: o de jusante (à esquerda) fica mais longe do rio, para que o nome de um,
      // inclinado para a direita, passe por cima da linha do outro; um terceiro seguido ganha uma coluna livre antes
      const ant = cols[cols.length - 1], c = { tipo: 'afluente', t, e, nivel: 0 };
      if (ant && ant.tipo === 'afluente' && (ant.e.margem === 'esquerda') === (e.margem === 'esquerda')) {
        if (ant.nivel) cols.push({ tipo: 'vazio', t }); else c.nivel = 1;
      }
      cols.push(c);
    });
    if (t.usina && !usinaInserida) cols.push({ tipo: 'usina', t, u: t.usina, barr });
    if (!principais.length && !t.usina && barr) cols.push({ tipo: 'regua', t, e: barr });
    if (cols.length - ini < 2) cols.push({ tipo: 'vazio', t }); // faixa mínima de 2 colunas para caber o nome
    t._ini = ini; t._fim = cols.length;
  });
  // afluente que deságua em outro afluente monitorado (desagua_em): os dois formam um grupo, com um tronco até o rio
  cols.forEach((c, i) => {
    if (c.tipo !== 'afluente' || !c.e.desagua_em) return;
    const p = cols.findIndex(o => o.tipo === 'afluente' && o.t === c.t && o.e.rio_afluente === c.e.desagua_em);
    if (p < 0) return;
    const g = cols[p].grupo || { membros: [p] };
    g.membros.push(i); cols[p].grupo = g; c.grupo = g;
  });
  cols.forEach(c => { if (c.grupo) c.grupo.ultimo = Math.max(...c.grupo.membros); });
  const yAfl = c => c.e.margem === 'esquerda' ? Y + 150 + 34 * c.nivel : Y - 80 - 32 * c.nivel;
  // altura: cabe o nome inclinado (20°) das estações de afluente abaixo do rio
  cols.forEach(c => { if (c.tipo === 'afluente' && c.e.margem === 'esquerda') H = Math.max(H, yAfl(c) + 14 + c.e.curto.length * 5.5 * 0.34); });
  const W = MARG + MARG_D + cols.length * COL;
  const x = i => W - (MARG_D + i * COL + COL / 2); // espelhado: cabeceira à direita, foz à esquerda, como no mapa
  const cor = h => ({ ok: '#2E8B57', aviso: '#D9A400', off: '#9CA3AF' }[frescorClasse(h)]);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  // bacia inteira: ocupa a largura toda (com rolagem no celular); um trecho só: tamanho natural, sem esticar
  const estilo = trechos.length > 1 ? `width:100%;min-width:${Math.min(W, 1100)}px;height:auto` : `width:${W}px;max-width:100%;height:auto`;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="${estilo}" font-family="Questrial, Century Gothic, sans-serif">`;
  // faixas dos trechos
  trechos.forEach((t, k) => {
    const x1 = W - (MARG_D + t._ini * COL), x0 = W - (MARG_D + t._fim * COL);
    if (x1 <= x0) return;
    const sel = t.slug === destaque;
    s += `<a href="trecho.html?t=${t.slug}"><rect x="${x0}" y="0" width="${x1 - x0}" height="${H}" fill="${sel ? '#E3EEFB' : (k % 2 ? '#F1F5FA' : '#FFFFFF')}"><title>${esc(t.nome)}</title></rect>`;
    if (sel) s += `<rect x="${x0 + 1.5}" y="1.5" width="${x1 - x0 - 3}" height="${H - 3}" rx="6" fill="none" stroke="#294086" stroke-width="2.5"/>`;
    s += `<text x="${x0 + 6}" y="14" font-size="${sel ? 12.5 : 11.5}" fill="#294086" ${sel ? 'font-weight="bold"' : ''}>${esc(t.curto || t.nome)}${t.avisos && t.avisos.length ? ` <tspan fill="#E08A1E">●</tspan>` : ''}</text></a>`;
  });
  // rio
  s += `<path d="M${W - MARG_D} ${Y} H${MARG}" stroke="#80B5E1" stroke-width="6" stroke-linecap="round" fill="none"/>`;
  // setas do sentido do rio (leste -> oeste), uma por faixa de trecho
  // uma seta por divisa de trecho, no meio exato entre as bordas das formas vizinhas sobre o rio
  const formasRio = cols.map((c, i) => c.tipo === 'regua' ? [x(i) - 7, x(i) + 7] : c.tipo === 'usina' ? (c.u.tipo === 'acumulacao' ? [x(i) - 14, x(i) + 16] : [x(i) - 13, x(i) + 13]) : null).filter(Boolean);
  trechos.forEach(t => {
    if (t._fim <= t._ini) return;
    const divisa = W - (MARG_D + t._fim * COL);
    const esq = Math.max(MARG, ...formasRio.filter(f => f[1] <= divisa + 0.1).map(f => f[1]));
    const dir = Math.min(W - MARG_D, ...formasRio.filter(f => f[0] >= divisa - 0.1).map(f => f[0]));
    const xs = (esq + dir) / 2;
    s += `<path d="M${xs + 3.5} ${Y - 5} L${xs - 3.5} ${Y} L${xs + 3.5} ${Y + 5}" fill="none" stroke="#294086" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  const YB = r => r.margem === 'esquerda' ? Y + 112 : Y - 112; // altura do braço do afluente
  ramais.filter(r => r._fim > r._ini).forEach(r => {
    const yb = YB(r), xr = x(r._ini) + COL * 0.55, xl = x(r._fim - 1) - COL * 0.5, R = 14, sobe = yb > Y ? -1 : 1;
    const sel = r.slug === destaque;
    if (sel) s += `<rect x="${xl - 10}" y="${Math.min(yb, Y) + (yb > Y ? 14 : -60)}" width="${xr - xl + 20}" height="${Math.abs(yb - Y) + 46}" rx="6" fill="#E3EEFB" stroke="#294086" stroke-width="2"/>`;
    s += `<a href="trecho.html?t=${r.slug}"><path d="M${xr} ${yb} H${xl + R} Q${xl} ${yb} ${xl} ${yb + sobe * R} V${Y}" stroke="#80B5E1" stroke-width="5" stroke-linecap="round" fill="none"/>`;
    s += `<text x="${xr + 6}" y="${yb + 4}" font-size="11" font-style="italic" fill="#294086">${esc(r.rio || r.nome)}</text><title>${esc(r.nome)}: clique para abrir o trecho</title></a>`;
    // setas do sentido do afluente, entre as formas do braço
    for (let i = r._ini; i < r._fim - 1; i++) { const xs = (x(i) + x(i + 1)) / 2; s += `<path d="M${xs + 3} ${yb - 4} L${xs - 3} ${yb} L${xs + 3} ${yb + 4}" fill="none" stroke="#294086" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`; }
  });
  s += unico
    ? `<text x="${W - 4}" y="${Y + 4}" font-size="10" fill="#6B7280" text-anchor="end">montante</text><text x="${4}" y="${Y + 4}" font-size="10" fill="#6B7280">← jusante</text>`
    : `<text x="${W - MARG_D + 10}" y="${Y + 4}" font-size="10" fill="#6B7280">cabeceira</text>`;
  cols.forEach((c, i) => {
    let cx = x(i);
    if (c.tipo === 'vazio') {
      return;
    } else if (c.tipo === 'ramal_est') {
      const e = c.e, yb = YB(c.t);
      s += `<a href="estacao.html?c=${e.codigo}"><circle cx="${cx}" cy="${yb}" r="6.5" fill="${cor(e.frescor_h)}" stroke="#fff" stroke-width="2"/>`;
      s += `<text x="${cx}" y="${yb - 12}" font-size="11.5" text-anchor="middle" fill="#1F2937">${fmt(e.vazao)}</text>`;
      s += `<text transform="translate(${cx + 3} ${yb + 16}) rotate(45)" font-size="10" fill="#374151">${esc(e.curto)}</text>`;
      s += `<title>${esc(e.curto)} (${e.codigo}) · ${PAPEL[e.papel]} no ${esc(c.t.rio || c.t.nome)}
${fmt(e.vazao)} m³/s · ${frescorTexto(e.frescor_h)}</title></a>`;
    } else if (c.tipo === 'ramal_usina') {
      const u = c.u, a = u.atual || {}, yb = YB(c.t), acum = u.tipo === 'acumulacao';
      s += `<a href="trecho.html?t=${c.t.slug}">`;
      s += acum ? `<path d="M${cx + 14} ${yb} L${cx - 12} ${yb - 15} L${cx - 12} ${yb + 15} Z" fill="#294086" stroke="${cor(a.frescor_h)}" stroke-width="2.2" stroke-linejoin="round"/>`
                : `<circle cx="${cx}" cy="${yb}" r="11" fill="#294086" stroke="${cor(a.frescor_h)}" stroke-width="2.2"/>`;
      s += `<text x="${cx}" y="${yb - 21}" font-size="12" text-anchor="middle" fill="#294086">${fmt(a.defluencia)}</text>`;
      if (acum) s += `<text x="${cx}" y="${yb + 28}" font-size="10" text-anchor="middle" fill="#294086">VU ${fmt(a.pct_volume_util, 0)}%</text>`;
      s += `<text transform="translate(${cx + 3} ${yb + (acum ? 42 : 30)}) rotate(45)" font-size="10.5" fill="#294086">${esc(u.curto)}</text>`;
      s += `<title>${esc(u.nome)} · no ${esc(c.t.rio || c.t.nome)}, ${acum ? 'reservatório de acumulação' : "fio d'água"} (ONS ${fmtInst(a.instante)})
defluência ${fmt(a.defluencia)} m³/s${acum ? ' · volume útil ' + fmt(a.pct_volume_util, 1) + '%' : ''}
clique para abrir o trecho</title></a>`;
    } else if (c.tipo === 'afluente') {
      // margem direita (norte) acima do rio, margem esquerda (sul) abaixo, como no mapa com o norte para cima;
      // a linha chega ao rio logo a jusante da própria coluna; abaixo do rio, desvia do nome inclinado do vizinho da esquerda
      const e = c.e, sul = e.margem === 'esquerda', g = c.grupo, cy = yAfl(c);
      // deslocamento da coluna para a direita quando o nome inclinado (45°) do vizinho de jusante, abaixo do rio, invadiria a linha
      const desloca = k => {
        const v = cols[k + 1];
        const nome = v && (v.tipo === 'regua' ? [v.e.curto, 10.5] : v.tipo === 'usina' ? [v.u.curto, 11] : null);
        if (!(cols[k].e.margem === 'esquerda') || !nome) return 0;
        return Math.max(0, Math.min(COL * 0.4, x(k + 1) + 3 + nome[0].length * nome[1] * 0.6 * 0.707 + 16 - (x(k) - 8)));
      };
      const xRio = k => x(k) - 8 + desloca(k);
      cx += desloca(i);
      if (g) {
        // afluente de afluente: cada estação liga à confluência dos dois; o tronco, desenhado uma vez, segue até o rio principal
        const xj = xRio(g.ultimo), yj = sul ? Y + 116 : Y - 46;
        if (i === g.ultimo) {
          const nomes = g.membros.map(k => cols[k].e.rio_afluente).filter(Boolean);
          s += `<path d="M${xj} ${yj} L${xj} ${sul ? Y + 3 : Y - 3}" stroke="#80B5E1" stroke-width="3.5" fill="none" stroke-dasharray="4 3"><title>${esc(nomes.join(' e '))}: juntam-se antes de chegar ao ${esc(BACIA.rio)}</title></path>`;
          s += `<circle cx="${xj}" cy="${yj}" r="3" fill="#80B5E1"/>`;
        }
        s += `<a href="estacao.html?c=${e.codigo}"><path d="M${cx} ${cy} L${xj} ${yj}" stroke="#80B5E1" stroke-width="2.5" fill="none" stroke-dasharray="3 3"/>`;
      } else {
        s += `<a href="estacao.html?c=${e.codigo}"><path d="M${cx} ${cy} L${xRio(i)} ${sul ? Y + 3 : Y - 3}" stroke="#80B5E1" stroke-width="2.5" fill="none" stroke-dasharray="3 3"/>`;
      }
      s += `<circle cx="${cx}" cy="${cy}" r="6" fill="${cor(e.frescor_h)}" stroke="#fff" stroke-width="1.5"/>`;
      s += `<text x="${cx - 9}" y="${cy + 4}" font-size="11.5" text-anchor="end" fill="#1F2937">${fmt(e.vazao)}</text>`;
      s += sul ? `<text transform="translate(${cx + 8} ${cy + 6}) rotate(20)" font-size="10" fill="#6B7280">${esc(e.curto)}</text>`
               : `<text transform="translate(${cx + 8} ${cy - 2}) rotate(-20)" font-size="10" fill="#6B7280">${esc(e.curto)}</text>`;
      s += `<title>${esc(e.curto)} (${e.codigo}) · ${PAPEL[e.papel]}${e.rio_afluente ? ' · ' + e.rio_afluente : ''}${e.desagua_em ? ', que deságua no ' + e.desagua_em : ''}\n${fmt(e.vazao)} m³/s · ${frescorTexto(e.frescor_h)}</title></a>`;
    } else if (c.tipo === 'regua') {
      const e = c.e;
      s += `<a href="estacao.html?c=${e.codigo}"><circle cx="${cx}" cy="${Y}" r="7" fill="${cor(e.frescor_h)}" stroke="#fff" stroke-width="2"/>`;
      s += `<text x="${cx}" y="${Y - 14}" font-size="12" text-anchor="middle" fill="#1F2937">${fmt(e.vazao !== null && e.vazao !== undefined ? e.vazao : null)}</text>`;
      s += `<text transform="translate(${cx + 3} ${Y + 36}) rotate(45)" font-size="10.5" fill="#374151">${esc(e.curto)}</text>`;
      s += `<title>${esc(e.curto)} (${e.codigo}) · ${PAPEL[e.papel]}\n${fmt(e.vazao)} m³/s${e.cota_m !== null && e.cota_m !== undefined ? ' · cota ' + fmt(e.cota_m, 2) + ' m' : ''} · ${frescorTexto(e.frescor_h)}${e.ref && e.ref.vazao_media_30d ? '\nmédia 30 d: ' + fmt(e.ref.vazao_media_30d) + ' m³/s' : ''}</title></a>`;
    } else {
      const u = c.u, a = u.atual || {};
      const acum = u.tipo === 'acumulacao';
      s += `<a href="trecho.html?t=${c.t.slug}">`;
      // triângulo deitado, ponta para montante (direita), contra o sentido do rio no diagrama
      s += acum ? `<path d="M${cx + 16} ${Y} L${cx - 14} ${Y - 17} L${cx - 14} ${Y + 17} Z" fill="#294086" stroke="${cor(a.frescor_h)}" stroke-width="2.5" stroke-linejoin="round"/>`
                : `<circle cx="${cx}" cy="${Y}" r="13" fill="#294086" stroke="${cor(a.frescor_h)}" stroke-width="2.5"/>`;
      s += `<text x="${cx}" y="${Y - (acum ? 24 : 21)}" font-size="12.5" text-anchor="middle" fill="#294086">${fmt(a.defluencia)}</text>`;
      if (acum) s += `<text x="${cx}" y="${Y + 31}" font-size="10.5" text-anchor="middle" fill="#294086">VU ${fmt(a.pct_volume_util, 0)}%</text>`;
      s += `<text transform="translate(${cx + 3} ${Y + (acum ? 47 : 36)}) rotate(45)" font-size="11" fill="#294086">${esc(u.curto)}</text>`;
      s += `<title>${esc(u.nome)} · ${acum ? 'UHE com reservatório de acumulação' : "UHE a fio d'água"} (ONS ${fmtInst(a.instante)})\ndefluência ${fmt(a.defluencia)} m³/s · turbinada ${fmt(a.vazao_turbinada)} · vertida ${fmt(a.vazao_vertida)}\nnível montante ${fmt(a.nivel_montante, 2)} m${u.tipo === 'acumulacao' ? ' · volume útil ' + fmt(a.pct_volume_util, 1) + '%' : ''}${c.barr ? '\nestação de barramento ' + c.barr.codigo + ': ' + fmt(c.barr.vazao) + ' m³/s' : ''}</title></a>`;
    }
  });
  s += '</svg>';
  el.innerHTML = s;
}

function fmt(v, nd = 0) { return (v === null || v === undefined || Number.isNaN(v)) ? '–' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: nd, maximumFractionDigits: nd }); }
function fmtInst(iso, comAno = false) { if (!iso) return '–'; const [d, h] = iso.split('T'); const [a, m, dd] = d.split('-'); return `${dd}/${m}${comAno ? '/' + a : ''}${h ? ' ' + h : ''}`; }
function fmtData(iso) { if (!iso) return '–'; const [a, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${a}`; }
function frescorClasse(h) { if (h === null || h === undefined) return 'off'; return h <= 2 ? 'ok' : (h <= 24 ? 'aviso' : 'off'); }
function frescorTexto(h) { if (h === null || h === undefined) return 'sem dado'; if (h < 1) return 'há menos de 1 h'; if (h < 48) return `há ${Math.round(h)} h`; return `há ${Math.round(h / 24)} d`; }
function param(nome, padrao) { return new URLSearchParams(location.search).get(nome) || padrao; }
async function carregar(caminho) {
  const v = Math.floor(Date.now() / 300000); // cache de 5 min
  const r = await fetch(`data/${caminho}?v=${v}`);
  if (!r.ok) throw new Error(`${caminho}: ${r.status}`);
  return r.json();
}
function tend(delta, nd = 0, unidade = '') {
  if (delta === null || delta === undefined) return '';
  const cls = Math.abs(delta) < (nd ? 0.005 : 0.5) ? 'igual' : (delta > 0 ? 'sobe' : 'desce');
  const seta = cls === 'igual' ? '→' : (delta > 0 ? '↑' : '↓');
  return `<span class="tend ${cls}" title="variação nas últimas 6 h">${seta} ${fmt(Math.abs(delta), nd)}${unidade}</span>`;
}

/* cabeçalho e rodapé */
function montarTopo(ativo, status) {
  const nav = PAGINAS.map(([h, t]) => `<a href="${h}" class="${h === ativo ? 'ativo' : ''}">${t}</a>`).join('');
  const logo = `<svg viewBox="0 0 60 40"><path d="M2 10 Q15 0 30 10 T58 10" fill="none" stroke="${PAL.claro}" stroke-width="5" stroke-linecap="round"/><path d="M2 20 Q15 10 30 20 T58 20" fill="none" stroke="${PAL.medio}" stroke-width="5" stroke-linecap="round"/><path d="M2 30 Q15 20 30 30 T58 30" fill="none" stroke="${PAL.escuro}" stroke-width="5" stroke-linecap="round"/></svg>`;
  let carimbo = '';
  if (status) {
    const o = status.ons || {}, t = status.telemetria || {}, m = status.merge || {};
    carimbo = `<div class="carimbo">
      <span>Gerado <b>${fmtInst(status.gerado_em)}</b></span>
      <span><span class="ponto ${o.ok ? 'ok' : 'off'}"></span>ONS até <b>${fmtInst(o.ultimo_instante)}</b></span>
      <span><span class="ponto ${t.ok ? 'ok' : 'off'}"></span>Telemetria: <b>${t.com_dado || 0}</b> de ${t.total || 0} estações</span>
      <span><span class="ponto ${m.ok ? 'ok' : 'off'}"></span>MERGE até <b>${fmtData(m.ultimo_dia)}</b></span></div>`;
  }
  const el = document.getElementById('topo');
  el.innerHTML = `<div class="interno"><a class="marca" href="index.html">${logo}<div>Painel ${BACIA.nome}<small>acompanhamento hidrológico da bacia</small></div></a><nav class="menu"><a href="../index.html" class="outras">Bacias</a>${nav}</nav>${carimbo}</div>`;
  // a barra é fixa: o índice das seções gruda logo abaixo dela e as âncoras descontam a mesma altura
  // altura fracionária (116,33 px, por exemplo) deixaria uma fresta entre as duas barras: 1 px de sobreposição
  const medir = () => document.documentElement.style.setProperty('--h-topo',
    (getComputedStyle(el).position === 'sticky' ? Math.max(0, el.getBoundingClientRect().height - 1) : 0) + 'px');
  medir();
  if (window.ResizeObserver) new ResizeObserver(medir).observe(el);
  else window.addEventListener('resize', medir);
}
function montarRodape(status) {
  const c = (status && status.citacoes) || {};
  document.getElementById('rodape').innerHTML = `<div class="interno">
    <p><b>Painel técnico não oficial.</b> Não é produto da Agência Nacional de Águas e Saneamento Básico nem do ONS. Os dados são brutos, sem consistência, e podem ser revisados pelas fontes. O painel exibe dado e regra; não conclui descumprimento.</p>
    <p>Fontes: ${c.ons_ho || 'ONS, Dados Abertos (base horária)'}; ${c.ons_di || 'ONS, Dados Abertos (base diária)'}; ${c.telemetria || 'ANA, webservice de telemetria'}; ${c.merge || 'INPE/CPTEC, MERGE'}; ${c.mlt || ''}.</p>
    <p>${BACIA.rodape_regras || ''} Código e dados: <a href="https://github.com/dlpena/paineis-bacias">github.com/dlpena/paineis-bacias</a>.</p>
    <p><a href="fontes.html">Fontes, método e avisos</a></p></div>`;
}
async function iniciar(ativo) {
  let status = null;
  try { status = await carregar('status.json'); } catch (e) { console.warn(e); }
  montarTopo(ativo, status);
  montarRodape(status);
  return status;
}

/* Plotly */
function layoutBase(extra = {}) {
  const lay = Object.assign({
    font: { family: 'Questrial, Century Gothic, sans-serif', size: 12, color: '#1F2937' },
    paper_bgcolor: '#fff', plot_bgcolor: '#fff', margin: { l: 64, r: extra.yaxis2 ? 70 : 16, t: extra.showlegend === false ? 24 : 56, b: 40 },
    separators: ',.', // decimal com vírgula, milhar com ponto: 10.000 em vez de 10k
    hovermode: 'x unified', showlegend: true,
    legend: { orientation: 'h', y: 1, yanchor: 'bottom', x: 0, font: { size: 11 } }, // legenda na margem superior, fora da área de plotagem
    xaxis: { gridcolor: PAL.grade, zeroline: false, hoverformat: '%d/%m %H:%M' },
    yaxis: { gridcolor: PAL.grade, zeroline: false, fixedrange: false, autorange: true },
  }, extra);
  // eixos de vazão (m³/s) sem abreviação; título do eixo secundário afastado dos números
  for (const k of ['yaxis', 'yaxis2']) {
    const ax = lay[k]; if (!ax) continue;
    if (ax.title && /m³\/s/.test(String(ax.title.text || ax.title))) { ax.tickformat = ',d'; ax.hoverformat = ',.0f'; }
    if (ax.title && typeof ax.title === 'string') ax.title = { text: ax.title, standoff: k === 'yaxis2' ? 12 : 8 };
  }
  return lay;
}
// O "responsive" do Plotly só reage a resize da janela. Quando a largura do contêiner muda sem isso
// (barra de rolagem que aparece depois do primeiro desenho, seções que abrem), o gráfico fica mais largo
// que o cartão e os rótulos da direita saem cortados. O observador redimensiona pelo contêiner.
if (window.Plotly && window.ResizeObserver) {
  const obs = new ResizeObserver(es => es.forEach(e => {
    const g = e.target, w = e.contentRect.width;
    if (g._fullLayout && w > 0 && Math.abs(w - g._fullLayout.width) > 1) Plotly.Plots.resize(g);
  }));
  for (const f of ['newPlot', 'react']) {
    const orig = Plotly[f];
    Plotly[f] = function (gd, ...resto) {
      const el = typeof gd === 'string' ? document.getElementById(gd) : gd;
      return orig.call(this, gd, ...resto).then(r => { if (el) obs.observe(el); return r; });
    };
  }
}
const CONFIG_PLOT = { responsive: true, displaylogo: false, locale: 'pt-BR', modeBarButtonsToRemove: ['lasso2d', 'select2d'],
                      toImageButtonOptions: { format: 'png', scale: 2 } };
// lado: 'direita' (outorga) ou 'esquerda' (declarado ao ONS), para os rótulos de linhas próximas não se sobreporem
function linhaLimite(y, texto, cor = PAL.limite, tracado = 'dash', lado = 'direita') {
  // lado: 'esquerda', 'centro', 'direita' ou uma fração da largura (0 a 1), para afastar rótulos de linhas próximas
  const num = typeof lado === 'number';
  const x = num ? lado : ({ esquerda: 0, centro: 0.5, direita: 1 }[lado] ?? 1), anc = num ? 'center' : ({ esquerda: 'left', centro: 'center', direita: 'right' }[lado] || 'right');
  return { shape: { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: y, y1: y, line: { color: cor, width: 1.5, dash: tracado } },
           ann: { xref: 'paper', x, y: y, text: texto, showarrow: false, xanchor: anc, yanchor: 'bottom', font: { size: 10, color: cor }, bgcolor: 'rgba(255,255,255,.7)' } };
}
// cor das regras de resolução da ANA (faixas de operação), distinta da outorga (vermelho) e do FSAR-H (laranja)
const COR_RESOLUCAO = '#7B3FA0';
function traco(x, y, nome, cor, extra = {}) { return Object.assign({ x, y, name: nome, type: 'scatter', mode: 'lines', line: { color: cor, width: 1.6 }, connectgaps: false }, extra); }
function recorte(x, arrays, dias) {
  if (!dias || !x.length) return { x, arrays };
  const lim = new Date(x[x.length - 1]); lim.setDate(lim.getDate() - dias);
  const i0 = Math.max(0, x.findIndex(t => new Date(t) >= lim));
  const c = a => a ? a.slice(i0) : a;
  const out = {}; for (const k in arrays) out[k] = c(arrays[k]);
  return { x: x.slice(i0), arrays: out };
}

/* sparkline SVG */
function spark(vals, cor = PAL.medio, w = 110, h = 26) {
  const v = vals.filter(x => x !== null);
  if (v.length < 2) return '';
  const mn = Math.min(...v), mx = Math.max(...v), r = (mx - mn) || 1;
  const pts = vals.map((x, i) => x === null ? null : `${(i / (vals.length - 1) * w).toFixed(1)},${(h - 2 - (x - mn) / r * (h - 4)).toFixed(1)}`).filter(Boolean).join(' ');
  return `<svg width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="${cor}" stroke-width="1.5"/></svg>`;
}

/* tabela ordenável */
function tabelaOrdenavel(tabela) {
  const ths = tabela.querySelectorAll('th');
  ths.forEach((th, i) => th.addEventListener('click', () => {
    const asc = th.dataset.ord !== 'asc';
    ths.forEach(t => delete t.dataset.ord); th.dataset.ord = asc ? 'asc' : 'desc';
    const linhas = Array.from(tabela.tBodies[0].rows);
    const val = tr => { const c = tr.cells[i]; const bruto = c.dataset.v ?? c.textContent; const n = parseFloat(bruto.replace(/\./g, '').replace(',', '.')); return Number.isNaN(n) ? bruto.toLowerCase() : n; };
    linhas.sort((a, b) => { const va = val(a), vb = val(b); if (va === vb) return 0; if (va === '' || va === '–') return 1; if (vb === '' || vb === '–') return -1; return (va > vb ? 1 : -1) * (asc ? 1 : -1); });
    linhas.forEach(l => tabela.tBodies[0].appendChild(l));
  }));
}

/* escala de cores para chuva (mm) */
function corChuva(mm, max) {
  if (mm === null || mm === undefined) return '#ddd';
  const t = Math.min(1, mm / (max || 1));
  const paradas = [[0, [246, 248, 251]], [.15, [128, 181, 225]], [.4, [1, 147, 222]], [.7, [41, 64, 134]], [1, [0, 0, 80]]];
  let a = paradas[0], b = paradas[paradas.length - 1];
  for (let i = 0; i < paradas.length - 1; i++) if (t >= paradas[i][0] && t <= paradas[i + 1][0]) { a = paradas[i]; b = paradas[i + 1]; break; }
  const f = (t - a[0]) / ((b[0] - a[0]) || 1);
  const c = a[1].map((x, i) => Math.round(x + (b[1][i] - x) * f));
  return `rgb(${c.join(',')})`;
}
