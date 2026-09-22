// Scherm: tekent de staat S en levert de keuze-dialogen waar game.js op wacht.

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = n => `<i data-lucide="${n}"></i>`;
const icons = () => window.lucide && lucide.createIcons();

// richting → waar de stapel naast de knoop komt (tegenover het label)
const OPP = { s: [0, -1], n: [0, 1], e: [-1, 0], w: [1, 0], ne: [-1, 1], nw: [1, 1], se: [-1, -1], sw: [1, -1] };

const UI = {
  pick: null,   // actieve stadkeuze {valid:Set, suggest:Set, resolve}
  gm: false,

  // ── tekenen ────────────────────────────────────────────────
  render() {
    if (!S) return;
    document.body.classList.toggle('gm', UI.gm);
    $('#btnGM').classList.toggle('on', UI.gm);
    UI.renderStatus(); UI.renderBoard(); UI.renderBand(); UI.renderTurn(); UI.renderPlayers(); UI.renderLog();
    icons();
  },

  renderStatus() {
    const p = cur();
    $('#status').innerHTML = `<span>Ronde <b>${S.round}</b></span><span>Beurt: <b style="color:${ROLES[p.role].color}">${esc(p.name)}</b></span>
      <span>Atmosfeer <b style="color:${inRedZone() ? 'var(--bad)' : 'inherit'}">${S.atmos}</b></span>
      <span>Tempo <b>${TEMPO[S.escDrawn]}</b> per beurt</span><span>Escalations <b>${S.escDrawn}/${S.escTotal}</b></span>
      <span>Doorbraken <b>${COLORS.filter(c => S.cured[c]).length}/4</b></span>`;
  },

  renderBoard() {
    let h = '';
    const pick = UI.pick;
    for (const id in CITIES) {
      const [x, y] = CITIES[id].pos;
      const cls = ['node'];
      if (pick && pick.valid.has(id)) cls.push('valid');
      if (pick && pick.suggest.has(id)) cls.push('suggest');
      if (UI.gm && !pick) cls.push('gm');
      if (S.flash && S.flash[id]) cls.push('flash');
      const t = COLORS.filter(c => S.cubes[id][c]).map(c => `${S.cubes[id][c]} ${c}`).join(', ');
      // paneel aan de stad vast: pionnen en gebouw, daaronder elk blokje los (zoals op tafel)
      const pawns = S.players.map((p, i) => p.city === id ? `<span class="pawn ${i === S.cur ? 'me' : ''}" style="background:${ROLES[p.role].color}" title="${esc(p.name)}"></span>` : '').join('');
      const b = S.buildings[id];
      const cubes = COLORS.filter(c => S.cubes[id][c]).map(c => `<div class="row">${`<span class="cube ${c}"></span>`.repeat(S.cubes[id][c])}</div>`).join('');
      const full = COLORS.some(c => S.cubes[id][c] >= 3);
      if (pawns || b || cubes) cls.push('occ');
      h += `<button class="${cls.join(' ')}" style="left:${x}%;top:${y}%" data-city="${id}" title="${esc(CITIES[id].name)}${t ? ': ' + t : ''}"></button>`;
      if (!pawns && !b && !cubes) continue;
      // blokjes liggen óp de stad, zoals op tafel; pionnen en gebouw als kopje erboven
      const top = pawns || b ? `<div class="row top">${pawns}${b ? `<span class="bld" title="${esc(BUILDINGS[b].name)}">${icon(BUILDINGS[b].icon)}</span>` : ''}</div>` : '';
      const [dx, dy] = OPP[LABEL_DIR[id]] || [0, 1];   // een paar pixels weg van de stadsnaam, maar op de stad
      h += `<div class="stack ${full ? 'full' : ''} ${cubes ? '' : 'nocubes'}" style="--zc:${ZONES[CITIES[id].zone].color};left:calc(${x}% + ${dx * 7}px);top:calc(${y}% + ${dy * 7}px)">
        ${top}${cubes ? `<div class="cubes">${cubes}</div>` : ''}</div>`;
    }
    for (const z in ZONES) {
      const [x, y] = ZONE_SLOT[z];
      if (S.overload[z]) {
        const c = CARD[S.overload[z]];
        h += `<button class="ovl" style="left:${x}%;top:${y}%" data-zoom="${c.img}" title="${esc(c.title)}: ${esc(c.short)}">${icon('triangle-alert')}</button>`;
      } else {
        h += `<span class="zonecount" style="left:${x}%;top:${y}%" title="steden met 2+ blokjes">${hotspots(z)}</span>`;
      }
    }
    $('#overlay').innerHTML = h;
  },

  cells(vals, val, colorAt, cls = () => '') {
    return `<div class="cells">${vals.map(i => `<i class="${i === val ? 'mark on' : ''} ${cls(i)}" style="background:${colorAt(i)}${i === val ? '' : '44'}">${i}</i>`).join('')}</div>`;
  },
  gmBtns(key) { return `<span class="gmbtn"><button data-gm="${key}" data-d="-1">−</button><button data-gm="${key}" data-d="1">+</button></span>`; },

  // h3: de drie sporen onderaan het bord, in dezelfde kleuren
  renderBand() {
    const range = (a, b) => Array.from({ length: Math.abs(b - a) + 1 }, (_, k) => a < b ? a + k : a - k);
    const atmosCol = i => i <= ATMOS.redZone ? '#A8321E' : '#2A4A63';
    const onrustCol = i => i <= 4 ? '#3E7F3A' : i <= 8 ? '#8A7A1E' : '#B02E18';
    const econCol = i => i <= 3 ? '#A8321E' : i <= 7 ? '#8A7A1E' : '#3E7F3A';
    const upk = i => ATMOS.upkeep.includes(i + 1) ? 'upk' : '';
    const tr = (lbl, key, vals, col, cls) => `<div class="track"><span class="lbl">${lbl} ${UI.gmBtns(key)}</span>${UI.cells(vals, S[key], col, cls)}<span class="val">${S[key]}</span></div>`;
    const deck = (lbl, img, n, w, top, land) => `<div class="deck"><div class="pile">${n || top
      ? `<img src="${top || img}" style="width:${w}px" ${top ? `data-zoom="${top}"` : ''} alt="">${n ? `<span class="n">${n}</span>` : ''}`
      : `<div class="empty" style="width:${w}px;aspect-ratio:${land ? '99/68' : '68/99'}">leeg</div>`}</div>${lbl}</div>`;
    const lastP = S.pressureDiscard[S.pressureDiscard.length - 1];
    const lastD = S.playerDiscard[S.playerDiscard.length - 1];
    const lastO = S.overDiscard[S.overDiscard.length - 1];
    $('#band').innerHTML = `
      <div class="blk wide"><div class="h">SPOREN</div>
        ${tr('ATMOSFEER', 'atmos', range(20, 1), atmosCol, upk)}
        <div class="legend">Uitbraak −2 · Escalation −1 · gouden streep passeren: economie −2 · rode zone (8 en lager): eerste rode Pressure-kaart per fase +1 blokje · voorbij 1: verloren.</div>
        ${tr('ONRUST', 'onrust', range(0, LIMITS.onrust), onrustCol)}
        <div class="legend">Links sociale acceptatie, rechts onrust · verlies bij ${LIMITS.onrust}.</div>
        ${tr('ECONOMIE', 'econ', range(0, LIMITS.econ), econCol)}
        <div class="legend">Bouwen ${COST.build} · campagne ${COST.campaign} · investeren ${COST.invest} · 3 of lager bij de rondestart: onrust +1.</div>
      </div>
      <div class="blk"><div class="h">ESCALATION-RIJ ${UI.gmBtns('escDrawn')}</div>
        <div class="escrow">${Array.from({ length: S.escTotal }, (_, i) => S.escRow[i]
          ? `<img src="${CARD[S.escRow[i]].img}" data-zoom="${CARD[S.escRow[i]].img}" alt="${esc(CARD[S.escRow[i]].title)}">`
          : `<span class="slot">${i + 1}</span>`).join('')}</div>
        <div class="tempo">${[[0, 2, '0-2'], [3, 5, '3-5'], [6, 6, '6']].map(([a, b, l]) => `<span class="${S.escDrawn >= a && S.escDrawn <= b ? 'on' : ''}">${l}<b>${TEMPO[a]}</b></span>`).join('')}</div>
        <div class="legend">Afgehandelde Escalations → Pressure-kaarten per beurt.</div>
        <div class="h" style="margin-top:12px">BLOKJES NAAST HET BORD</div>
        <div class="supply">${COLORS.map(c => `<div class="sup ${S.supply[c] <= 4 ? 'low' : ''}"><span class="cube ${c}"></span><b>${S.supply[c]}</b><small>/${LIMITS.supply}</small></div>`).join('')}</div>
        <div class="legend">Is een kleur op en moet er toch een blokje bij: verloren.${S.boxed ? ` ${S.boxed} blokje${S.boxed > 1 ? 's' : ''} voorgoed in de doos.` : ''}</div>
        <div class="h" style="margin-top:12px">DOORBRAKEN</div>
        <div class="cures">${COLORS.map(c => `<div class="cure ${S.cured[c] ? 'done' : ''}" style="${S.cured[c] ? `background:${COLOR_INFO[c].hex}` : ''}">${icon(S.cured[c] ? 'badge-check' : 'circle-dashed')} ${COLOR_INFO[c].cure}</div>`).join('')}</div>
      </div>
      <div class="blk"><div class="h">KAARTEN</div>
        <div class="decks">
          ${deck('SPELERSDEK', BACKS.speler, S.playerDeck.length, 62)}
          ${deck('AFLEG', null, S.playerDiscard.length, 62, lastD && CARD[lastD].img)}
          ${deck('PRESSURE', BACKS.pressure, S.pressureDeck.length, 110, null, true)}
          ${deck('AFLEG', null, S.pressureDiscard.length, 110, lastP && CARD[lastP].img, true)}
          ${deck('OVERBELASTING', BACKS.overload, S.overDeck.length, 62)}
          ${deck('AFLEG', null, S.overDiscard.length, 62, lastO && CARD[lastO].img)}
        </div>
        <div class="legend">Gebouwen ${Object.keys(S.buildings).length}/${MAX_BUILDINGS} · uitbraken dit spel ${S.outbreaks || 0}
        ${S.actionUsed.length ? `<br>Gebruikte actiekaarten: ${S.actionUsed.map(id => `<a href="#" data-zoom="${CARD[id].img}" style="color:var(--gold)">${esc(CARD[id].title)}</a>`).join(', ')}` : ''}</div>
      </div>`;
  },

  renderTurn() {
    const p = cur(); const r = ROLES[p.role];
    if (S.phase === 'over') {
      $('#turnPanel').innerHTML = `<div class="phase" style="color:${S.result.win ? 'var(--good)' : 'var(--bad)'}">${S.result.win ? 'GEWONNEN' : 'VERLOREN'}<br><small style="color:var(--ink)">${esc(S.result.reason)}</small></div>
        <button class="primary" id="btnAgain">${icon('rotate-ccw')} Nieuw spel</button>`;
      return;
    }
    const A = S.phase === 'actions' && !S.busy ? actionAvailability() : {};
    const b = (k, ic, lbl, cls = '') => `<button data-act="${k}" class="${cls}" ${A[k] ? '' : 'disabled'}>${icon(ic)}${lbl}</button>`;
    let roleBtns = '';
    if (p.role === 'coordinator') roleBtns += b('dispatch', 'move', 'Pion naar pion', 'role');
    if (p.role === 'ingenieur') roleBtns += b('engFlight', 'plane-takeoff', 'Centrum → stad', 'role');
    if (p.role === 'beleidsmaker') roleBtns += b('retrieve', 'archive-restore', 'Actiekaart terug', 'role');
    const here = S.buildings[p.city];
    $('#turnPanel').innerHTML = `
      <div class="who"><span class="dot" style="background:${r.color}">${icon(r.icon)}</span>
        <div><div class="nm">${esc(p.name)}</div><div class="rl">${r.name} · in ${esc(cname(p.city))}${here ? ' · ' + BUILDINGS[here].name : ''}</div></div>
        <div class="pips" title="acties over">${[0, 1, 2, 3].map(i => `<i class="${i < S.actionsLeft ? 'on' : ''}"></i>`).join('')}</div></div>
      ${S.phase === 'actions' ? `
      <div class="acts">
        ${b('drive', 'car', 'Rijden')}${b('direct', 'plane', 'Direct reizen')}
        ${b('charter', 'send', 'Vrij reizen')}${b('shuttle', 'arrow-left-right', 'Pendelen')}
        ${b('treat', 'eraser', 'Behandelen')}${b('build', 'hammer', 'Bouwen')}
        ${b('share', 'users', 'Kennis delen')}${b('cure', 'badge-check', 'Doorbraak')}
        ${b('campaign', 'megaphone', here === 'knooppunt' ? 'Campagne (gratis)' : `Campagne (${COST.campaign} econ)`)}${b('invest', 'coins', `Investeren (${COST.invest})`)}
        ${b('playCard', 'layers', 'Actiekaart spelen')}${roleBtns}
        ${b('peek', 'eye', 'Bekijk Pressure (gratis)', 'free')}
      </div>
      <button class="primary" id="btnEnd">${icon('arrow-right')} ${S.actionsLeft ? `Klaar (${S.actionsLeft} over): ` : ''}trek 2 kaarten</button>
      <div class="row2"><button class="ghost" id="btnUndo" ${UNDO.length ? '' : 'disabled'}>${icon('undo-2')} Ongedaan maken</button></div>`
      : `<div class="phase">${S.phase === 'draw' ? 'Kaarten trekken…' : S.phase === 'pressure' ? 'Pressure-fase…' : 'Bezig…'}</div>`}`;
  },

  // handen onder het bord, op leesbaar formaat; handen zijn open (coöperatief)
  renderPlayers() {
    const order = id => { const c = CARD[id]; return c.kind === 'city' ? COLORS.indexOf(c.color) * 100 + +c.id.slice(1) : 1000; };
    $('#hands').innerHTML = S.players.map((p, i) => {
      const r = ROLES[p.role];
      const hand = [...p.hand].sort((a, b) => order(a) - order(b));
      const count = COLORS.map(c => [c, p.hand.filter(id => CARD[id].kind === 'city' && CARD[id].color === c).length]).filter(([, n]) => n);
      const need = cureNeed(p);
      return `<div class="pl ${i === S.cur ? 'active' : ''}">
        <div class="top"><span class="dot" style="background:${r.color}">${icon(r.icon)}</span><b>${esc(p.name)}</b>
          <span class="rl">${r.name} · in ${esc(cname(p.city))}</span>
          <span class="cnt">${count.map(([c, n]) => `<span class="chip ${n >= need && !S.cured[c] ? 'ready' : ''}" title="${n} ${c}e kaarten, doorbraak kost er ${need}"><span class="cube ${c}"></span>${n}</span>`).join('')}</span>
          <small>${p.hand.length}/${LIMITS.hand}</small></div>
        <div class="hand">
          <figure class="role"><img src="${r.img}" data-zoom="${r.img}" alt="${r.name}"><figcaption>rol</figcaption></figure>
          ${p.slot ? `<figure class="role"><img src="${CARD[p.slot].img}" data-zoom="${CARD[p.slot].img}" alt="${esc(CARD[p.slot].title)}"><figcaption>op de rolkaart</figcaption></figure>` : ''}
          ${hand.map(id => `<img src="${CARD[id].img}" data-zoom="${CARD[id].img}" alt="${esc(cardName(id))}" title="${esc(cardName(id))}">`).join('') || '<span class="none">geen kaarten</span>'}
        </div>
      </div>`;
    }).join('');
  },

  renderLog() {
    const el = $('#log');
    el.innerHTML = S.log.slice(-160).map(l => `<li class="${l.c}">${esc(l.t)}</li>`).join('');
    el.scrollTop = el.scrollHeight;
  },

  // ── dialogen (geven promises terug) ────────────────────────
  modal(html) { const m = $('#modal'); m.innerHTML = `<div class="dlg">${html}</div>`; m.hidden = false; icons(); return m; },
  close() { $('#modal').hidden = true; $('#modal').innerHTML = ''; },

  showCard({ img, title, text, button = 'Verder', landscape, color }) {
    return new Promise(res => {
      const m = UI.modal(`<h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}
        ${img ? `<img class="cardimg ${landscape ? 'landscape' : 'portrait'}" src="${img}" alt="">` : ''}
        ${color ? `<div class="cure done" style="background:${COLOR_INFO[color].hex};margin:10px 0;font-size:16px;padding:14px">${COLOR_INFO[color].cure}</div>` : ''}
        <div class="opts"><button id="mOk" style="justify-content:center;background:var(--gold);color:#111;border:0">${esc(button)}</button></div>`);
      const ok = m.querySelector('#mOk'); ok.focus();
      ok.onclick = () => { UI.close(); res(); };
    });
  },

  choose(title, text, options, { img, cancel } = {}) {
    return new Promise(res => {
      const m = UI.modal(`<h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}
        ${img ? `<img class="cardimg portrait" style="height:min(340px,40vh)" src="${img}" alt="">` : ''}
        <div class="opts">${options.map((o, i) => `<button data-i="${i}" ${o.disabled ? 'disabled' : ''}>
          ${o.color ? `<span class="sw" style="background:${COLOR_INFO[o.color].hex}"></span>` : ''}${o.icon ? icon(o.icon) : ''}
          <span>${esc(o.label)}${o.note ? `<small>${esc(o.note)}</small>` : ''}</span></button>`).join('')}
          ${cancel ? `<button class="cancel" data-i="-1">Annuleren</button>` : ''}</div>`);
      m.querySelectorAll('[data-i]').forEach(bt => bt.onclick = () => { UI.close(); const i = +bt.dataset.i; res(i < 0 ? null : options[i].value); });
    });
  },

  confirm(text) {
    return UI.choose('Bevestigen', text, [{ label: 'Ja', value: true }, { label: 'Nee', value: false }]);
  },

  pickCards(title, ids, min, max, { cancel } = {}) {
    return new Promise(res => {
      const sel = new Set();
      const draw = () => {
        const m = UI.modal(`<h2>${esc(title)}</h2><p>Kies ${min === max ? min : `${min} tot ${max}`} kaart${max > 1 ? 'en' : ''}.</p>
          <div class="pickgrid">${ids.map(id => `<div class="pc ${sel.has(id) ? 'sel' : ''} ${CARD[id].kind === 'pressure' ? 'land' : ''}" data-id="${id}"><img src="${CARD[id].img}" alt="${esc(cardName(id))}" title="${esc(cardName(id))}"></div>`).join('')}</div>
          <div class="opts"><button id="pcOk" ${sel.size >= min && sel.size <= max ? '' : 'disabled'} style="justify-content:center">Bevestigen (${sel.size})</button>
          ${cancel ? `<button class="cancel" id="pcNo">Annuleren</button>` : ''}</div>`);
        m.querySelectorAll('.pc').forEach(el => el.onclick = () => {
          const id = el.dataset.id;
          if (sel.has(id)) sel.delete(id); else { if (max === 1) sel.clear(); if (sel.size < max) sel.add(id); }
          draw();
        });
        m.querySelector('#pcOk').onclick = () => { UI.close(); res([...sel]); };
        if (cancel) m.querySelector('#pcNo').onclick = () => { UI.close(); res(null); };
      };
      draw();
    });
  },

  orderCards(title, ids) {
    return new Promise(res => {
      const order = [];
      const draw = () => {
        const m = UI.modal(`<h2>Forecast Window</h2><p>${esc(title)}</p>
          <div class="pickgrid">${ids.map(id => `<div class="pc land ${order.includes(id) ? 'sel' : ''}" data-id="${id}">${order.includes(id) ? `<span class="ord">${order.indexOf(id) + 1}</span>` : ''}<img src="${CARD[id].img}" alt="${esc(cardName(id))}"></div>`).join('')}</div>
          <div class="opts"><button id="ocOk" ${order.length === ids.length ? '' : 'disabled'} style="justify-content:center">Terugleggen</button>
          <button class="cancel" id="ocReset">Opnieuw kiezen</button></div>`);
        m.querySelectorAll('.pc').forEach(el => el.onclick = () => { if (!order.includes(el.dataset.id)) order.push(el.dataset.id); draw(); });
        m.querySelector('#ocOk').onclick = () => { UI.close(); res(order); };
        m.querySelector('#ocReset').onclick = () => { order.length = 0; draw(); };
      };
      draw();
    });
  },

  pickCity(question, valid, { cancel, suggest } = {}) {
    return new Promise(res => {
      if (!valid.length) { UI.toast('Geen geldige stad om te kiezen.'); res(null); return; }
      UI.pick = { valid: new Set(valid), suggest: new Set(suggest || []), resolve: id => { UI.pick = null; $('#pickBar').hidden = true; UI.render(); res(id); } };
      const bar = $('#pickBar');
      bar.innerHTML = `<div class="q">${icon('map-pin')} ${esc(question)}</div>` +
        valid.slice().sort((a, b) => cname(a).localeCompare(cname(b))).map(id => `<button data-pick="${id}">${esc(cname(id))}</button>`).join('') +
        (cancel ? `<button class="cancel" data-pick="">Annuleren</button>` : '');
      bar.hidden = false;
      UI.render();
      $('#left').scrollTop = 0;
    });
  },

  toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(UI._tt); UI._tt = setTimeout(() => t.hidden = true, 3200);
  },

  zoom(img) { const z = $('#zoom'); z.innerHTML = `<img src="${img}" alt="">`; z.hidden = false; },

  gameOver() {
    UI.render();
    const r = S.result;
    UI.modal(`<h2 style="color:${r.win ? 'var(--good)' : 'var(--bad)'}">${r.win ? 'Gewonnen!' : 'Verloren'}</h2>
      <p>${esc(r.reason)}</p>
      <p style="color:var(--muted)">Ronde ${S.round} · ${S.outbreaks || 0} uitbraken · atmosfeerstrip ${S.atmos} · onrust ${S.onrust} · economie ${S.econ} · Escalations ${S.escDrawn} · doorbraken ${COLORS.filter(c => S.cured[c]).length}/4 · spelersdek nog ${S.playerDeck.length}</p>
      <div class="opts"><button id="goClose" style="justify-content:center">Bord bekijken</button><button id="goNew" style="justify-content:center;background:var(--gold);color:#111">Nieuw spel</button></div>`);
    $('#goClose').onclick = UI.close;
    $('#goNew').onclick = () => { UI.close(); UI.setup(); };
  },

  // GM: blokjes in een stad aanpassen
  gmCity(id) {
    const draw = () => {
      const m = UI.modal(`<h2>Spelleider: ${esc(cname(id))}</h2><p>Corrigeer blokjes handmatig (van/naar de voorraad naast het bord, geen uitbraken).</p>
        <div class="opts">${COLORS.map(c => `<div style="display:flex;gap:8px;align-items:center"><span class="sw" style="width:18px;height:18px;border-radius:3px;background:${COLOR_INFO[c].hex};border:1px solid #fff"></span>
          <span style="flex:1">${COLOR_INFO[c].label}: <b>${S.cubes[id][c]}</b></span>
          <button data-c="${c}" data-d="-1" style="width:40px;justify-content:center">−</button><button data-c="${c}" data-d="1" style="width:40px;justify-content:center">+</button></div>`).join('')}
          <button id="gmBld">Gebouw: ${S.buildings[id] ? BUILDINGS[S.buildings[id]].name : 'geen'} (wijzigen)</button>
          <button id="gmPawn">Pion van huidige speler hierheen zetten</button>
          <button class="cancel" id="gmX">Sluiten</button></div>`);
      m.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { gmCube(id, b.dataset.c, +b.dataset.d); draw(); });
      m.querySelector('#gmX').onclick = UI.close;
      m.querySelector('#gmPawn').onclick = () => { cur().city = id; log(`Spelleider: ${cur().name} naar ${cname(id)}`, 'gm'); UI.close(); UI.render(); save(); };
      m.querySelector('#gmBld').onclick = async () => {
        const t = await UI.choose('Gebouw', cname(id), [{ label: 'Geen gebouw', value: 'none' }, ...Object.entries(BUILDINGS).map(([k, b]) => ({ label: b.name, value: k, icon: b.icon }))], { cancel: true });
        if (t === 'none') delete S.buildings[id]; else if (t) S.buildings[id] = t;
        if (t) log(`Spelleider: gebouw ${cname(id)} → ${t}`, 'gm');
        UI.render(); save(); draw();
      };
    };
    draw();
  },

  rules() {
    UI.modal(`<div class="rules"><h2>Spiekbrief</h2>
      <p style="color:var(--muted)">Samengevat uit PUP_spelregels.pdf. Bij twijfel wint het gedrukte materiaal.</p>
      <h3>BEURT</h3><ul><li>4 acties · 2 kaarten trekken (Escalation direct afhandelen, uit het spel, geen vervanger) · Pressure-fase.</li><li>Tempo volgens de Escalation-rij: 0-2 = 2 kaarten, 3-5 = 3, 6 = 4. Handlimiet 7.</li></ul>
      <h3>RONDESTART (startspeler weer aan de beurt)</h3><ul><li>Minstens één Knooppunt: economie +2 (één keer).</li><li>Natuurherstelzones: 1 groen weg hier of in een verbonden stad (2 na Ecologisch herstel).</li><li>Stille ramp uitvoeren.</li><li>Economie 3 of lager: onrust +1.</li><li>Per zone: overbelasting aan of uit.</li></ul>
      <h3>ACTIES</h3><ul><li>Rijden · direct reizen · vrij reizen · pendelen · behandelen · kennis delen.</li><li>Bouwen: City Card van je stad + ${COST.build} economie, max. 1 per stad en 6 op het bord.</li><li>Campagne: ${COST.campaign} economie (gratis bij een Knooppunt), onrust −1.</li><li>Investeren: in een stad met gebouw, ${COST.invest} economie, onrust −2 en atmosfeermarker 1 vakje terug.</li><li>Doorbraak: ${CURE_CARDS} City Cards van één kleur (Klimaatwetenschapper ${CURE_CARDS_SCIENTIST}) bij het juiste gebouw.</li></ul>
      <h3>PRESSURE-KAART</h3><ul><li>Compound eerst (vervalt na de doorbraak van de kaartkleur), dan 1 blokje.</li><li>+1 in een zone met Overbelaste regio. Eerste rode kaart per fase in de rode zone (8 of lager): +1.</li><li>4e blokje van één kleur = uitbraak: atmosfeerstrip −2, elke buur 1 blokje, ketting, elke stad max. één keer.</li></ul>
      <h3>ATMOSFEERSTRIP</h3><ul><li>Van 20 naar 1. Uitbraak −2, Escalation −1. Alleen Klimaatdoorbraak (+3), Investeren en Emergency Coalition (+1) halen hem terug.</li><li>Gouden streep (17|16, 13|12, 9|8, 5|4) passeren: economie −2, per streep.</li></ul>
      <h3>OVERBELASTING</h3><ul><li>Aan zodra 3 steden in een zone elk 2+ blokjes hebben (kleur maakt niet uit). Uit bij nog 1 of 0.</li></ul>
      <h3>ESCALATION</h3><ul><li>Reactiekaarten eerst. 1 Atmosfeerstrip −1 · 2 Uitbarsting: onderste Pressure-kaart, 2 blokjes, compound negeren · 3 Pressure-aflegstapel schudden, bovenop · kaart op de rij.</li></ul>
      <h3>DOORBRAKEN</h3><ul><li>Rood = Onderzoekscentrum: atmosfeer +3, economie +2, rode uitbraken tellen niet meer.</li><li>Zwart = Energietransitielocatie: economie +2.</li><li>Groen = Natuurherstelzone: natuurherstelzones ruimen 2 groen op.</li><li>Geel = Adaptatiecentrum of Knooppunt: onrust −2.</li></ul>
      <h3>VERLIES</h3><ul><li>Atmosfeermarker voorbij 1 · onrust op 12 · een kleur blokjes op · trekken uit een leeg spelersdek.</li></ul>
      <h3>KAARTTEKSTEN DIE ANDERS GELEZEN WORDEN</h3><ul>
        <li>"Cascade Track" = de atmosfeerstrip. "Legacy-kaart" = de uitbarsting.</li>
        <li>Public Communication Surge: de optie met protesttokens vervalt.</li>
        <li>"Verbonden kuststad": steden aan zee volgens de kaart (niet: São Paulo, Manaus, Mexico-Stad, Warschau, Caïro, Riyad, Addis Abeba, Kinshasa, Nairobi, Johannesburg, Delhi, Dhaka).</li></ul>
      <div class="opts" style="margin-top:14px"><button id="rX" style="justify-content:center">Sluiten</button></div></div>`);
    $('#rX').onclick = UI.close;
  },

  // ── startscherm ────────────────────────────────────────────
  setup() {
    const saved = loadSaved();
    const st = UI._cfg || { n: 2, names: [...PLAYER_NAMES], roles: ['wetenschapper', 'saneerder', 'coordinator', 'ingenieur'], esc: 4, start: 'random' };
    UI._cfg = st;
    const el = $('#setup');
    const draw = () => {
      el.innerHTML = `<div class="inner">
        <h1>PLANET<span>UNDER PRESSURE</span></h1>
        <p class="sub">Digitale playtest van de fysieke editie · spelregels van 22 september 2026 · alle kaarten uit de printset</p>
        <div class="grid">
          <div class="blk"><div class="h">SPELERS</div>
            <div class="seg">${[2, 3, 4].map(n => `<button data-n="${n}" class="${st.n === n ? 'on' : ''}">${n} spelers</button>`).join('')}</div>
            ${Array.from({ length: st.n }, (_, i) => `
              <label>Speler ${i + 1} · <span style="color:var(--cream)">${ROLES[st.roles[i]].name}</span>: ${ROLES[st.roles[i]].short}</label><input type="text" data-name="${i}" value="${esc(st.names[i])}">
              <div class="roles">${Object.entries(ROLES).map(([k, r]) => {
                const taken = st.roles.slice(0, st.n).some((x, j) => j !== i && x === k);
                return `<img src="${r.img}" data-p="${i}" data-role="${k}" class="${st.roles[i] === k ? 'on' : ''} ${taken ? 'taken' : ''}" alt="${r.name}" title="${r.name}: ${r.short}">`;
              }).join('')}</div>`).join('')}
            <div class="row2" style="margin-top:10px"><button class="ghost" id="rndRoles">${icon('shuffle')} Rollen trekken</button></div>
          </div>
          <div class="blk"><div class="h">OPBOUW</div>
            <label>Moeilijkheid (Escalations in het spelersdek)</label>
            <div class="seg">${[[4, 'Introductie'], [5, 'Standaard'], [6, 'Expert']].map(([n, l]) => `<button data-esc="${n}" class="${st.esc === n ? 'on' : ''}">${n} · ${l}</button>`).join('')}</div>
            <label>Startspeler</label>
            <select id="startSel"><option value="random">Willekeurig (wie het laatst iets duurzaams deed)</option>${Array.from({ length: st.n }, (_, i) => `<option value="${i}" ${String(st.start) === String(i) ? 'selected' : ''}>${esc(st.names[i])}</option>`).join('')}</select>
            <div class="legend" style="margin-top:12px">Handkaarten: ${HAND_START[st.n]} per speler. Atmosfeerstrip op 20, onrust op 4, economie op 8. ${LIMITS.supply} blokjes per kleur. Pionnen starten in Amsterdam.</div>
            <div class="legend">Het spelersdek wordt verdeeld in ${st.esc} ongeveer gelijke stapels met in elke stapel één Escalation, kleinste stapel onderop. Speel je eerste potjes met 4.</div>
          </div>
        </div>
        <div class="go">
          <button class="primary" id="goStart">${icon('play')} Start het spel</button>
          ${saved && saved.phase !== 'over' ? `<button class="ghost" id="goResume" style="justify-content:center">${icon('history')} Doorgaan met opgeslagen spel (ronde ${saved.round}, ${esc(saved.players.map(p => p.name).join(', '))})</button>` : ''}
          ${S ? `<button class="ghost" id="goBack" style="justify-content:center">Terug naar het huidige spel</button>` : ''}
        </div></div>`;
      el.hidden = false; icons();
      el.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { st.n = +b.dataset.n; if (+st.start >= st.n) st.start = 'random'; fixRoles(); draw(); });
      el.querySelectorAll('[data-esc]').forEach(b => b.onclick = () => { st.esc = +b.dataset.esc; draw(); });
      el.querySelectorAll('[data-name]').forEach(inp => inp.oninput = () => { st.names[+inp.dataset.name] = inp.value; });
      el.querySelectorAll('[data-role]').forEach(img => img.onclick = () => { if (img.classList.contains('taken')) return; st.roles[+img.dataset.p] = img.dataset.role; draw(); });
      $('#rndRoles').onclick = () => { const r = shuffle(Object.keys(ROLES)); for (let i = 0; i < 4; i++) st.roles[i] = r[i]; draw(); };
      $('#startSel').onchange = e => { st.start = e.target.value; };
      $('#goStart').onclick = () => {
        el.hidden = true;
        const start = st.start === 'random' ? Math.floor(Math.random() * st.n) : +st.start;
        newGame({ players: Array.from({ length: st.n }, (_, i) => ({ name: st.names[i].trim() || PLAYER_NAMES[i], role: st.roles[i] })), escalations: st.esc, start });
      };
      if ($('#goResume')) $('#goResume').onclick = () => { el.hidden = true; resume(saved); };
      if ($('#goBack')) $('#goBack').onclick = () => { el.hidden = true; };
    };
    const fixRoles = () => {
      const used = new Set();
      for (let i = 0; i < st.n; i++) {
        if (used.has(st.roles[i])) st.roles[i] = Object.keys(ROLES).find(k => !used.has(k));
        used.add(st.roles[i]);
      }
    };
    fixRoles(); draw();
  },
};

// ── klikken ──────────────────────────────────────────────────
document.addEventListener('click', e => {
  const z = e.target.closest('[data-zoom]');
  if (z) { e.preventDefault(); UI.zoom(z.dataset.zoom); return; }
  const pk = e.target.closest('[data-pick]');
  if (pk && UI.pick) { UI.pick.resolve(pk.dataset.pick || null); return; }
  const node = e.target.closest('.node');
  if (node) {
    const id = node.dataset.city;
    if (UI.pick) { if (UI.pick.valid.has(id)) UI.pick.resolve(id); return; }
    if (UI.gm && S) { UI.gmCity(id); return; }
    return;
  }
  const a = e.target.closest('[data-act]');
  if (a && !a.disabled) { act(a.dataset.act); return; }
  const g = e.target.closest('[data-gm]');
  if (g) { gmAdjust(g.dataset.gm, +g.dataset.d); return; }
  if (e.target.closest('#btnEnd')) {
    if (S.actionsLeft > 0) UI.confirm(`Je hebt nog ${S.actionsLeft} actie${S.actionsLeft > 1 ? 's' : ''} over. Toch kaarten trekken?`).then(ok => ok && endActions());
    else endActions();
    return;
  }
  if (e.target.closest('#btnUndo')) { undo(); return; }
  if (e.target.closest('#btnAgain')) { UI.setup(); return; }
});
$('#zoom').onclick = () => { $('#zoom').hidden = true; };
$('#btnRules').onclick = () => UI.rules();
$('#btnGM').onclick = () => { UI.gm = !UI.gm; UI.render(); if (UI.gm) UI.toast('Spelleider aan: klik een stad of gebruik de +/− bij de sporen.'); };
$('#btnNew').onclick = () => UI.setup();
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#zoom').hidden = true; });

// ?demo start direct een voorbeeldspel (handig om snel te kijken)
if (location.search.includes('demo')) {
  newGame({ players: [{ name: 'Fabian', role: 'saneerder' }, { name: 'Sam', role: 'ingenieur' }, { name: 'Noor', role: 'preventie' }], escalations: 5, start: 0 });
} else UI.setup();
icons();
