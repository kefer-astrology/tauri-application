---
title: 'Objekty, aspekty a obrazce horoskopu'
description: 'Vestavěné objekty a aspekty a tvary a konfigurace, které může Kefer zobrazit.'
weight: 35
---

Tento přehled uvádí úplný vestavěný katalog. Volby v **Nastavení** jsou pro
konkrétní pracovní prostor a výpočetní jádro konečnou autoritou. Pracovní
prostor může definovat vlastní model a objekt může být katalogizován, ale
nedostupný, protože jej jádro nebo místní efemeridový kernel nepodporuje.
Výběr označuje objekty, které zatím nelze vypočítat.

## Pozorovatelné objekty

| Skupina | Vypočitatelné vestavěné objekty |
| --- | --- |
| Světla a planety | Slunce, Měsíc, Merkur, Venuše, Mars, Jupiter, Saturn, Uran, Neptun, Pluto |
| Osy | Ascendent, Medium Coeli, Descendent, Imum Coeli |
| Lunární uzly | Severní uzel, Jižní uzel, Pravý severní uzel, Pravý jižní uzel |
| Vypočtené body a loty | Lilith, Pravá Lilith, Vertex, Antivertex, Bod štěstí, Bod ducha |
| Asteroidy a kentauři | Chiron, Ceres, Pallas, Juno, Vesta, Astraea, Hebe, Iris, Flora, Metis, Hygiea, Parthenope, Victoria, Egeria, Irene, Eunomia, Psyche, Thetis, Melpomene, Fortuna, Massalia |

Deset planet, osy, lunární uzly, střední Lilith, Chiron, Ceres, Pallas, Juno a
Vesta fungují s oběma podporovanými jádry. Pravá Lilith, Vertex, Antivertex,
Body štěstí a ducha a rozšířená sada asteroidů vyžadují řadu JPL a příslušné
místní kernely. Aplikace při výpočtu horoskopu efemeridy nikdy
potichu nestahuje. Objekty vybírejte v části
[Nastavení a vzhled](../settings-and-appearance/).

### Katalogizované, ale zatím nevypočitatelné

Následující položky jsou ve vestavěném katalogu záměrně viditelné, ale zůstanou
zakázané, dokud pro ně nebude vytvořena výpočetní cesta. Nejde o skryté volby
ani alternativní názvy současně vypočítávaných objektů.

| Skupina | Katalogizované položky |
| --- | --- |
| Další Lilith | Osculační Lilith |
| Geocentrické planetární uzly | Uzly Merkuru, Venuše, Marsu, Jupitera, Saturnu, Uranu, Neptunu a Pluta |
| Transneptunická tělesa | Eris, Sedna, Haumea, Makemake, Quaoar, Orcus, Varuna |
| Uranské / hamburské hypotetické planety | Cupido, Hades, Zeus, Kronos, Apollon, Admetos, Vulcanus, Poseidon |
| Stálice | Alpheratz, Algenib, Hamal, Algol, Alcyone, Aldebaran, Rigel, Capella, Bellatrix, Betelgeuse, Sirius, Canopus, Procyon, Pollux, Regulus, Denebola, Zosma, Vindemiatrix, Spica, Arcturus, Alphecca, Zuben Elgenubi, Zuben Eschamali, Antares, Vega, Altair, Deneb, Fomalhaut, Deneb Algedi, Scheat, Markab, Achernar |

Jiný pracovní prostor může zvolit jiný modelový katalog, ale výběr plánované
položky ve vestavěném katalogu nikdy nevytvoří náhradní pozici.

## Dostupné aspekty

Všechny vestavěné aspekty lze v **Nastavení** zapnout, přiřadit jim orb a
omezit je podle kategorie objektu. Výchozí sada obsahuje konjunkci, sextil,
kvadraturu, trigon, kvinkunx a opozici.

| Aspekt | Přesný úhel |
| --- | ---: |
| Konjunkce | 0° |
| Semisextil | 30° |
| Undecim | 32,727…° |
| Decil | 36° |
| Novil | 40° |
| Oktile | 45° |
| Septil | 51,429…° |
| Sextil | 60° |
| Biundecim | 65,455…° |
| Kvintil | 72° |
| Binovil | 80° |
| Triundecim | 98,182…° |
| Kvadratura | 90° |
| Biseptil | 102,857…° |
| Tridecil | 108° |
| Trigon | 120° |
| Kvadriundecim | 130,909…° |
| Trioctile | 135° |
| Bikvintil | 144° |
| Kvinkunx | 150° |
| Triseptil | 154,286…° |
| Kvadrinovil | 160° |
| Kvinundecim | 163,636…° |
| Opozice | 180° |

Přesný úhel je pevný; orb je nastavitelná tolerance kolem něj. Aspekt se
zobrazí jen tehdy, když jej povoluje zvolený model, aktivní seznam, pravidlo
kategorií objektů a výsledný orb.

## Školy a nastavení aspektů

Výběr **Škola** v Reactu je předvolba astrologické tradice. Nahradí výchozí
aktivní aspekty, jejich orby a zahrnutí os; jednotlivé aspekty pak můžete v
Nastavení upravit. Zatím nemění objekty, systém domů, zodiak, ajanámšu,
výpočetní jádro ani základní model.

| Tradice | Aktivní aspekty a výchozí orb |
| --- | --- |
| Helénistická | Konjunkce 10°, sextil 8°, kvadratura 9°, trigon 9°, opozice 10° |
| Středověká / renesanční tradiční | Konjunkce 8°, sextil 6°, kvadratura 7°, trigon 8°, opozice 8° |
| Moderní západní | Konjunkce 8°, sextil 5°, kvadratura 6°, trigon 6°, kvinkunx 2°, semisextil 1°, opozice 8° |
| Harmonická / vibrační | Všechny vestavěné aspekty; katalogový orb každého z nich (0,5°–8°) |
| Kosmobiologie | Konjunkce, oktile, kvadratura, trioctile, opozice — po 2° |
| Uranská / Hamburská | Konjunkce, oktile, kvadratura, trioctile, opozice — po 1,5° |
| Jyotish — Parāśari | Konjunkce 8°, sextil 5°, kvadratura 6°, trigon 6°, opozice 8° |

Ve formátu pracovního prostoru existuje druhý, samostatný pojem **aktivní
škola**: pojmenovává uživatelsky definovanou školu a vybírá její výchozí model.
Není omezen na těchto sedm tradic a automaticky neslučuje nastavení z `extends`.

## Tvary a konfigurace horoskopu

Vypočtené obrazce může uvádět Aspektárium. Informace, včetně prototypu Spektrum,
zatím nepoužívají vypočtený výsledek vybraného horoskopu. Obrazce popisují
horoskop ve vypočteném okamžiku, nejde o další objekty ani volby výpočtu.

**Distribuční tvary:** Svazek, Mísa, Lokomotiva, Vědro, Houpačka, Rozstřik,
Rozptyl, Posunutý střed a Stelium. Detekce používá deset klasických těles
(Slunce až Pluto) a vyžaduje alespoň sedm z nich.

**Aspektové konfigurace:** T-kvadratura, Velký trigon, Velký kříž, Drak,
Mystický obdélník, Dvojitý kvinkunx, Dvojitý bikvintil, Hexagram a Pentagram.
Při tranzitech se pro geometrii dvou kvinkunxů a sextilu používá název **Yod**;
ve snímku horoskopu se tatáž geometrie nazývá **Dvojitý kvinkunx**.
