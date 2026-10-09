---
title: 'Paramètres et apparence'
description: 'Valeurs de calcul par défaut et apparence de l’application.'
weight: 50
---

Ouvrez **Paramètres** au bas de la barre principale. Il comprend langue et lieu, système de maisons, objets observés, aspects, symboles et disposition.

## Valeurs de calcul par défaut

Ces valeurs servent aux nouveaux thèmes et aux vues sans choix propre ; elles ne modifient pas un thème enregistré. L’interface propose **Čeština**, **English**, **Français** et **Español**. Recherchez le lieu par défaut ou entrez ses coordonnées ; **Fuseau horaire** est la valeur initiale d’un nouveau thème. Le nom du lieu est descriptif : coordonnées et heure sont les entrées du calcul.

**Système de maisons** montre les systèmes calculables par le backend Rust/JPL et modifie les cuspides. **Apparent** utilise positions apparentes et corrections ; **Géométrique / vrai** utilise le vecteur non corrigé. Cet écran ne propose pas de moteur ; voir [Éphémérides et couverture](../../developer/ephemeris-manager/).

## Objets et aspects

Choisissez corps et points pour les nouveaux thèmes. La liste figure dans [Objets, aspects et figures du thème](../objects-aspects-and-patterns/#objets-observés). La sélection n’installe pas de données et ne garantit pas la couverture. Les étoiles fixes se filtrent par latitude écliptique, mais le backend ne les calcule pas encore.

**École** remplace aspects actifs, orbes et participation des angles, non les maisons, objets ou moteur. Voir [Écoles et réglages des aspects](../objects-aspects-and-patterns/#écoles-et-réglages-des-aspects). Chaque aspect accepte activation, couleur, orbe de 0–30° par 0,5°, angles et orbe étendu. Les lignes d’aspects du radix ne changent que le dessin.

## Symboles et disposition

Choisissez glyphes par défaut/modernes, icônes par défaut/alternatives, jeux de textes de degrés disponibles, couleurs des éléments et réglages du gestionnaire de glyphes. La roue minimaliste a anneau zodiacal et 12 séparateurs ; la technique ajoute l’échelle 360°. **Bord gauche du radix** place ASC ou 0° du Bélier à gauche sans changer maisons, positions ni aspects ; c’est local à l’appareil.

Choisissez **Sunrise**, **Noon**, **Twilight** ou **Midnight**. La palette règle barres, canevas, textes, accent et fonds ; la vue monochrome les désature. **Enregistrer** confirme palette et couleurs des éléments ; **Annuler** rétablit les champs non enregistrés. Les préférences visuelles peuvent ne pas suivre un autre appareil.
