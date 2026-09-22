# -*- coding: utf-8 -*-
"""Zet de printbestanden uit Downloads/PUP om naar webformaat in ../assets.
Snijdt de 3 mm afloop eraf en verkleint. Draai opnieuw als de printset wijzigt:
    python tools/build_assets.py
"""
import os, glob, json
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

SRC = r'C:\Users\seube\Downloads\PUP'
FINAL = os.path.join(SRC, 'FINAL VERSION')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')
BLEED = 35  # 3 mm @ 300 dpi

def save(im, path, w, q=84):
    im = im.convert('RGB')
    h = round(im.height * w / im.width)
    im.resize((w, h), Image.LANCZOS).save(path, 'WEBP', quality=q, method=6)

def crop_bleed(im, b=BLEED):
    return im.crop((b, b, im.width - b, im.height - b))

def run():
    for d in ['city', 'pressure', 'action', 'escalation', 'role', 'overload', 'back', 'board']:
        os.makedirs(os.path.join(OUT, d), exist_ok=True)
    groups = [('1 City cards (56)', 'city', 520), ('3 Action cards (8)', 'action', 520),
              ('4 Escalation cards (6)', 'escalation', 520), ('6 Role cards (7)', 'role', 520),
              ('2 Pressure cards (56)', 'pressure', 760), ('7 Kaartruggen (4)', 'back', 400)]
    for folder, key, w in groups:
        for f in sorted(glob.glob(os.path.join(FINAL, folder, '*.png'))):
            name = os.path.basename(f)
            if name.startswith('_'):
                continue
            try:
                im = Image.open(f); im.load()
            except OSError:
                # 43_dhaka_klimaat in FINAL VERSION is afgekapt; zelfde kaart uit de losse Pressure-map
                alt = os.path.join(SRC, 'Pressure deck', 'Pressure kaarten 56', name)
                print('afgekapt, vervangen door', alt)
                im = Image.open(alt)
            save(crop_bleed(im), os.path.join(OUT, key, name[:-4] + '.webp'), w)
    # overbelasting: alleen in de repro-set (A7 met snijtekens, afloop binnen de A7)
    for f in sorted(glob.glob(os.path.join(SRC, 'PNG VOOR REPRO', '4 Overbelastingsdek', '*_A_voor.png'))):
        name = os.path.basename(f).replace('_A_voor', '')
        save(crop_bleed(Image.open(f), 36), os.path.join(OUT, 'overload', name[:-4] + '.webp'), 520)
    # speelbord: zes panelen aan elkaar, alleen het kaartdeel (de band eronder wordt digitaal)
    pan = os.path.join(FINAL, '5 Speelbord', '300dpi panelen')
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
