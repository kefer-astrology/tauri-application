---
title: 'Objets, aspects et figures du thème'
description: 'Les objets et aspects intégrés, ainsi que les formes et configurations que Kefer peut afficher.'
weight: 35
---

Cette référence énumère le catalogue intégré complet. Les choix dans
**Paramètres** font autorité pour l’espace de travail et le moteur concernés.
Un espace de travail peut définir son propre modèle, et un objet peut être
catalogué mais indisponible parce que le moteur ou le noyau d’éphémérides local
ne le prend pas en charge. Le sélecteur indique les éléments non calculables.

## Objets observables

| Groupe | Objets intégrés calculables |
| --- | --- |
| Luminaires et planètes | Soleil, Lune, Mercure, Vénus, Mars, Jupiter, Saturne, Uranus, Neptune, Pluton |
| Axes | Ascendant, Milieu du Ciel, Descendant, Fond du Ciel |
| Nœuds lunaires | Nœud Nord, Nœud Sud, Vrai Nœud Nord, Vrai Nœud Sud |
| Points calculés et lots | Lilith, Vraie Lilith, Vertex, Antivertex, Part de Fortune, Part d’Esprit |
| Astéroïdes et centaures | Chiron, Cérès, Pallas, Junon, Vesta, Astraea, Hebe, Iris, Flora, Metis, Hygiea, Parthenope, Victoria, Egeria, Irene, Eunomia, Psyche, Thetis, Melpomene, Fortuna, Massalia |

Les dix planètes, les axes, les nœuds lunaires, Lilith moyenne, Chiron, Cérès,
Pallas, Junon et Vesta fonctionnent avec les deux moteurs pris en charge.
Vraie Lilith, Vertex, Antivertex, les Parts de Fortune et d’Esprit ainsi que
les astéroïdes étendus nécessitent la voie JPL et les noyaux locaux appropriés.
L’application ne télécharge jamais
silencieusement des éphémérides pendant un calcul. Choisissez les objets dans
[Paramètres et apparence](../settings-and-appearance/).

### Catalogués, mais pas encore calculables

Les entrées suivantes sont volontairement visibles dans le catalogue intégré,
mais désactivées jusqu’à ce qu’une voie de calcul existe. Ce ne sont ni des
options cachées ni des noms alternatifs d’un objet actuellement calculé.

| Groupe | Entrées cataloguées |
| --- | --- |
| Lilith supplémentaire | Lilith osculatrice |
| Nœuds planétaires géocentriques | Nœuds de Mercure, Vénus, Mars, Jupiter, Saturne, Uranus, Neptune et Pluton |
| Objets transneptuniens | Éris, Sedna, Haumea, Makemake, Quaoar, Orcus, Varuna |
| Hypothétiques uraniens / de Hambourg | Cupido, Hadès, Zeus, Kronos, Apollon, Admetos, Vulcanus, Poséidon |
| Étoiles fixes | Alpheratz, Algenib, Hamal, Algol, Alcyone, Aldebaran, Rigel, Capella, Bellatrix, Bételgeuse, Sirius, Canopus, Procyon, Pollux, Regulus, Denebola, Zosma, Vindemiatrix, Spica, Arcturus, Alphecca, Zuben Elgenubi, Zuben Eschamali, Antarès, Véga, Altaïr, Deneb, Fomalhaut, Deneb Algedi, Scheat, Markab, Achernar |

Un autre espace de travail peut choisir un autre catalogue de modèle, mais la
sélection d’une entrée prévue du catalogue intégré n’invente jamais une
position de remplacement.

## Aspects disponibles

Tous les aspects intégrés peuvent être activés, recevoir un orbe et être limités
par catégorie d’objet dans **Paramètres**. L’ensemble par défaut contient
conjonction, sextile, carré, trigone, quinconce et opposition.

| Aspect | Angle exact |
| --- | ---: |
| Conjonction | 0° |
| Semi-sextile | 30° |
| Undécile | 32,727…° |
| Décile | 36° |
| Novile | 40° |
| Octile | 45° |
| Septile | 51,429…° |
| Sextile | 60° |
| Biundécile | 65,455…° |
| Quintile | 72° |
| Binovile | 80° |
| Triundécile | 98,182…° |
| Carré | 90° |
| Biseptile | 102,857…° |
| Tridécile | 108° |
| Trigone | 120° |
| Quadriundécile | 130,909…° |
| Trioctile | 135° |
| Biquintile | 144° |
| Quinconce | 150° |
| Triseptile | 154,286…° |
| Quadrinovile | 160° |
| Quinundécile | 163,636…° |
| Opposition | 180° |

L’angle exact est fixe ; l’orbe est une tolérance configurable. Un aspect n’est
signalé que si le modèle, la liste active, la règle de catégories et l’orbe
résolu l’autorisent.

## Écoles et réglages des aspects

Le sélecteur **École** de React est un préréglage de tradition astrologique. Il
remplace les aspects activés par défaut, leurs orbes et l’inclusion des axes ;
vous pouvez ensuite ajuster chaque aspect dans Paramètres. Il ne modifie pas
encore les objets, le système de maisons, le zodiaque, l’ayanamsha, le moteur
de calcul ni le modèle sous-jacent.

| Tradition | Aspects actifs et orbe par défaut |
| --- | --- |
| Hellénistique | Conjonction 10°, sextile 8°, carré 9°, trigone 9°, opposition 10° |
| Traditionnelle médiévale / Renaissance | Conjonction 8°, sextile 6°, carré 7°, trigone 8°, opposition 8° |
| Occidentale moderne | Conjonction 8°, sextile 5°, carré 6°, trigone 6°, quinconce 2°, semi-sextile 1°, opposition 8° |
| Harmonique / vibratoire | Tous les aspects intégrés ; orbe du catalogue pour chacun (0,5°–8°) |
| Cosmobiologie | Conjonction, octile, carré, trioctile, opposition — 2° chacun |
| Uranienne / Hambourg | Conjonction, octile, carré, trioctile, opposition — 1,5° chacun |
| Jyotish — Parāśari | Conjonction 8°, sextile 5°, carré 6°, trigone 6°, opposition 8° |

Le format d’espace de travail possède un second concept distinct : une **école
active**, définie par l’espace de travail, choisit son modèle de calcul par
défaut. Elle n’est pas limitée à ces sept traditions et ne fusionne pas
automatiquement les réglages d’une relation `extends`.

## Formes et configurations du thème

Aspectarium peut signaler ces figures calculées. Informations, y compris son
prototype Spectrum, n’utilise pas encore le résultat calculé du thème sélectionné.
Elles décrivent un thème à son instant calculé, non des objets supplémentaires.

**Formes de distribution :** Faisceau, Bol, Locomotive, Seau, Bascule,
Éclaboussure, Éparpillement, Centre décalé et Stellium. La détection utilise
les dix corps classiques (du Soleil à Pluton) et en exige au moins sept.

**Configurations aspectuelles :** T-carré, Grand trigone, Grand carré,
Cerf-volant, Rectangle mystique, Double quinconce, Double biquintile,
Hexagramme et Pentagramme. Pour les transits, **Yod** désigne la géométrie
appelée **Double quinconce** dans l’instantané du thème.
