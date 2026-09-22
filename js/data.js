// Vaste spelgegevens die niet uit de ontwerpbestanden gegenereerd worden.
// Teksten komen letterlijk van de gedrukte kaarten en uit PUP_spelregels.pdf (22-09-2026).

const COLORS = ['rood', 'groen', 'zwart', 'geel'];
const COLOR_INFO = {
  rood:  { hex: '#C4442C', label: 'Rood',  crisis: 'Klimaatimpact',    cure: 'Klimaatdoorbraak' },
  groen: { hex: '#5C9440', label: 'Groen', crisis: 'Ecologische druk', cure: 'Ecologisch herstel' },
  zwart: { hex: '#2B2F33', label: 'Zwart', crisis: 'Vervuiling',       cure: 'Schone transitie' },
  geel:  { hex: '#D69A22', label: 'Geel',  crisis: 'Voedsel & land',   cure: 'Voedsel & land' },
};

const BUILDINGS = {
  onderzoek: { name: 'Onderzoekscentrum', icon: 'flask-conical', cure: ['rood'],
               effect: 'Wie hier staat, mag één keer per beurt gratis de bovenste Pressure-kaart bekijken.' },
  energie:   { name: 'Energietransitielocatie', icon: 'zap', cure: ['zwart'],
               effect: 'Rood of zwart behandelen hier verwijdert 1 blokje extra.' },
  natuur:    { name: 'Natuurherstelzone', icon: 'trees', cure: ['groen'],
               effect: 'Bij de rondestart: verwijder 1 groen blokje hier of in een verbonden stad.' },
  adaptatie: { name: 'Adaptatiecentrum', icon: 'shield', cure: ['geel'],
               effect: 'Vangt de eerste uitbraak in deze stad per Escalation op: geen atmosfeerstrip, geen verspreiding.' },
  knooppunt: { name: 'Economisch & Sociaal Knooppunt', icon: 'landmark', cure: ['geel'],
               effect: 'Economie +2 bij de rondestart (één keer, ongeacht het aantal). Campagne is hier gratis.' },
};
const MAX_BUILDINGS = 6;

const ACTION_CARDS = [
  { id: 'a1', key: 'leak',     title: 'Rapid Leak Repair',          type: 'actie',   img: 'assets/action/A01_rapid-leak-repair.webp' },
  { id: 'a2', key: 'coalition',title: 'Emergency Coalition',        type: 'reactie', img: 'assets/action/A02_emergency-coalition.webp' },
  { id: 'a3', key: 'comms',    title: 'Public Communication Surge', type: 'actie',   img: 'assets/action/A03_public-communication-surge.webp' },
  { id: 'a4', key: 'bonds',    title: 'Green Bonds Package',        type: 'actie',   img: 'assets/action/A04_green-bonds-package.webp' },
  { id: 'a5', key: 'food',     title: 'Strategic Food Release',     type: 'actie',   img: 'assets/action/A05_strategic-food-release.webp' },
  { id: 'a6', key: 'airlift',  title: 'Global Airlift',             type: 'actie',   img: 'assets/action/A06_global-airlift.webp' },
  { id: 'a7', key: 'forecast', title: 'Forecast Window',            type: 'actie',   img: 'assets/action/A07_forecast-window.webp' },
  { id: 'a8', key: 'adapt',    title: 'Emergency Adaptation',       type: 'reactie', img: 'assets/action/A08_emergency-adaptation.webp' },
];

const ESCALATIONS = ['i', 'ii', 'iii', 'iv', 'v', 'vi'].map((r, i) => ({
  id: 'e' + (i + 1), title: 'Escalation ' + r.toUpperCase(),
  img: `assets/escalation/E0${i + 1}_escalation-${r}.webp`,
}));
// Pressure-kaarten per beurt na 0..6 getrokken Escalations
const TEMPO = [2, 2, 2, 3, 3, 3, 4];

const ROLES = {
  wetenschapper: { name: 'Klimaatwetenschapper', color: '#2E8C7A', icon: 'flask-conical', img: 'assets/role/R01_wetenschapper.webp',
                   short: 'Doorbraken kosten je 4 kaarten in plaats van 5.' },
  coordinator:   { name: 'Coördinator', color: '#3A6FB0', icon: 'network', img: 'assets/role/R02_coordinator.webp',
                   short: 'Je verplaatst andermans pion.' },
  saneerder:     { name: 'Saneerder', color: '#B23A2E', icon: 'spray-can', img: 'assets/role/R03_saneerder.webp',
                   short: 'Je ruimt in één keer op.' },
  diplomaat:     { name: 'Diplomaat', color: '#8250B0', icon: 'handshake', img: 'assets/role/R04_diplomaat.webp',
                   short: 'Je geeft elke kaart weg.' },
  ingenieur:     { name: 'Ingenieur', color: '#C28A12', icon: 'cog', img: 'assets/role/R05_ingenieur.webp',
                   short: 'Je bouwt zonder kaart.' },
  beleidsmaker:  { name: 'Beleidsmaker', color: '#3F7A3A', icon: 'file-text', img: 'assets/role/R06_beleidsmaker.webp',
                   short: 'Je hergebruikt één actiekaart.' },
  preventie:     { name: 'Preventiespecialist', color: '#2D7FA0', icon: 'shield-check', img: 'assets/role/R07_preventie.webp',
                   short: 'Je houdt de druk buiten de deur.' },
};

const OVERLOADS = [
  ...[1, 2, 3, 4, 5, 6].map(n => ({ id: 'o0' + n, key: 'standaard', title: 'Overbelaste regio',
      img: `assets/overload/O0${n}_overbelaste-regio.webp`,
      short: 'Elke Pressure-kaart in deze zone legt +1 blokje.' })),
  { id: 'o07', key: 'noodbegroting', title: 'Noodbegroting', img: 'assets/overload/O07_noodbegroting.webp',
    short: 'Bouwen in deze zone kost 1 stadskaart extra.' },
  { id: 'o08', key: 'vertrouwensbreuk', title: 'Vertrouwensbreuk', img: 'assets/overload/O08_vertrouwensbreuk.webp',
    short: 'Direct onrust +1. Elke uitbraak in deze zone: onrust +1 extra.' },
  { id: 'o09', key: 'stilleramp', title: 'Stille ramp', img: 'assets/overload/O09_stille-ramp.webp',
    short: 'Bij elke rondestart 1 blokje in de stad van deze zone met de minste blokjes.' },
  { id: 'o10', key: 'ontruiming', title: 'Regionale ontruiming', img: 'assets/overload/O10_regionale-ontruiming.webp',
    short: 'Direct: alle pionnen de zone uit. Reizen naar deze zone kost 2 acties.' },
];

const BACKS = {
  speler: 'assets/back/rug_spelersdek.webp', pressure: 'assets/back/rug_pressure.webp',
  overload: 'assets/back/rug_overbelasting.webp', rol: 'assets/back/rug_rol.webp',
};

// h8 atmosfeerstrip: telt af van 20 naar 1; voorbij 1 is verloren
const ATMOS = { start: 20, outbreak: 2, escalation: 1, redZone: 8, upkeep: [17, 13, 9, 5], upkeepCost: 2 };
// upkeep-streep t ligt tussen vakje t en t-1
const LIMITS = { onrust: 12, econ: 15, supply: 24, hand: 7 };
const START = { onrust: 4, econ: 8 };
const COST = { build: 2, campaign: 1, invest: 4 };
const CURE_CARDS = 5, CURE_CARDS_SCIENTIST = 4;
const HAND_START = { 2: 4, 3: 3, 4: 2 };

const PLAYER_NAMES = ['Speler 1', 'Speler 2', 'Speler 3', 'Speler 4'];

// kant van het stadslabel op het bord (uit layout.py); blokjes komen aan de andere kant
const LABEL_DIR = {
  'anchorage': 's', 'vancouver': 'w', 'new-york': 'ne', 'houston': 'sw', 'mexico-stad': 'sw', 'manaus': 'n', 'sao-paulo': 'se',
  'amsterdam': 'nw', 'warschau': 'ne', 'istanbul': 'e', 'casablanca': 'sw', 'cairo': 'e', 'riyad': 's',
  'lagos': 'sw', 'addis-abeba': 'e', 'kinshasa': 'sw', 'nairobi': 'e', 'johannesburg': 's',
  'karachi': 'se', 'delhi': 'n', 'dhaka': 'ne', 'bangkok': 'e', 'singapore': 'sw',
  'shanghai': 'e', 'tokio': 'ne', 'manila': 'e', 'jakarta': 'sw', 'sydney': 's',
};
// positie van het overbelastingsvak (gestippelde cirkel in het zonelabel), in % van de kaart
const ZONE_SLOT = { amerikaanse: [17.25, 57.34], mediterrane: [47.0, 26.04], afrikaanse: [56.2, 84.17], indische: [76.3, 73.66], pacifische: [86.75, 92.66] };
