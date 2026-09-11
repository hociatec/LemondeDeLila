# Ciblage des joueurs centralisé

Le point 570 est renforcé par `ctx.players.other(playerId, actorId)`. Cette
garde vérifie en une seule opération que la cible existe et qu'elle n'est pas
l'acteur ; les recettes de ciblage mouvement/quiz et cartes l'utilisent pour
leurs validations. Les énumérations continuent de provenir de
`ctx.players.others`, ce qui garantit la même politique pour l'UI et l'exécution.

Le contrat est testé par les suites de recettes et l'audit du moteur qui
compile les 38 jeux.
