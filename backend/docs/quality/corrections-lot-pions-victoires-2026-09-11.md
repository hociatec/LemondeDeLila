# Lot : sélection des pions et victoires par seuil — 11 septembre 2026

Lot appliqué aux points **120 et 121**. Le backlog reste à **47 points** :
les deux chantiers ne sont pas entièrement terminés.

## Corrections appliquées

- La recette `sequentialPawnSelection`, utilisée par dix jeux, refuse les
  participants inconnus, nuls, non entiers et hors limites avant toute mutation
  du tour, émission de message ou ouverture de choix. La vérification couvre
  l'entrée individuelle et l'entrée collective. L'ordre déclaré des humains
  est conservé, les doublons sont retirés et les bots passent ensuite.
- Gérard Président utilise `thresholdVictory` pour le seuil de sept points.
  Seul le joueur désigné par le jury peut déclencher la victoire à cet endroit,
  comme auparavant ; la raison et le moment de fin sont conservés.
- Les Absurdissimes utilise la même règle pour le seuil de dix points, dans
  le callback de fin de manche existant. Le reset ne s'exécute pas après victoire.
- L'Arche de Mnémosyne utilise le seuil configuré avec le départage explicite
  « score le plus élevé, puis identifiant le plus bas ». Le tri manuel a été
  supprimé ; fermeture du quiz, annulation du timer et fin de manche restent
  au même endroit.

## Travail restant dans ces points

La sélection d'une famille de quatre pions de Foulées Fantastiques conserve
une orchestration spécifique dans ses règles. Elle doit encore être étudiée
avant de clôturer le point 120. Les autres sélections unitaires inspectées
utilisent la recette commune.

Le point 121 inclut aussi les arrivées sur piste, collections et autres
conditions standards encore présentes dans plusieurs jeux. Les trois
migrations de cette passe ne suffisent pas à le déclarer terminé.

## Validation

- Passe de 6 suites : 49 tests réussis et 6 échecs dus à une assertion qui
  attendait le code métier dans le texte du message d'erreur. Les scénarios
  des trois jeux et le contrat des 39 jeux ont réussi.
- Assertion corrigée pour vérifier la classe de l'erreur : **2 suites et
  11 tests ciblés réussis**, couvrant sélection et seuils de victoire.
- TypeScript, lint ciblé, audits de structure et moteur validés.
- Contrat SDK inchangé : 109 déclarations suivies.
- Build et chargement du module compilé réussis.

Les ensembles se recoupent. Aucun déploiement ni migration de données ; la
suite complète du backend n'a pas été relancée pendant cette passe.
