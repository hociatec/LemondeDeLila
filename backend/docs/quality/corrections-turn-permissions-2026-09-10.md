# Permissions de tour centralisées

Le point 571 est renforcé par `ctx.turn.requireCurrent(playerId)`, qui utilise
le même code d'erreur et la même source d'état pour les refus d'actions. Les
règles LAMA ont été migrées depuis leur garde locale ; l'énumération et
l'exécution partagent ainsi le contrôleur de tour.

Les tests runtime et la suite du jeu LAMA vérifient qu'une action hors tour est
refusée avant mutation.
