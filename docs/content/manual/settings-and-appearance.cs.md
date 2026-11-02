---
title: 'Nastavení a vzhled'
description: 'Výchozí hodnoty výpočtu a vzhled aplikace.'
weight: 50
---

Otevřete **Nastavení** ve spodní části hlavního panelu. Vedlejší panel nabízí
jazyk a lokalitu, systém domů, pozorované objekty, aspekty, symboly, rozvržení,
životopis Jana Kefera a Manuál.

## Výchozí hodnoty výpočtu

Tyto hodnoty slouží novým horoskopům a pohledům bez vlastní volby; nemění
uložený výsledek existujícího horoskopu. Rozhraní lze přepnout mezi **Čeština**,
**English**, **Français** a **Español**. Výchozí místo lze vyhledat nebo zadat
souřadnicemi; **Časové pásmo** je výchozí pro nový horoskop. Název místa je
popisný, vstupem výpočtu jsou souřadnice a čas.

**Systém domů** ukazuje systémy, které backend Rust/JPL umí vypočítat, a mění
hroty domů. **Zdánlivý** režim používá běžné zdánlivé polohy a korekce;
**Geometrický / pravý** používá nekorigovaný geometrický vektor. Volba jádra v
tomto Nastavení není; viz [Efemeridy a pokrytí](../../../developer/ephemeris-manager/).

## Objekty a aspekty

Vyberte tělesa a body pro nové horoskopy. Úplný seznam je v [Objektech,
aspektech a obrazcích horoskopu](../objects-aspects-and-patterns/#pozorovatelné-objekty).
Výběr neinstaluje data ani nezaručuje pokrytí. Stálice lze filtrovat podle
ekliptikální šířky, ale backend je zatím nepočítá.

**Škola** nahradí povolené aspekty, jejich orby a účast os, ne systém domů,
objekty ani jádro. Podrobnosti uvádějí [Školy a nastavení aspektů](../objects-aspects-and-patterns/#školy-a-nastavení-aspektů).
Každý aspekt lze zapnout, obarvit, nastavit mu orb 0–30° po 0,5°, osy a
rozšířený orb. Čáry aspektů radixu mění jen jejich kresbu, ne výpočet.

## Symboly a rozvržení

Zvolte výchozí/moderní astrologické glyfy, výchozí/alternativní ikony, dostupné
textové sady stupňů, barvy živlů a úpravy ve správci glyfů. Minimalistické kolo
má kruh znamení a 12 dělících čar; technické přidává stupnici 360°. **Levý okraj
radixu** volí ASC nebo 0° Berana vlevo a nemění domy, polohy ani aspekty; jde o
lokální předvolbu zařízení.

Vyberte motiv **Svítání**, **Poledne**, **Soumrak** nebo **Půlnoc**. Paleta
upravuje barvy panelů, plátna, textů, akcentu a pozadí; monochromatické
zobrazení je pouze odbarví. **Potvrdit** potvrzuje paletu a barvy živlů,
**Zrušit** vrací neuložená pole. Vizuální předvolby se nemusí přenést na jiné
zařízení.

V Reactu je při každém spuštění vybráno Poledne; vlastní palety zůstávají
uložené lokálně. Obnovení aktuální palety nahradí její vlastní hodnoty výchozími.
Ve výchozích paletách je průhledné pozadí výběru jen u Svítání, pozadí při najetí
myší u všech čtyř motivů. Formulářová pole a nabídky zůstávají neprůhledné.
