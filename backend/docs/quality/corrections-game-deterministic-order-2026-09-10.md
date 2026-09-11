# Ordre déterministe du moteur

Le point 714 est renforcé par un départage explicite des votes : à nombre de
voix égal, l'ordre déclaré des choix est utilisé, au lieu de dépendre de l'ordre
des propriétés d'un objet ou d'une base. Les files d'effets et les listes de
règles automatiques compilées conservent également leur ordre déclaré et les
projections de scores utilisent déjà `playerId` comme départage stable.

Le test `submission-voting-controller.spec.ts` vérifie le départage sur une
égalité ; les tests de compilation/runtime vérifient les ordres des tâches et
des définitions.
