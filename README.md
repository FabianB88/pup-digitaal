# Planet Under Pressure: digitale playtest

Digitale versie van de **fysieke editie** (Handleiding fysieke editie v2), met alle kaarten en het bord uit de printset.
Hotseat voor 2 tot 4 spelers in één browser.

## Lokaal spelen
Dubbelklik `index.html`, of start een lokale server in deze map:

    python -m http.server 8795

en open http://localhost:8795. Voeg `?demo` toe aan de URL om meteen een voorbeeldspel te starten.
Het spel slaat zichzelf op in de browser; bij heropenen kun je doorgaan.

## Structuur
- `index.html`, `css/style.css`: pagina en opmaak
- `js/data.gen.js`: steden, verbindingen, City Cards en Pressure-kaarten (gegenereerd, niet bewerken)
- `js/data.js`: rollen, action-, Escalation- en overbelastingskaarten, gebouwen, startwaarden
- `js/game.js`: spelregels (hoofdstuknummers verwijzen naar de handleiding)
- `js/ui.js`: bord, sporen, handen, dialogen, startscherm
- `assets/`: webversies van de printbestanden (bleed eraf, verkleind naar WebP)
- `tools/`: scripts om assets en data opnieuw te maken uit `Downloads/PUP`

## Printset gewijzigd?

    python tools/build_assets.py
    python tools/build_data.py

De originele printbestanden worden alleen gelezen, nooit aangepast.

## Speelwijze-keuzes
Waar kaart en handleiding botsen of iets openlaten, is dat in het startscherm aan/uit te zetten
en staat het in de Spiekbrief. Met de knop **Spelleider** corrigeer je blokjes, gebouwen, pionnen en sporen handmatig.
