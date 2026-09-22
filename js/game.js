// Spelregels van Planet Under Pressure, fysieke editie.
// Bron: PUP_spelregels.pdf (22-09-2026); hoofdstuknummers in de commentaren verwijzen daarnaar.
// De engine praat met het scherm via UI.* (ui.js); keuzes zijn promises.

let S = null;            // volledige spelstaat, JSON-serialiseerbaar
const UNDO = [];         // snapshots binnen de huidige beurt

class GameOver extends Error {}

// ── hulpfuncties ───────────────────────────────────────────────
const ADJ = {};
for (const id in CITIES) ADJ[id] = [];
for (const [a, b] of EDGES) { ADJ[a].push(b); ADJ[b].push(a); }

const CARD = {};
CITY_CARDS.forEach(c => CARD[c.id] = { ...c, kind: 'city' });
ACTION_CARDS.forEach(c => CARD[c.id] = { ...c, kind: 'action' });
ESCALATIONS.forEach(c => CARD[c.id] = { ...c, kind: 'escalation' });
PRESSURE_CARDS.forEach(c => CARD[c.id] = { ...c, kind: 'pressure' });
OVERLOADS.forEach(c => CARD[c.id] = { ...c, kind: 'overload' });

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cname = id => CITIES[id].name;
const cardName = id => { const c = CARD[id]; return c.kind === 'city' ? `${cname(c.city)} (${c.color})` : c.kind === 'pressure' ? `${cname(c.city)}: ${c.event}` : c.title; };
const cur = () => S.players[S.cur];
const total = id => COLORS.reduce((n, c) => n + S.cubes[id][c], 0);
const outOf = color => LIMITS.supply - S.supply[color];     // vakjes die leeg zijn
const zoneOf = id => CITIES[id].zone;
const overloadKey = zone => S.overload[zone] ? CARD[S.overload[zone]].key : null;
const hasRole = (p, r) => p.role === r;

function log(msg, cls = '') { S.log.push({ t: msg, c: cls, r: S.round }); if (S.log.length > 400) S.log.shift(); }

function lose(reason) {
  S.result = { win: false, reason };
  log('VERLOREN: ' + reason, 'bad');
  throw new GameOver(reason);
}
function checkWin() {
  if (COLORS.every(c => S.cured[c])) {
    S.result = { win: true, reason: 'Alle vier de doorbraken zijn gerealiseerd.' };
    log('GEWONNEN: alle vier de doorbraken!', 'good');
    throw new GameOver('win');
  }
}

// ── sporen ─────────────────────────────────────────────────────
function addOnrust(n, why) {
  if (!n) return;
  S.onrust = Math.max(0, S.onrust + n);
  log(`Onrust ${n > 0 ? '+' : ''}${n} (${why}) → ${S.onrust}`, n > 0 ? 'warn' : 'good');
  if (S.onrust >= LIMITS.onrust) lose(`het onrustspoor bereikt ${LIMITS.onrust}`);
}
function addEcon(n, why) {
  if (!n) return;
  const before = S.econ;
  S.econ = Math.max(0, Math.min(LIMITS.econ, S.econ + n));
  log(`Economie ${n > 0 ? '+' : ''}${n} (${why}) → ${S.econ}${S.econ - before !== n ? ' (begrensd)' : ''}`, n > 0 ? 'good' : 'warn');
}
// h8 atmosfeerstrip: n > 0 schuift de marker n vakjes naar rechts (slechter)
function moveAtmos(n, why) {
  if (!n) return;
  const from = S.atmos, to = Math.min(ATMOS.start, from - n);
  if (to === from) { log(`Atmosfeerstrip staat al op ${from} (${why})`); return; }
  S.atmos = Math.max(1, to);
  log(`Atmosfeerstrip ${n > 0 ? '−' : '+'}${Math.abs(from - to)} (${why}) → ${to < 1 ? 'voorbij 1' : to}`, n > 0 ? 'bad' : 'good');
  if (to < 1) lose('de atmosfeermarker moet voorbij vakje 1');
  // upkeep-strepen: alleen bij passeren naar rechts, elke keer opnieuw
  const passed = ATMOS.upkeep.filter(t => from >= t && to <= t - 1).length;
  if (passed) addEcon(-ATMOS.upkeepCost * passed, `upkeep-streep gepasseerd${passed > 1 ? ' (' + passed + 'x)' : ''}`);
}
const inRedZone = () => S.atmos <= ATMOS.redZone;

// ── blokjes (h7 uitbraken, h8 atmosfeerstrip) ─────────────────
function isProtected(id) {
  if (S.phase === 'setup') return false;   // pionnen komen pas na de begincrisis op het bord (h4 stap 5)
  return S.players.some(p => hasRole(p, 'preventie') && (p.city === id || ADJ[p.city].includes(id)));
}
// Plaatst n blokjes als één opdracht: binnen één ketting breekt elke stad max. één keer uit.
function placeCubes(id, color, n, ctx = {}) {
  const chain = new Set();
  for (let i = 0; i < n; i++) placeOne(id, color, ctx, chain);
}
function placeOne(id, color, ctx, chain) {
  if (isProtected(id)) { log(`Preventiespecialist: geen ${color} blokje in ${cname(id)}`, 'good'); return; }
  if (color === 'rood' && ctx.shield > 0) { ctx.shield--; log(`Emergency Adaptation voorkomt 1 rood blokje in ${cname(id)}`, 'good'); return; }
  if (chain.has(id)) return;
  if (S.cubes[id][color] >= 3) { outbreak(id, color, ctx, chain); return; }
  if (S.supply[color] <= 0) lose(`er moet een ${color} blokje worden gelegd, maar die kleur is op`);
  S.supply[color]--; S.cubes[id][color]++;
  S.flash[id] = true;
}
function outbreak(id, color, ctx, chain) {
  chain.add(id);
  if (S.buildings[id] === 'adaptatie' && !S.adaptUsed[id]) {
    S.adaptUsed[id] = true;
    log(`Adaptatiecentrum in ${cname(id)} vangt de uitbraak op: geen atmosfeerstrip, geen verspreiding`, 'good');
    return;
  }
  log(`UITBRAAK in ${cname(id)} (${color})`, 'bad');
  S.outbreaks = (S.outbreaks || 0) + 1;
  if (color === 'rood' && S.cured.rood) log('Klimaatdoorbraak: rode uitbraak schuift de atmosfeerstrip niet op', 'good');
  else moveAtmos(ATMOS.outbreak, 'uitbraak ' + cname(id));
  if (overloadKey(zoneOf(id)) === 'vertrouwensbreuk') addOnrust(1, 'Vertrouwensbreuk, uitbraak in de zone');
  for (const nb of ADJ[id]) placeOne(nb, color, ctx, chain);
}
function removeCubes(id, color, n, why) {
  const k = Math.min(n, S.cubes[id][color]);
  if (!k) return 0;
  S.cubes[id][color] -= k; S.supply[color] += k;
  log(`${k} ${color} blokje${k > 1 ? 's' : ''} weg uit ${cname(id)}${why ? ' (' + why + ')' : ''}`, 'good');
  return k;
}
function saneerderSweep(p) {
  if (!hasRole(p, 'saneerder')) return;
  for (const c of COLORS) if (S.cured[c] && S.cubes[p.city][c]) removeCubes(p.city, c, 9, 'Saneerder, kleur opgelost');
}
function movePawn(p, to) {
  p.city = to;
  saneerderSweep(p);
}

// ── decks ──────────────────────────────────────────────────────
function drawPressureTop() {
  if (!S.pressureDeck.length) {
    S.pressureDeck = shuffle(S.pressureDiscard); S.pressureDiscard = [];
    log('Pressure-dek op: aflegstapel geschud tot nieuw dek');
  }
  return S.pressureDeck.shift();
}
function drawOverloadCard() {
  if (!S.overDeck.length) { S.overDeck = shuffle(S.overDiscard); S.overDiscard = []; log('Overbelastingsdek op: aflegstapel geschud'); }
  return S.overDeck.shift();
}

// ── h9 regionale overbelasting ────────────────────────────────
function hotspots(zone) { return ZONES[zone].cities.filter(id => total(id) >= 2).length; }
async function checkOverloads() {
  for (const zone in ZONES) {
    const h = hotspots(zone);
    if (!S.overload[zone] && h >= 3) {
      const id = drawOverloadCard();
      S.overload[zone] = id;
      const c = CARD[id];
      log(`${ZONES[zone].label} OVERBELAST: ${c.title}`, 'bad');
      UI.render();
      await UI.showCard({ img: c.img, title: `${ZONES[zone].label} raakt overbelast`,
        text: `${h} steden in deze zone hebben 2 of meer blokjes. Het fiche gaat in het zonevak en deze kaart wordt omgedraaid.`, button: 'Uitvoeren' });
      if (c.key === 'vertrouwensbreuk') addOnrust(1, 'Vertrouwensbreuk, direct');
      if (c.key === 'ontruiming' && S.phase !== 'setup') await evacuate(zone);   // bij de opbouw staan er nog geen pionnen
      UI.render();
    } else if (S.overload[zone] && h <= 1) {
      log(`${ZONES[zone].label}: overbelasting voorbij (${CARD[S.overload[zone]].title} naar de aflegstapel)`, 'good');
      S.overDiscard.push(S.overload[zone]); S.overload[zone] = null;
    }
  }
}
async function evacuate(zone) {
  for (const p of S.players) {
    if (zoneOf(p.city) !== zone) continue;
    const outside = Object.keys(CITIES).filter(id => zoneOf(id) !== zone);
    const to = await UI.pickCity(`Regionale ontruiming: waar gaat ${p.name} (${ROLES[p.role].name}) heen? Kies een stad buiten de ${ZONES[zone].label}.`, outside, { suggest: ADJ[p.city].filter(n => zoneOf(n) !== zone) });
    movePawn(p, to);
    log(`${p.name} verlaat de zone naar ${cname(to)}`);
  }
}

// ── opbouw (h4) ────────────────────────────────────────────────
async function newGame(cfg) {
  S = {
    v: 2, cfg,
    players: cfg.players.map(p => ({ name: p.name, role: p.role, city: 'amsterdam', hand: [], slot: null })),
    cubes: Object.fromEntries(Object.keys(CITIES).map(id => [id, { rood: 0, groen: 0, zwart: 0, geel: 0 }])),
    supply: Object.fromEntries(COLORS.map(c => [c, LIMITS.supply])), boxed: 0,
    atmos: ATMOS.start, onrust: START.onrust, econ: START.econ,
    escDrawn: 0, escTotal: cfg.escalations, escRow: [],
    cured: { rood: false, groen: false, zwart: false, geel: false },
    buildings: {}, adaptUsed: {},
    playerDeck: [], playerDiscard: [], actionUsed: [], outOfGame: [],
    pressureDeck: shuffle(PRESSURE_CARDS.map(c => c.id)), pressureDiscard: [],
    overDeck: shuffle(OVERLOADS.map(c => c.id)), overDiscard: [],
    overload: Object.fromEntries(Object.keys(ZONES).map(z => [z, null])),
    cur: cfg.start, startPlayer: cfg.start, round: 1, turn: 0,
    phase: 'setup', actionsLeft: 4, turnFlags: {}, firstRedDone: false,
    log: [], flash: {}, result: null, outbreaks: 0,
  };
  UNDO.length = 0;
  log('Nieuw spel: ' + S.players.map(p => `${p.name} (${ROLES[p.role].name})`).join(', '));
  UI.render();
  try {
    // begincrisis: 3x3, 3x2, 3x1, compounds negeren
    const seq = [3, 3, 3, 2, 2, 2, 1, 1, 1];
    for (const n of seq) {
      const id = S.pressureDeck.shift(); const c = CARD[id];
      placeCubes(c.city, c.color, n);
      S.pressureDiscard.push(id);
      log(`Begincrisis: ${cname(c.city)} krijgt ${n} ${c.color}`);
      await checkOverloads();   // h4: een zone kan al tijdens de begincrisis overbelast raken
    }
    // spelersdek: 56 city + 8 action, delen, dan escalations inschudden
    const deck = shuffle([...CITY_CARDS.map(c => c.id), ...ACTION_CARDS.map(c => c.id)]);
    const per = HAND_START[S.players.length];
    for (const p of S.players) p.hand = deck.splice(0, per);
    const k = S.escTotal, piles = [];
    const base = Math.floor(deck.length / k), extra = deck.length % k;
    let pos = 0;
    for (let i = 0; i < k; i++) { const sz = base + (i < extra ? 1 : 0); piles.push(deck.slice(pos, pos + sz)); pos += sz; }
    // h4 stap 7: in elke stapel precies één Escalation, willekeurig welke, op een willekeurige plek
    const escs = shuffle(ESCALATIONS.map(e => e.id)).slice(0, k);
    piles.forEach((pl, i) => { pl.push(escs[i]); shuffle(pl); });
    // kleinste stapel onderop
    piles.sort((a, b) => b.length - a.length);
    S.playerDeck = piles.flat();
    log(`Spelersdek: ${S.playerDeck.length} kaarten in ${k} stapels (${piles.map(p => p.length).join('/')}), in elke stapel één Escalation`);
    S.phase = 'actions';
    await beginTurn(true);
  } catch (e) { handleErr(e); }
  UI.render(); save();
}

function handleErr(e) {
  if (e instanceof GameOver) { S.phase = 'over'; UI.render(); UI.gameOver(); save(); return; }
  console.error(e); UI.toast('Fout: ' + e.message);
}

// ── beurtverloop (h5) ──────────────────────────────────────────
async function beginTurn(first = false) {
  S.phase = 'actions'; S.actionsLeft = 4; S.turnFlags = {}; S.firstRedDone = false; S.flash = {};
  UNDO.length = 0;
  if (!first && S.cur === S.startPlayer) { S.round++; await roundStart(); }
  S.turn++;
  log(`— Beurt van ${cur().name} (${ROLES[cur().role].name}) —`, 'head');
  UI.render(); save();
}

async function roundStart() {
  log(`=== Rondestart ${S.round} ===`, 'head');
  if (Object.values(S.buildings).includes('knooppunt')) addEcon(2, 'Economisch & Sociaal Knooppunt');
  for (const [id, type] of Object.entries(S.buildings)) {
    if (type !== 'natuur') continue;
    let n = S.cured.groen ? 2 : 1;
    while (n-- > 0) {
      const opts = [id, ...ADJ[id]].filter(x => S.cubes[x].groen > 0);
      if (!opts.length) break;
      const pick = opts.length === 1 ? opts[0] : await UI.pickCity(`Natuurherstelzone in ${cname(id)}: uit welke stad gaat 1 groen blokje?`, opts);
      removeCubes(pick, 'groen', 1, 'Natuurherstelzone');
    }
  }
  for (const zone in ZONES) if (overloadKey(zone) === 'stilleramp') await silentDisaster(zone);
  if (S.econ <= 3) addOnrust(1, 'economie 3 of lager');
  await checkOverloads();
}

async function silentDisaster(zone) {
  const cs = ZONES[zone].cities;
  const min = Math.min(...cs.map(total));
  const opts = cs.filter(id => total(id) === min);
  const id = opts.length === 1 ? opts[0] : await UI.pickCity(`Stille ramp (${ZONES[zone].label}): gelijkspel, kies de stad met de minste blokjes.`, opts);
  // h10: het team kiest ook welke van de twee stadskleuren
  const col = await UI.choose('Stille ramp', `Welke kleur krijgt ${cname(id)}? Het team kiest een van de twee kleuren van deze stad.`,
    CITIES[id].colors.map(c => ({ label: COLOR_INFO[c].label, value: c, color: c })));
  log(`Stille ramp: 1 ${col} blokje in ${cname(id)}`, 'warn');
  placeCubes(id, col, 1);
}

// Speler klikt "Acties klaar": kaarten trekken en Pressure-fase
async function endActions() {
  if (S.phase !== 'actions') return;
  try {
    UNDO.length = 0;
    S.phase = 'draw'; UI.render();
    for (let i = 0; i < 2; i++) {
      if (!S.playerDeck.length) lose('er moeten kaarten getrokken worden, maar het spelersdek is op');
      const id = S.playerDeck.shift(); const c = CARD[id];
      if (c.kind === 'escalation') {
        log(`${cur().name} trekt ${c.title}!`, 'bad');
        await resolveEscalation(id);
      } else {
        cur().hand.push(id);
        log(`${cur().name} trekt ${cardName(id)}`);
        UI.render();
        await UI.showCard({ img: c.img, title: `${cur().name} trekt kaart ${i + 1} van 2`, button: 'Verder' });
      }
    }
    await enforceHandLimit(S.cur);
    await pressurePhase();
    S.cur = (S.cur + 1) % S.players.length;
    await beginTurn();
  } catch (e) { handleErr(e); }
  UI.render(); save();
}

async function pressurePhase() {
  S.phase = 'pressure'; S.firstRedDone = false;
  const n = TEMPO[S.escDrawn];
  log(`Pressure-fase: ${n} kaarten`, 'head');
  for (let i = 0; i < n; i++) {
    const id = drawPressureTop();
    await resolvePressure(id, i + 1, n);
    await checkOverloads();
    UI.render();
  }
}

// h7 afhandeling per kaart
async function resolvePressure(id, i, n) {
  const c = CARD[id]; const city = c.city; const zone = zoneOf(city);
  S.flash = {};
  UI.render();
  await UI.showCard({ img: c.img, landscape: true, title: `Pressure-kaart ${i} van ${n}`,
    text: `${cname(city)} (${ZONES[zone].label}): ${c.event}`, button: 'Afhandelen' });
  const ctx = { shield: 0 };
  if (c.color === 'rood') ctx.shield = await offerReaction('adapt', `Rode Pressure-kaart in ${cname(city)}. Emergency Adaptation spelen? (voorkomt max. 2 rode blokjes van deze kaart)`) ? 2 : 0;
  // compound eerst
  if (c.cp) {
    if (S.cured[c.color]) log(`Compound ${cname(city)} vervalt (doorbraak ${c.color})`);
    else if (c.cp.cond && S.cubes[city][c.cp.cond] < 1) log(`Compound ${cname(city)}: voorwaarde niet gehaald`);
    else {
      log(`COMPOUND ${cname(city)}: ${c.cp.text}`, 'warn');
      if (c.cp.eff === 'onrust') addOnrust(1, 'compound ' + cname(city));
      else if (c.cp.eff === 'supply') {
        if (S.supply[c.color] > 0) { S.supply[c.color]--; S.boxed++; log(`Bevoorrading ${c.color} −1: 1 blokje voorgoed terug in de doos`, 'bad'); }
      } else if (c.cp.where === 'self') placeCubes(city, c.cp.color, 1, ctx);
      else {
        const opts = ADJ[city].filter(x => CITIES[x].coast);
        if (opts.length) {
          const t = opts.length === 1 ? opts[0] : await UI.pickCity(`Compound: kies één verbonden kuststad voor 1 ${c.cp.color} blokje.`, opts);
          placeCubes(t, c.cp.color, 1, ctx);
          log(`Compound: 1 ${c.cp.color} blokje in ${cname(t)}`);
        } else log('Compound: geen verbonden kuststad');
      }
    }
  }
  // dan het blokje
  let k = 1; const why = [];
  if (overloadKey(zone) === 'standaard') { k++; why.push('overbelaste zone +1'); }
  if (c.color === 'rood' && !S.firstRedDone) {
    S.firstRedDone = true;
    if (inRedZone()) { k++; why.push('eerste rode kaart in de rode zone +1'); }
  }
  log(`${cname(city)} krijgt ${k} ${c.color}${why.length ? ' (' + why.join(', ') + ')' : ''}`);
  placeCubes(city, c.color, k, ctx);
  S.pressureDiscard.push(id);
}

// h11 Escalations
async function resolveEscalation(id) {
  const c = CARD[id];
  UI.render();
  await UI.showCard({ img: c.img, title: `${c.title}!`, text: 'Onmiddellijk uitvoeren: atmosfeerstrip 1 vakje op, de uitbarsting, dan de Pressure-aflegstapel geschud bovenop.', button: 'Afhandelen' });
  let skipBurst = false;
  // reactiekaarten vóór je begint
  if (await offerReaction('coalition', 'Escalation getrokken. Emergency Coalition spelen?')) {
    const ch = await UI.choose('Emergency Coalition', 'Kies 1:', [
      { label: 'Negeer de Legacy-stap', value: 'skip', note: 'Sla stap 2, de uitbarsting, helemaal over.' },
      { label: 'Verlaag de Cascade Track met 1', value: 'atmos', note: 'Schuif de atmosfeermarker 1 vakje terug.' }]);
    if (ch === 'skip') skipBurst = true; else moveAtmos(-1, 'Emergency Coalition');
  }
  S.adaptUsed = {};
  // 1 "Verhoog de Cascade Track met 1"
  moveAtmos(ATMOS.escalation, c.title);
  // 2 "Voer de bovenste Legacy-kaart uit" = de uitbarsting
  if (!skipBurst) {
    if (!S.pressureDeck.length) { S.pressureDeck = shuffle(S.pressureDiscard); S.pressureDiscard = []; }
    const b = S.pressureDeck.pop(); const bc = CARD[b];
    UI.render();
    await UI.showCard({ img: bc.img, landscape: true, title: 'Uitbarsting: onderste Pressure-kaart', text: `${cname(bc.city)} krijgt 2 ${bc.color} blokjes. Compound wordt genegeerd.`, button: 'Verder' });
    log(`Uitbarsting: ${cname(bc.city)} krijgt 2 ${bc.color}`, 'bad');
    placeCubes(bc.city, bc.color, 2);
    S.pressureDiscard.push(b);
  } else log('Uitbarsting overgeslagen (Emergency Coalition)', 'good');
  // 3 aflegstapel schudden en bovenop
  S.pressureDeck = [...shuffle(S.pressureDiscard), ...S.pressureDeck]; S.pressureDiscard = [];
  log('Pressure-aflegstapel geschud en bovenop het dek gelegd');
  // kaart op de rij naast het bord: die rij is de tempometer
  S.escDrawn++; S.escRow.push(id);
  log(`Escalation-rij: ${S.escDrawn} → ${TEMPO[S.escDrawn]} Pressure-kaarten per beurt`, 'warn');
  await checkOverloads();
  UI.render();
}

// Reactiekaarten: wie hem heeft (hand of beleidsmaker-slot) mag hem gratis spelen
async function offerReaction(key, question) {
  const holders = [];
  S.players.forEach((p, i) => {
    p.hand.forEach(id => { if (CARD[id].kind === 'action' && CARD[id].key === key) holders.push({ i, id, slot: false }); });
    if (p.slot && CARD[p.slot].key === key) holders.push({ i, id: p.slot, slot: true });
  });
  if (!holders.length) return false;
  const opts = holders.map((h, k) => ({ label: `Ja, ${S.players[h.i].name} speelt hem${h.slot ? ' (van de rolkaart)' : ''}`, value: k }));
  opts.push({ label: 'Nee, niet spelen', value: -1 });
  const ch = await UI.choose(CARD[holders[0].id].title, question, opts, { img: CARD[holders[0].id].img });
  if (ch === -1 || ch == null) return false;
  const h = holders[ch];
  consumeActionCard(S.players[h.i], h.id, h.slot);
  log(`${S.players[h.i].name} speelt ${CARD[h.id].title}`, 'good');
  return true;
}
function consumeActionCard(p, id, fromSlot) {
  if (fromSlot) { p.slot = null; S.outOfGame.push(id); }      // hergebruikt: daarna uit het spel
  else { p.hand.splice(p.hand.indexOf(id), 1); S.actionUsed.push(id); }
}

// h5 handlimiet 7
async function enforceHandLimit(pi) {
  const p = S.players[pi];
  while (p.hand.length > LIMITS.hand) {
    UI.render();
    const over = p.hand.length - LIMITS.hand;
    const ids = await UI.pickCards(`${p.name} heeft ${p.hand.length} kaarten (limiet ${LIMITS.hand}). Leg ${over} af, of kies één actiekaart om te spelen.`,
      p.hand, 1, over, { playable: true });
    if (ids.length === 1 && CARD[ids[0]].kind === 'action' && CARD[ids[0]].type === 'actie' && await UI.confirm(`${CARD[ids[0]].title} spelen in plaats van afleggen?`)) {
      await playActionEffect(p, ids[0], false, true);
      continue;
    }
    for (const id of ids) { p.hand.splice(p.hand.indexOf(id), 1); (CARD[id].kind === 'city' ? S.playerDiscard : S.actionUsed).push(id); log(`${p.name} legt ${cardName(id)} af (handlimiet)`); }
  }
}

// ── h6 acties ──────────────────────────────────────────────────
function snapshot() { UNDO.push(JSON.stringify(S)); if (UNDO.length > 30) UNDO.shift(); }
function undo() { if (!UNDO.length || S.phase !== 'actions') return; S = JSON.parse(UNDO.pop()); log('Actie ongedaan gemaakt'); UI.render(); save(); }

function travelCost(to) { return overloadKey(zoneOf(to)) === 'ontruiming' ? 2 : 1; }
function cityCardsIn(p) { return p.hand.filter(id => CARD[id].kind === 'city'); }
function cardFor(p, city) { return p.hand.find(id => CARD[id].kind === 'city' && CARD[id].city === city); }
function discard(p, id) { p.hand.splice(p.hand.indexOf(id), 1); S.playerDiscard.push(id); }
function othersHere(p) { return S.players.filter(q => q !== p && q.city === p.city); }
function cureNeed(p) { return hasRole(p, 'wetenschapper') ? CURE_CARDS_SCIENTIST : CURE_CARDS; }
function cureBuildingOk(color, b) { return b && BUILDINGS[b].cure.includes(color); }

// Beschikbaarheid per actie, voor de knoppen
function actionAvailability() {
  const p = cur(); const A = {};
  const here = p.city; const b = S.buildings[here];
  const left = S.actionsLeft;
  A.drive = left >= 1;
  A.direct = left >= 1 && cityCardsIn(p).length > 0;
  A.charter = left >= 1 && !!cardFor(p, here);
  A.shuttle = left >= 1 && !!b && Object.keys(S.buildings).length > 1;
  A.treat = left >= 1 && total(here) > 0;
  const extra = overloadKey(zoneOf(here)) === 'noodbegroting' ? 1 : 0;
  const needCard = hasRole(p, 'ingenieur') ? 0 : 1;
  A.build = left >= 1 && !b && S.econ >= COST.build && (needCard ? !!cardFor(p, here) : true) && cityCardsIn(p).length >= needCard + extra;
  A.share = left >= 1 && othersHere(p).length > 0 && (
    !!cardFor(p, here) || othersHere(p).some(q => cardFor(q, here)) || (hasRole(p, 'diplomaat') && cityCardsIn(p).length > 0));
  A.cure = left >= 1 && !!b && COLORS.some(c => !S.cured[c] && cureBuildingOk(c, b) && cityCardsIn(p).filter(id => CARD[id].color === c).length >= cureNeed(p));
  A.campaign = left >= 1 && S.onrust > 0 && (b === 'knooppunt' || S.econ >= COST.campaign);
  A.invest = left >= 1 && !!b && S.econ >= COST.invest;
  A.playCard = left >= 1 && (p.hand.some(id => CARD[id].kind === 'action' && CARD[id].type === 'actie') || (p.slot && CARD[p.slot].type === 'actie'));
  A.peek = b === 'onderzoek' && !S.turnFlags.peek && S.pressureDeck.length > 0;
  A.engFlight = hasRole(p, 'ingenieur') && left >= 1 && !!b && !S.turnFlags.engFlight && cityCardsIn(p).length > 0;
  A.dispatch = hasRole(p, 'coordinator') && left >= 1;
  A.retrieve = hasRole(p, 'beleidsmaker') && left >= 1 && !p.slot && S.actionUsed.length > 0;
  return A;
}

async function act(kind) {
  if (S.phase !== 'actions' || S.busy) return;
  S.busy = true;
  const before = JSON.stringify(S);
  let done = false;
  try {
    done = await ACTIONS[kind]();
    if (done) {
      UNDO.push(before); if (UNDO.length > 30) UNDO.shift();
      for (let i = 0; i < S.players.length; i++) await enforceHandLimit(i);
      await checkOverloads();
      checkWin();
    }
  } catch (e) { S.busy = false; handleErr(e); return; }
  S.busy = false;
  UI.render(); save();
}
function spend(n) { S.actionsLeft -= n; }

// Welke pion beweegt: de coördinator kan een andere pion kiezen
async function pickMover(verb) {
  const p = cur();
  if (!hasRole(p, 'coordinator') || S.players.length < 2) return p;
  const ch = await UI.choose(verb, 'Welke pion verplaats je? (Coördinator: andermans pion alsof het je eigen pion is.)',
    S.players.map((q, i) => ({ label: `${q.name} (${ROLES[q.role].name}) in ${cname(q.city)}`, value: i })), { cancel: true });
  return ch == null ? null : S.players[ch];
}

const ACTIONS = {
  async drive() {
    const m = await pickMover('Rijden'); if (!m) return false;
    const opts = ADJ[m.city].filter(to => travelCost(to) <= S.actionsLeft);
    const to = await UI.pickCity(`Rijden: kies een verbonden stad voor ${m.name}.`, opts, { cancel: true }); if (!to) return false;
    spend(travelCost(to)); movePawn(m, to); log(`${m.name} rijdt naar ${cname(to)}`); return true;
  },
  async direct() {
    const p = cur(); const m = await pickMover('Direct reizen'); if (!m) return false;
    const opts = [...new Set(cityCardsIn(p).map(id => CARD[id].city))].filter(c => c !== m.city && travelCost(c) <= S.actionsLeft);
    const to = await UI.pickCity('Direct reizen: leg de City Card af van de stad waar je heen wilt.', opts, { cancel: true }); if (!to) return false;
    discard(p, cardFor(p, to)); spend(travelCost(to)); movePawn(m, to); log(`${m.name} reist direct naar ${cname(to)}`); return true;
  },
  async charter() {
    const p = cur(); const m = await pickMover('Vrij reizen'); if (!m) return false;
    if (!cardFor(p, m.city)) { UI.toast(`Je hebt geen City Card van ${cname(m.city)}.`); return false; }
    const opts = Object.keys(CITIES).filter(c => c !== m.city && travelCost(c) <= S.actionsLeft);
    const to = await UI.pickCity(`Vrij reizen: leg ${cname(m.city)} af en kies een stad naar keuze.`, opts, { cancel: true }); if (!to) return false;
    discard(p, cardFor(p, m.city)); spend(travelCost(to)); movePawn(m, to); log(`${m.name} reist vrij naar ${cname(to)}`); return true;
  },
  async shuttle() {
    const m = await pickMover('Pendelen'); if (!m) return false;
    if (!S.buildings[m.city]) { UI.toast('Deze pion staat niet in een stad met een gebouw.'); return false; }
    const opts = Object.keys(S.buildings).filter(c => c !== m.city && travelCost(c) <= S.actionsLeft);
    const to = await UI.pickCity('Pendelen: kies een andere stad met een gebouw.', opts, { cancel: true }); if (!to) return false;
    spend(travelCost(to)); movePawn(m, to); log(`${m.name} pendelt naar ${cname(to)}`); return true;
  },
  async dispatch() {
    const opts = S.players.map((q, i) => ({ label: `${q.name} in ${cname(q.city)}`, value: i }));
    const i = await UI.choose('Coördinator', 'Welke pion zet je bij een andere pion?', opts, { cancel: true }); if (i == null) return false;
    const m = S.players[i];
    const targets = [...new Set(S.players.filter(q => q !== m).map(q => q.city))].filter(c => c !== m.city && travelCost(c) <= S.actionsLeft);
    const to = await UI.pickCity(`Zet ${m.name} in een stad waar al een pion staat.`, targets, { cancel: true }); if (!to) return false;
    spend(travelCost(to)); movePawn(m, to); log(`Coördinator zet ${m.name} naar ${cname(to)}`); return true;
  },
  async engFlight() {
    const p = cur();
    const opts = Object.keys(CITIES).filter(c => c !== p.city && travelCost(c) <= S.actionsLeft);
    const to = await UI.pickCity('Ingenieur: van je centrum naar een stad naar keuze. Daarna kies je welke kaart je aflegt.', opts, { cancel: true }); if (!to) return false;
    const ids = await UI.pickCards('Welke City Card leg je af?', cityCardsIn(p), 1, 1, { cancel: true }); if (!ids) return false;
    discard(p, ids[0]); spend(travelCost(to)); S.turnFlags.engFlight = true; movePawn(p, to);
    log(`Ingenieur reist van centrum naar ${cname(to)} (legt ${cardName(ids[0])} af)`); return true;
  },
  async treat() {
    const p = cur(); const here = p.city;
    const cols = COLORS.filter(c => S.cubes[here][c] > 0);
    const col = cols.length === 1 ? cols[0] : await UI.choose('Behandelen', `Welke kleur behandel je in ${cname(here)}?`,
      cols.map(c => ({ label: `${COLOR_INFO[c].label} (${S.cubes[here][c]})`, value: c, color: c })), { cancel: true });
    if (!col) return false;
    let n = 1, why = 'behandelen';
    if (S.cured[col]) { n = 9; why = 'behandelen, doorbraak: alle blokjes'; }
    else if (hasRole(p, 'saneerder')) { n = 9; why = 'Saneerder: alle blokjes'; }
    else if (S.buildings[here] === 'energie' && (col === 'rood' || col === 'zwart')) { n = 2; why = 'behandelen + Energietransitielocatie'; }
    spend(1); removeCubes(here, col, n, why); return true;
  },
  async build() {
    const p = cur(); const here = p.city; const zone = zoneOf(here);
    const types = Object.entries(BUILDINGS).map(([k, b]) => ({ label: b.name, value: k, icon: b.icon, note: b.effect }));
    const type = await UI.choose('Bouwen', `Welk gebouw plaats je in ${cname(here)}? (kost 2 economie${hasRole(p, 'ingenieur') ? '' : ' en de City Card van deze stad'})`, types, { cancel: true });
    if (!type) return false;
    let moveFrom = null;
    if (Object.keys(S.buildings).length >= MAX_BUILDINGS) {
      moveFrom = await UI.pickCity('Er liggen al 6 gebouwen. Welk gebouw verplaats je hierheen?', Object.keys(S.buildings), { cancel: true });
      if (!moveFrom) return false;
    }
    let extraCard = null;
    if (overloadKey(zone) === 'noodbegroting') {
      const pool = cityCardsIn(p).filter(id => hasRole(p, 'ingenieur') || id !== cardFor(p, here));
      const ids = await UI.pickCards('Noodbegroting: bouwen kost hier 1 stadskaart extra. Welke leg je af?', pool, 1, 1, { cancel: true });
      if (!ids) return false; extraCard = ids[0];
    }
    if (!hasRole(p, 'ingenieur')) discard(p, cardFor(p, here));
    if (extraCard) discard(p, extraCard);
    if (moveFrom) { delete S.buildings[moveFrom]; log(`Gebouw in ${cname(moveFrom)} verplaatst`); }
    S.buildings[here] = type; addEcon(-COST.build, 'bouwen');
    spend(1); log(`${p.name} bouwt ${BUILDINGS[type].name} in ${cname(here)}`, 'good'); return true;
  },
  async share() {
    const p = cur(); const here = p.city; const others = othersHere(p);
    const opts = [];
    for (const q of others) {
      const qi = S.players.indexOf(q);
      if (cardFor(p, here)) opts.push({ label: `Geef ${cname(here)} aan ${q.name}`, value: `give:${qi}:${cardFor(p, here)}` });
      if (cardFor(q, here)) opts.push({ label: `Neem ${cname(here)} van ${q.name}`, value: `take:${qi}:${cardFor(q, here)}` });
      if (hasRole(p, 'diplomaat') && cityCardsIn(p).length) opts.push({ label: `Diplomaat: geef een willekeurige stadskaart aan ${q.name}`, value: `dip:${qi}` });
    }
    const ch = await UI.choose('Kennis delen', 'Wat doe je?', opts, { cancel: true }); if (!ch) return false;
    const [kind, qi, cid] = ch.split(':'); const q = S.players[+qi];
    let id = cid;
    if (kind === 'dip') { const ids = await UI.pickCards(`Welke kaart geef je aan ${q.name}?`, cityCardsIn(p), 1, 1, { cancel: true }); if (!ids) return false; id = ids[0]; }
    const [from, to] = kind === 'take' ? [q, p] : [p, q];
    from.hand.splice(from.hand.indexOf(id), 1); to.hand.push(id);
    spend(1); log(`${from.name} geeft ${cardName(id)} aan ${to.name}`); return true;
  },
  async cure() {
    const p = cur(); const b = S.buildings[p.city]; const need = cureNeed(p);
    const cols = COLORS.filter(c => !S.cured[c] && cureBuildingOk(c, b) && cityCardsIn(p).filter(id => CARD[id].color === c).length >= need);
    const col = cols.length === 1 ? cols[0] : await UI.choose('Doorbraak', 'Welke doorbraak?', cols.map(c => ({ label: COLOR_INFO[c].cure, value: c, color: c })), { cancel: true });
    if (!col) return false;
    const pool = cityCardsIn(p).filter(id => CARD[id].color === col);
    const ids = pool.length === need ? pool : await UI.pickCards(`Kies ${need} ${col}e City Cards voor ${COLOR_INFO[col].cure}.`, pool, need, need, { cancel: true });
    if (!ids) return false;
    ids.forEach(id => discard(p, id));
    S.cured[col] = true; spend(1);
    log(`DOORBRAAK: ${COLOR_INFO[col].cure}!`, 'good');
    if (col === 'rood') { moveAtmos(-3, 'Klimaatdoorbraak'); addEcon(2, 'Klimaatdoorbraak'); log('Rode uitbraken schuiven de atmosfeerstrip voortaan niet meer op'); }
    if (col === 'zwart') addEcon(2, 'Schone transitie');
    if (col === 'geel') addOnrust(-2, 'Voedsel & land');
    if (col === 'groen') log('Natuurherstelzones verwijderen voortaan 2 groene blokjes per rondestart');
    S.players.forEach(saneerderSweep);
    UI.render();
    await UI.showCard({ title: COLOR_INFO[col].cure + ' gerealiseerd', text: 'Behandelen verwijdert voortaan alle blokjes van deze kleur met 1 actie, en compounds van deze kleur vervallen.', button: 'Verder', color: col });
    return true;
  },
  async campaign() {
    const free = S.buildings[cur().city] === 'knooppunt';
    if (!free) addEcon(-COST.campaign, 'campagne');
    spend(1); addOnrust(-1, 'campagne' + (free ? ' (gratis bij Knooppunt)' : '')); return true;
  },
  async invest() {
    if (!await UI.confirm(`Investeren: betaal ${COST.invest} economie. Onrust −2 en de atmosfeermarker 1 vakje terug.`)) return false;
    addEcon(-COST.invest, 'investeren'); addOnrust(-2, 'investeren'); moveAtmos(-1, 'investeren');
    spend(1); return true;
  },
  async peek() {
    const id = S.pressureDeck[0];
    S.turnFlags.peek = true;
    log(`${cur().name} bekijkt de bovenste Pressure-kaart (Onderzoekscentrum)`);
    await UI.showCard({ img: CARD[id].img, landscape: true, title: 'Bovenste Pressure-kaart (alleen bekijken)', button: 'Terugleggen' });
    return false; // gratis, geen undo-punt nodig
  },
  async retrieve() {
    const p = cur();
    const ids = await UI.pickCards('Beleidsmaker: welke afgelegde actiekaart leg je op je rolkaart?', S.actionUsed, 1, 1, { cancel: true });
    if (!ids) return false;
    S.actionUsed.splice(S.actionUsed.indexOf(ids[0]), 1); p.slot = ids[0];
    spend(1); log(`Beleidsmaker legt ${CARD[ids[0]].title} op de rolkaart`); return true;
  },
  async playCard() {
    const p = cur();
    const pool = p.hand.filter(id => CARD[id].kind === 'action' && CARD[id].type === 'actie');
    if (p.slot && CARD[p.slot].type === 'actie') pool.push(p.slot);
    const ids = await UI.pickCards('Welke actiekaart speel je? (kost 1 actie)', pool, 1, 1, { cancel: true });
    if (!ids) return false;
    const ok = await playActionEffect(p, ids[0], ids[0] === p.slot && !p.hand.includes(ids[0]), false);
    if (ok) spend(1);
    return ok;
  },
};

// h12 action-kaarten (teksten staan op de kaart)
async function playActionEffect(p, id, fromSlot, free) {
  const c = CARD[id]; const all = Object.keys(CITIES);
  const choose = (opts) => UI.choose(c.title, 'Kies 1:', opts, { img: c.img, cancel: !free });
  let ok = false;
  switch (c.key) {
    case 'leak': {
      const ch = await choose([{ label: 'Verwijder 2 zwarte blokjes uit 1 stad', value: 1 }, { label: 'Verwijder 1 zwart blokje uit 2 verbonden steden', value: 2 }]);
      if (ch === 1) { const t = await UI.pickCity('Uit welke stad 2 zwarte blokjes?', all.filter(x => S.cubes[x].zwart > 0), { cancel: !free }); if (t) { removeCubes(t, 'zwart', 2, c.title); ok = true; } }
      if (ch === 2) {
        const a = await UI.pickCity('Eerste stad (1 zwart blokje).', all.filter(x => S.cubes[x].zwart > 0), { cancel: !free });
        if (a) { const b = await UI.pickCity('Tweede, verbonden stad.', ADJ[a].filter(x => S.cubes[x].zwart > 0), { cancel: true }); removeCubes(a, 'zwart', 1, c.title); if (b) removeCubes(b, 'zwart', 1, c.title); ok = true; }
      }
      break;
    }
    case 'comms': {
      const ch = await choose([{ label: 'Beweeg het sociale spoor 1 stap richting Sociale Acceptatie', value: 1, note: 'onrust −1' },
        { label: 'Verwijder 2 protesttokens', value: 2, disabled: true, note: 'Vervalt: protesttokens bestaan niet in deze editie.' }]);
      if (ch === 1) { addOnrust(-1, c.title); ok = true; }
      break;
    }
    case 'bonds': {
      const ch = await choose([{ label: 'Economie +4', value: 1 }, { label: 'Bouw 1 gebouw gratis', value: 2, disabled: !!S.buildings[p.city], note: `in ${cname(p.city)}` }]);
      if (ch === 1) { addEcon(4, c.title); ok = true; }
      if (ch === 2) {
        const type = await UI.choose('Gratis gebouw', `Welk gebouw in ${cname(p.city)}?`, Object.entries(BUILDINGS).map(([k, b]) => ({ label: b.name, value: k, icon: b.icon })), { cancel: true });
        if (type) {
          if (Object.keys(S.buildings).length >= MAX_BUILDINGS) { const f = await UI.pickCity('Er liggen al 6 gebouwen. Welke verplaats je?', Object.keys(S.buildings)); delete S.buildings[f]; }
          S.buildings[p.city] = type; log(`Gratis ${BUILDINGS[type].name} in ${cname(p.city)}`, 'good'); ok = true;
        }
      }
      break;
    }
    case 'food': {
      const ch = await choose([{ label: 'Verwijder alle gele blokjes uit 1 stad', value: 1 }, { label: 'Verwijder 1 geel blokje uit elke stad in 1 systeemzone', value: 2 }]);
      if (ch === 1) { const t = await UI.pickCity('Welke stad?', all.filter(x => S.cubes[x].geel > 0), { cancel: !free }); if (t) { removeCubes(t, 'geel', 9, c.title); ok = true; } }
      if (ch === 2) {
        const z = await UI.choose(c.title, 'Welke systeemzone?', Object.entries(ZONES).map(([k, zz]) => ({ label: zz.label, value: k })), { cancel: !free });
        if (z) { ZONES[z].cities.forEach(x => removeCubes(x, 'geel', 1, c.title)); ok = true; }
      }
      break;
    }
    case 'airlift': {
      const i = await UI.choose(c.title, 'Welke speler verplaats je?', S.players.map((q, k) => ({ label: `${q.name} in ${cname(q.city)}`, value: k })), { img: c.img, cancel: !free });
      if (i != null) { const q = S.players[i]; const to = await UI.pickCity(`Naar welke stad gaat ${q.name}?`, all.filter(x => x !== q.city), { cancel: !free }); if (to) { movePawn(q, to); log(`${c.title}: ${q.name} naar ${cname(to)}`); ok = true; } }
      break;
    }
    case 'forecast': {
      const top = S.pressureDeck.slice(0, 3);
      const order = await UI.orderCards('Forecast Window: leg de bovenste 3 Pressure-kaarten terug in een volgorde naar keuze. Klik ze in de volgorde waarin ze getrokken worden.', top);
      S.pressureDeck.splice(0, top.length, ...order);
      log(`${c.title}: bovenste ${top.length} Pressure-kaarten herschikt`); ok = true;
      break;
    }
  }
  if (ok) { consumeActionCard(p, id, fromSlot); log(`${p.name} speelt ${c.title}`, 'good'); }
  return ok;
}

// ── spelleider: handmatig corrigeren tijdens playtest ─────────
function gmAdjust(key, d) {
  const [min, max] = { atmos: [1, ATMOS.start], onrust: [0, LIMITS.onrust], econ: [0, LIMITS.econ], escDrawn: [0, 6], actionsLeft: [0, 8] }[key];
  S[key] = Math.max(min, Math.min(max, S[key] + d));
  log(`Spelleider: ${key} → ${S[key]}`, 'gm'); UI.render(); save();
}
function gmCube(id, color, d) {
  if (d > 0 && S.supply[color] > 0 && S.cubes[id][color] < 3) { S.supply[color]--; S.cubes[id][color]++; }
  if (d < 0 && S.cubes[id][color] > 0) { S.supply[color]++; S.cubes[id][color]--; }
  log(`Spelleider: ${cname(id)} ${color} → ${S.cubes[id][color]}`, 'gm'); UI.render(); save();
}

// ── opslaan ───────────────────────────────────────────────────
function save() {
  if (!S || S.busy) return;
  try { localStorage.setItem('pup-digitaal-save', JSON.stringify(S)); } catch (e) { /* privévenster */ }
}
function loadSaved() {
  try { const t = localStorage.getItem('pup-digitaal-save'); const s = t ? JSON.parse(t) : null; return s && s.v === 2 ? s : null; } catch (e) { return null; }
}
function resume(state) {
  S = state; S.busy = false;
  if (S.phase !== 'over') S.phase = 'actions';   // opgeslagen wordt alleen tussen acties
  UNDO.length = 0; UI.render();
}
