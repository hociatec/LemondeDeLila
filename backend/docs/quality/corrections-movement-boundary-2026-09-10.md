# Bornes de mouvement centralisées

Le point 568 est couvert par `GameMovementController` : les pistes valident
leurs dimensions et leurs effets de case à la définition, puis `assertValid`
rejette toute position persistée hors bornes. Les opérations `move`, `moveTo` et
`preview` appliquent la politique `clamp`, `wrap`, `bounce` ou `exact` au même
endroit ; les règles de jeu ne recalculent pas les bornes génériques.

La suite `movement-kit.spec.ts` couvre les positions invalides et les variantes
de déplacement ; l'audit du moteur vérifie leur exposition par le SDK.
