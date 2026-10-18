---
title: 'Transits et temps'
description: 'Examiner les positions changeantes et déplacer un thème dans le temps.'
weight: 40
---

Ouvrez **Transits** pour comparer un thème Radix sélectionné avec les positions
d’un autre instant. Le radix reste fixe ; les **corps en transit** se déplacent
sur la période et sont comparés aux **corps transités** du radix. La navigation
secondaire configure Général, Corps transités, Corps en transit et Aspects.

## Calculer une période de transits

1. Choisissez **Transit** comme type. Les directions primaires et secondaires
   sont visibles, mais pas encore disponibles.
2. Choisissez le thème radix source. Dans un espace de travail, la série utilise
   son thème enregistré ; le thème choisi reste la référence fixe.
3. Choisissez une période : **Actuel** calcule un instant lorsque vous cliquez
   sur **Calculer** ; les préréglages des 3 ou 6 mois et de l’année à venir ou
   écoulés créent une plage lors de leur sélection ; **Personnalisé** permet de
   modifier les dates et heures de début et de fin.
4. Sélectionnez les objets mobiles (**en transit**), les objets radix fixes
   (**transités**) et les aspects. Les listes sont indépendantes : un objet peut
   figurer dans les deux, par exemple pour un retour à sa position natale.
5. Pour une plage avec sortie échantillonnée, choisissez un intervalle positif
   en secondes, minutes, heures ou jours, puis sélectionnez **Calculer**.

Le résultat échantillonné est une suite d’instantanés. Un intervalle plus court
donne un graphique ou tableau plus dense, mais ne rend pas la recherche
d’événements exacts plus précise. Les plages très denses ou longues peuvent
dépasser la limite de calcul : choisissez un pas plus large si l’estimation est élevée.

La date et l’heure sont saisies dans l’heure locale du navigateur puis envoyées
comme un instant concret. Les champs textuels de fuseau horaire sont des
emplacements désactivés ; pour changer la base temporelle, utilisez les réglages
de lieu/fuseau du thème source.

## Lire les résultats

Avec la sortie échantillonnée, la zone de résultats propose un graphique de
**Résonance** et un tableau triable de l’activité des aspects. Résonance peut
être agrandie dans le temps et la distance d’orbe ; le panneau Calques affiche
ou masque toutes les ondes liées à chaque corps transité sélectionné. Le
rapprochement apparent du graphique échantillonné ne remplace pas un événement exact.

Ouvrir un contact échantillonné, un événement exact ou une limite de figure
crée la superposition de transit pour cet instant sur le même radix ; le thème
radix lui-même ne change pas.

## Événements exacts, stations et configurations

Ces recherches facultatives sont indépendantes de l’échantillonnage. Vous pouvez
désactiver **Sortie graphique échantillonnée** si vous ne voulez que ces résultats.

- **Événements exacts** trouve par recherche de racine le moment où un aspect
  demandé devient exact, y compris pour les paires transit–radix et
  transit–transit ; il peut donc se situer entre deux échantillons.
- **Stations** trouve les points de retournement direct/rétrograde.
- **Configurations à plusieurs corps** trouve l’intervalle pendant lequel un
  Grand trigone, un T-carré, un Yod ou un Grand carré reste dans l’orbe.

Les contrôles de rôles d’une figure peuvent limiter les corps de chaque rôle et
maintenir certains rôles sur des positions radix. Une figure peut ainsi combiner
des corps mobiles et des cibles natales fixes. Sa **meilleure adéquation** est
l’ajustement le plus serré dans l’orbe, et non l’affirmation que tous les
aspects sont exacts simultanément.

Un événement ou une configuration peut être ouvert comme thème à cet instant.
Un avertissement ou résultat incomplet indique une couverture d’éphémérides
insuffisante ou une recherche limitée non terminée. Certains quasi-contacts sont
marqués tangents ou non confirmés ; une liste incomplète vide ne prouve pas
l’absence d’événement.

## Limites actuelles

Les contrôles visibles pour passages de maisons, passages de signes, limites de
transit et précession générale sont des emplacements désactivés. Les champs de
fuseau horaire ne sont pas non plus disponibles dans cette vue. **Dynamique**
partage la zone temporelle, mais n’active pas encore les directions primaires
ni secondaires.

Lorsque la navigation temporelle est disponible ailleurs dans l’application,
choisissez une unité et une quantité avant d’avancer ou reculer. Les mois et
années sont appliqués comme changements de calendrier, non comme secondes fixes.
