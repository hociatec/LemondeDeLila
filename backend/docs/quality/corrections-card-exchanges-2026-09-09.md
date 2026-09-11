# Échanges de cartes — 9 septembre 2026

Le point 566 reste ouvert : ce correctif ne constitue pas une validation de
tous les invariants de propriété des cartes.

La campagne déterministe de Gérard Président a reproduit un refus erroné
`CARD_NOT_IN_HAND` (seed 65535, commande 23, action `play_special`). Les mains
publiques renvoient des copies de cartes objets ; les comparer par référence
ne permettait donc pas de retrouver une carte possédée lors d'un échange.

L'échange compare désormais les valeurs persistées, après conversion par le
catalogue. Il vérifie les deux cartes avant leur retrait et laisse un échange
avec soi-même inchangé. L'échange aléatoire accepte également la carte numérique
zéro. Les retraits de main, de zone et de défausse comparent les valeurs
sérialisables pour accepter les copies de cartes objets sans identifiant.

Cinq tests ciblés vérifient les objets de catalogue, zéro, les objets anonymes,
le refus sans perte de carte et l'échange avec soi-même. Avant correction,
quatre échouaient ; après correction, les cinq passent.

La campagne ciblée Gérard Président passe sur les quatre graines, avec jusqu'à
64 commandes par graine. Journaux : `logs/corrections-cards-exchange-before.log`,
`logs/corrections-cards-session-tests.log`, `logs/corrections-gerard-replay.log`.
La campagne d'ensemble lancée avant correction conserve son résultat historique.
