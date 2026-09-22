# -*- coding: utf-8 -*-
"""Zet de printset (Downloads/PUP/PNG VOOR REPRO) om naar webformaat in ../assets.
Snijdt de 3 mm afloop eraf en verkleint; de printbestanden zelf worden alleen gelezen.
Draai opnieuw als de printset wijzigt:
    python tools/build_assets.py
"""
import os, glob
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

REPRO = r'C:\Users\seube\Downloads\PUP\PNG VOOR REPRO'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')
BLEED = 35  # 3 mm @ 300 dpi, binnen de A7

def save(im, path, w, q=84):
    im = im.convert('RGB')
    h = round(im.height * w / im.width)
    im.resize((w, h), Image.LANCZOS).save(path, 'WEBP', quality=q, method=6)

def crop_bleed(im, b=BLEED):
    return im.crop((b, b, im.width - b, im.height - b))

def front(f, key, w):
    name = os.path.basename(f).replace('_A_voor', '')[:-4]
    save(crop_bleed(Image.open(f)), os.path.join(OUT, key, name + '.webp'), w)

def run():
    for d in ['city', 'pressure', 'action', 'escalation', 'role', 'overload', 'back', 'board']:
        os.makedirs(os.path.join(OUT, d), exist_ok=True)
    # spelersdek: city (01-56), action (A..), escalation (E..)
    for f in sorted(glob.glob(os.path.join(REPRO, '1 Spelersdek', '*_A_voor.png'))):
        b = os.path.basename(f)
        front(f, 'action' if b[0] == 'A' else 'escalation' if b[0] == 'E' else 'city', 520)
    for f in sorted(glob.glob(os.path.join(REPRO, '2 Rolkaarten', '*_A_voor.png'))):
        front(f, 'role', 520)
    for f in sorted(glob.glob(os.path.join(REPRO, '3 Pressure-dek', '*_A_voor.png'))):
        front(f, 'pressure', 760)
    for f in sorted(glob.glob(os.path.join(REPRO, '4 Overbelastingsdek', '*_A_voor.png'))):
        front(f, 'overload', 520)
    # ruggen: binnen een dek identiek, dus één per dek
    for folder, name, w in [('1 Spelersdek', 'rug_spelersdek', 400), ('2 Rolkaarten', 'rug_rol', 400),
                            ('3 Pressure-dek', 'rug_pressure', 560), ('4 Overbelastingsdek', 'rug_overbelasting', 400)]:
        f = sorted(glob.glob(os.path.join(REPRO, folder, '*_B_achter.png')))[0]
        save(crop_bleed(Image.open(f)), os.path.join(OUT, 'back', name + '.webp'), w)
    # speelbord: zes panelen aan elkaar, alleen het kaartdeel (de band eronder wordt digitaal)
    pan = os.path.join(REPRO, '5 Speelbord', '_alternatief PNG', '300dpi panelen')
    full = Image.new('RGB', (9992, 6685))
    for row, names in enumerate([['1a', '1b', '1c'], ['2a', '2b', '2c']]):
        x = 0
        for n in names:
            im = Image.open(os.path.join(pan, f'paneel_{n}.png')).convert('RGB')
            full.paste(im, (x, row * 3343)); x += im.width
    map_h = 4470
    save(full.crop((0, 0, 9992, map_h)), os.path.join(OUT, 'board', 'map.webp'), 3600, 80)
    save(full, os.path.join(OUT, 'board', 'board_full.webp'), 2400, 78)
    print('klaar; kaartdeel hoogte', map_h)

if __name__ == '__main__':
    run()
