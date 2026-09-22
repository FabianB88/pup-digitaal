# -*- coding: utf-8 -*-
"""Genereert js/data.js uit de ontwerpbestanden (pressure.json, network.py) en de assetnamen."""
import os, json, re, glob, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import network as N

def slug(name):
    t = name.lower().replace('ã', 'a').replace('ï', 'i').replace(' ', '-')
    return {'addis-abeba': 'addis-abeba'}.get(t, t)

COLOR = {'klimaat': 'rood', 'eco': 'groen', 'transitie': 'zwart', 'voedsel': 'geel'}
DISPLAY = {c: c.title().replace('Ão', 'ão').replace('Ïr', 'ïr') for c in N.COORD}
DISPLAY.update({'SÃO PAULO': 'São Paulo', 'CAÏRO': 'Caïro', 'MEXICO-STAD': 'Mexico-Stad',
                'NEW YORK': 'New York', 'ADDIS ABEBA': 'Addis Abeba'})
# steden aan zee, voor compounds met "verbonden kuststad" (interpretatie, niet in de printset vastgelegd)
COAST = {'ANCHORAGE', 'VANCOUVER', 'NEW YORK', 'HOUSTON', 'AMSTERDAM', 'ISTANBUL', 'CASABLANCA',
         'LAGOS', 'KARACHI', 'BANGKOK', 'SINGAPORE', 'SHANGHAI', 'TOKIO', 'MANILA', 'JAKARTA', 'SYDNEY'}
POS = json.load(open(os.path.join(HERE, 'citypos.json'), encoding='utf8'))

cities = {}
for z, d in N.ZONES.items():
    for c in d['cities']:
        cities[slug(c)] = {'name': DISPLAY[c], 'zone': z, 'coast': c in COAST, 'pos': POS[c], 'colors': []}
edges = [[slug(a), slug(b)] for a, b in N.EDGES]
zones = {z: {'label': d['label'], 'color': d['color'], 'cities': [slug(c) for c in d['cities']]}
         for z, d in N.ZONES.items()}

def parse_cp(txt):
    if not txt:
        return None
    t = txt
    cp = {'text': t}
    m = re.match(r'Als .+? al 1\+ (\w+) heeft', t)
    cp['cond'] = m.group(1) if m else None
    if 'onrustspoor' in t:
        cp['eff'] = 'onrust'
    elif 'bevoorrading' in t:
        cp['eff'] = 'supply'
    else:
        m = re.search(r'1 (\w+) blokje', t)
        cp['eff'] = 'place'; cp['color'] = m.group(1)
        cp['where'] = 'coast' if 'kuststad' in t else 'self'
    return cp

pj = json.load(open(os.path.join(HERE, 'pressure.json'), encoding='utf8'))
pressure = []
for c in pj['cards']:
    f = '%02d_%s_%s' % (c['n'], slug(c['city']), c['cat'])
    assert os.path.exists(os.path.join(HERE, '..', 'assets', 'pressure', f + '.webp')), f
    pressure.append({'id': 'p%02d' % c['n'], 'city': slug(c['city']), 'color': COLOR[c['cat']],
                     'event': c['ev'], 'img': 'assets/pressure/%s.webp' % f, 'cp': parse_cp(c.get('cp'))})

city_cards = []
for f in sorted(glob.glob(os.path.join(HERE, '..', 'assets', 'city', '*.webp'))):
    b = os.path.basename(f)[:-5]
    n, city, cat = b.split('_')
    city_cards.append({'id': 'c' + n, 'city': city, 'color': COLOR[cat], 'img': 'assets/city/' + b + '.webp'})
    cities[city]['colors'].append(COLOR[cat])

out = {'CITIES': cities, 'EDGES': edges, 'ZONES': zones, 'PRESSURE_CARDS': pressure, 'CITY_CARDS': city_cards}
with open(os.path.join(HERE, '..', 'js', 'data.gen.js'), 'w', encoding='utf8') as fh:
    fh.write('// GEGENEREERD door tools/build_data.py, niet met de hand bewerken\n')
    for k, v in out.items():
        fh.write('const %s = %s;\n' % (k, json.dumps(v, ensure_ascii=False)))
from collections import Counter
print(Counter(c['color'] for c in city_cards), Counter(c['color'] for c in pressure), len(edges))
print([ (k,v['colors']) for k,v in cities.items() if len(v['colors'])!=2])
