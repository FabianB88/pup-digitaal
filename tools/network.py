# -*- coding: utf-8 -*-
"""PUP board network: 28 cities, 5 system zones, connections."""

ZONES = {
 'amerikaanse': {'label':'AMERIKAANSE ZONE','color':'#C2553A',
   'cities':['ANCHORAGE','VANCOUVER','NEW YORK','HOUSTON','MEXICO-STAD','MANAUS','SÃO PAULO']},
 'mediterrane': {'label':'MEDITERRANE ZONE','color':'#C9922F',
   'cities':['AMSTERDAM','WARSCHAU','ISTANBUL','CASABLANCA','CAÏRO','RIYAD']},
 'afrikaanse':  {'label':'AFRIKAANSE ZONE','color':'#4E8A45',
   'cities':['LAGOS','ADDIS ABEBA','KINSHASA','NAIROBI','JOHANNESBURG']},
 'indische':    {'label':'INDISCHE ZONE','color':'#3E7FA6',
   'cities':['KARACHI','DELHI','DHAKA','BANGKOK','SINGAPORE']},
 'pacifische':  {'label':'PACIFISCHE ZONE','color':'#7E5EA8',
   'cities':['SHANGHAI','TOKIO','MANILA','JAKARTA','SYDNEY']},
}

# lat, lon
COORD = {
 'ANCHORAGE':(61.22,-149.90),'VANCOUVER':(49.28,-123.12),'NEW YORK':(40.71,-74.01),
 'HOUSTON':(29.76,-95.37),'MEXICO-STAD':(19.43,-99.13),'MANAUS':(-3.12,-60.02),
 'SÃO PAULO':(-23.55,-46.63),
 'AMSTERDAM':(52.37,4.90),'WARSCHAU':(52.23,21.01),'ISTANBUL':(41.01,28.98),
 'CASABLANCA':(33.57,-7.59),'CAÏRO':(30.04,31.24),'RIYAD':(24.71,46.68),
 'LAGOS':(6.52,3.38),'ADDIS ABEBA':(9.03,38.74),'KINSHASA':(-4.44,15.27),
 'NAIROBI':(-1.29,36.82),'JOHANNESBURG':(-26.20,28.05),
 'KARACHI':(24.86,67.01),'DELHI':(28.61,77.21),'DHAKA':(23.81,90.41),
 'BANGKOK':(13.76,100.50),'SINGAPORE':(1.35,103.82),
 'SHANGHAI':(31.23,121.47),'TOKIO':(35.68,139.65),'MANILA':(14.60,120.98),
 'JAKARTA':(-6.21,106.85),'SYDNEY':(-33.87,151.21),
}

EDGES = [
 # --- Amerikaanse (intern) ---
 ('ANCHORAGE','VANCOUVER'),('VANCOUVER','HOUSTON'),('VANCOUVER','NEW YORK'),
 ('VANCOUVER','MEXICO-STAD'),('HOUSTON','NEW YORK'),('HOUSTON','MEXICO-STAD'),
 ('MEXICO-STAD','MANAUS'),('MANAUS','SÃO PAULO'),('SÃO PAULO','NEW YORK'),
 # --- Mediterrane (intern) ---
 ('AMSTERDAM','WARSCHAU'),('AMSTERDAM','CASABLANCA'),('AMSTERDAM','ISTANBUL'),
 ('WARSCHAU','ISTANBUL'),('WARSCHAU','CAÏRO'),('ISTANBUL','CAÏRO'),
 ('ISTANBUL','RIYAD'),('CASABLANCA','CAÏRO'),('CAÏRO','RIYAD'),
 # --- Afrikaanse (intern) ---
 ('LAGOS','KINSHASA'),('LAGOS','ADDIS ABEBA'),('ADDIS ABEBA','NAIROBI'),
 ('KINSHASA','NAIROBI'),('KINSHASA','JOHANNESBURG'),('NAIROBI','JOHANNESBURG'),
 # --- Indische (intern) ---
 ('KARACHI','DELHI'),('DELHI','DHAKA'),('DELHI','BANGKOK'),
 ('DHAKA','BANGKOK'),('DHAKA','SINGAPORE'),('BANGKOK','SINGAPORE'),
 # --- Pacifische (intern) ---
 ('SHANGHAI','TOKIO'),('SHANGHAI','MANILA'),('TOKIO','MANILA'),
 ('MANILA','JAKARTA'),('MANILA','SYDNEY'),('JAKARTA','SYDNEY'),('TOKIO','SYDNEY'),
 # --- intercontinentale bruggen tussen zones ---
 ('NEW YORK','AMSTERDAM'),        # Atlantische route
 ('MANAUS','LAGOS'),              # Zuid-Atlantische route
 ('SÃO PAULO','JOHANNESBURG'),    # Zuid-Atlantische route
 ('CASABLANCA','LAGOS'),          # West-Afrikaanse kust
 ('CAÏRO','ADDIS ABEBA'),         # Nijl / Hoorn
 ('RIYAD','KARACHI'),             # Golf
 ('NAIROBI','KARACHI'),           # Indische Oceaan
 ('BANGKOK','MANILA'),            # Zuid-Chinese Zee
 ('SINGAPORE','JAKARTA'),         # Straat van Malakka
 ('SINGAPORE','SHANGHAI'),        # Oost-Aziatische kust
 ('ANCHORAGE','TOKIO'),           # Grote Oceaan (wrap over de kaartrand)
 ('ANCHORAGE','SHANGHAI'),        # Grote Oceaan (wrap over de kaartrand)
]

WRAP = {('ANCHORAGE','TOKIO'),('ANCHORAGE','SHANGHAI')}   # tekenen als stub aan beide kaartranden

ZONE_OF = {c:z for z,d in ZONES.items() for c in d['cities']}
