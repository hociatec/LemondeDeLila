# Frontière économie et ownership

## Points traités

Les points 564 à 566 demandent que les règles n'implémentent pas localement les
contrôles de solde, d'inventaire ou de possession lorsque le kit économie les
porte déjà.

## Garantie

Le marché déclaré utilise exclusivement `ctx.economy.buy`, `sell`, `pay`,
`canAfford` et `canSell`. Ces opérations vérifient le solde et l'ownership dans
les kits centraux avant mutation, puis émettent l'événement correspondant. Les
accès directs à `ctx.resources` ou `ctx.inventory` restants concernent des
ressources et inventaires propres aux règles, hors marché, et ne dupliquent pas
la politique d'économie.

## Vérification

La recherche des usages des jeux et la suite de contrats du moteur confirment
la frontière ; les invariants du kit économie couvrent refus de solde et
d'ownership avant écriture.
