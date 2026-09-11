# Compilation et initialisation — 11 septembre 2026

Corrections appliquées dans le périmètre des points 137 et 178 du snapshot
courant. Ces points restent ouverts : cette passe ne couvre pas encore toutes
les références déclaratives ni toutes les entrées JSON externes. Le backlog
contient toujours 52 points.

## Comportement corrigé

- Une action marquée comme remplacement doit cibler une action réellement
  héritée d'un pattern, sous le même identifiant. Les noms hérités du prototype
  JavaScript ne sont pas considérés comme des actions du pattern.
- Un composant marqué comme remplacement doit cibler un composant hérité de
  même type et de même identifiant. Auparavant, une déclaration incohérente
  pouvait supprimer un composant pendant la fusion et introduire un autre ID.
- Les scores, ressources et compteurs initiaux sont vérifiés à la compilation
  avec les invariants numériques des kits. Les valeurs infinies et les magnitudes
  hors limites sont rejetées avant le démarrage de la partie.
- Les tables de valeurs par joueur exigent des identifiants entiers sûrs et
  canoniques, non nuls. Les identifiants négatifs des bots restent acceptés.
- Les identifiants de ressources déclarés et les compteurs initiaux ne peuvent
  plus utiliser des noms hérités tels que `toString` ou `valueOf`. Le compilateur
  applique les règles du runtime, y compris la limite de 128 caractères.

Les remplacements explicites valides, les fractions et les soldes signés permis
par les kits restent acceptés. Les définitions existantes des 39 jeux passent
les contrôles. Aucun changement de contrat public SDK ni migration de données.

## Vérifications

- Compilation et contrat des 39 jeux : 2 suites, 63 tests réussis.
- Régression des références, compilateur JSON et composition des patterns :
  4 suites, 113 tests réussis après adaptation d'une assertion au diagnostic
  plus précoce des positions infinies.
- TypeScript, lint ciblé, audits de structure, architecture et moteur réussis.
- Contrat SDK inchangé : 109 déclarations suivies.
- Build : 1 682 fichiers compilés ; chargement du module compilé réussi.

Les suites se recoupent ; leurs totaux ne s'additionnent pas. La suite complète
n'a pas été relancée pour cette passe. Aucun déploiement effectué.
