# Correction du point 729 — commentaires de compatibilité

Les deux commentaires de production qui mentionnent les snapshots legacy
indiquent désormais la condition de suppression : la branche de compatibilité
sera retirée après migration de tous les snapshots persistés. Cette
compatibilité reste nécessaire tant que cette migration n’est pas prouvée.

Les occurrences `legacy` des migrations et des tests décrivent des données
historiques effectivement transformées ou testées ; elles ne sont pas des
commentaires sans plan de suppression.

Validation : `npm run game-engine:audit`, typecheck et `npm run backlog:check`.
