# Olympia

## Objectif
Accumuler un maximum de prestige divin en jouant vos héros, exploits, créatures, actions, attaques et événements.
Le joueur ayant le plus de prestige (ou atteignant 30 points) devient souverain du Panthéon.

## Mise en place
1. Moulez les decks par type (divinités, héros, créatures, exploits, actions, attaques, événements).
2. Chaque joueur reçoit une divinité unique, deux créatures et une action ou attaque pour démarrer.
3. Les autres cartes alimentent les decks séparés (heros, créatures, exploits, actions, attaques, événements).

## Déroulement d’un tour
1. `draw_card` : piochez une carte d’un deck de votre choix parmi héros, créatures, exploits, actions, attaques ou événements.
2. `play_card` : jouez une carte depuis votre main. Les héros/exploits rapportent les points indiqués, les autres cartes déclenchent les effets (statuts, vol de points, pioches supplémentaires…).
3. `pass` : vous pouvez passer pour libérer le tour suivant.

Les statuts (`block_play`, `block_actions`, `skip`, etc.) sont appliqués dès qu’ils sont joués et durent quelques tours.

## Conditions de victoire
- Un joueur atteint 30 points de prestige.
- Les decks sont épuisés et aucun joueur ne peut améliorer son score.

## Notes techniques
- Les effets sont résolus dans l’ordre défini sur chaque carte (prestige, steal, draw, status, discard, exchange, skip).
- Les effets ciblés réclament un `targetPlayerId` dans l’action `play_card`.
*** End Patch**=""
