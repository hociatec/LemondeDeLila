# Projections joueur — 11 septembre 2026

Corrections appliquées aux points 156 et 157 du snapshot courant. Ces points
restent ouverts pour l'audit des projections imbriquées et des extensions
propres aux jeux. Le backlog contient toujours 52 points.

## Changements

`GameVisibilityService` accepte désormais le contrat de vue publique, distinct
de l'état interne. Il construit explicitement l'enveloppe avec `viewVersion`,
`system`, `kits`, `effect`, `game` et les propriétés optionnelles déclarées :
`gameContract`, `actions`, `actionCatalog`, `timers`, `pending`.

Les champs supplémentaires ne sont plus copiés puis filtrés. Un futur champ
interne, y compris une valeur non clonable, est exclu avant le clonage. Les
métadonnées internes et le moteur ne sont pas publiés. L'identité de contrat
du jeu est elle aussi reconstruite avec ses trois versions déclarées.

Les choix en attente utilisent une liste explicite de propriétés publiques.
La file de continuations et les champs inconnus sont exclus, même pour le joueur
autorisé. La question, les choix et les données sont ajoutés seulement selon les
règles d'accès existantes. Le filtre tient désormais compte d'une réponse déjà
résolue pour les deux formes de cible, `playerId` et `playerIds`.

La vue conserve une copie indépendante des données publiées. Les extensions
`game` et les projections des kits restent sous la responsabilité de leurs
contrats respectifs ; cette passe ne démontre pas leur audit complet.

## Vérifications

- Première passe : 4 suites, 65 tests réussis, incluant les 39 jeux et le handler
  WebSocket.
- Après correction des réponses déjà résolues : 2 suites, 23 tests réussis sur
  la visibilité et le presenter WebSocket.
- TypeScript, lint ciblé, audits de structure et architecture réussis.
- Build : 1 683 fichiers compilés et chargement du module compilé réussi.

Les ensembles de tests se recoupent. Pas de relance de la suite complète,
de migration de données ou de déploiement pendant cette passe.
