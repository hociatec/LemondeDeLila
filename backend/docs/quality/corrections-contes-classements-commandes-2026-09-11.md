# Contes, classements et commandes WebSocket

Cette passe poursuit les points 114, 124, 130, 147, 148, 173, 174, 178,
185, 186 et 198 du snapshot courant. Ils restent ouverts : les corrections
ci-dessous couvrent une partie de leur périmètre. Le backlog conserve 43 points.

## Corrections appliquées

- Contes et Cacahuètes : suppression de `resolution-support.ts`, des wrappers
  de dé, de position et de déplacement, d'une fonction inutilisée et des
  réexports de transit. Le contrôle de continuation appartient désormais aux
  règles qui l'utilisent ; la lecture du statut bloqué est dans `blocked-player.ts`.
  Les compteurs de contenu appartiennent à `content.ts`.
- Le choix du joueur le plus proche derrière utilise le classement du moteur.
  À position égale, le plus petit identifiant gagne, indépendamment de l'ordre
  des joueurs. Les joueurs à hauteur ou devant sont exclus.
- Cat Pattes, Entre Rites et Lumières et Voyage en Terre de Brumes utilisent
  aussi le classement commun pour leurs résultats. Leurs critères et le
  départage par identifiant sont conservés.
- Le mapper WebSocket reconstruit les métadonnées avec seulement l'acteur
  authentifié, `commandId` et `knownVersion`. Un `schedulerId` envoyé par le
  client ne peut plus atteindre le mécanisme interne de consommation des tâches.
  Les actions générées en interne conservent leurs métadonnées de planification.
  Les lots sont bornés à 128 actions et les types à 128 caractères ; les tableaux
  ne sont plus acceptés comme des objets de payload ou de métadonnées.
- Le contrôle du backlog reconnaît explicitement l'en-tête du snapshot courant
  et vérifie sa concordance avec le registre de dette. Les rapports historiques,
  dont certains numéros désignent d'autres exigences, restent contrôlés par
  l'ancien chemin pour les backlogs sans cet en-tête. Cette concordance ne
  constitue pas une preuve de clôture des exigences courantes.

## Vérifications

- 13 suites Jest, 91 tests réussis : quatre jeux, contrats des 39 jeux,
  départages, mapper et handler WebSocket, exécuteur et planification.
- 5 tests Node du backlog réussis, dont suppression non synchronisée,
  doublon, numérotation invalide et contenu supplémentaire.
- TypeScript et lint des 14 fichiers TypeScript modifiés réussis.
- Audits général, structurel et moteur réussis, sans dette dans les baselines.
- Build et chargement de `AppModule` compilé réussis.

Résultats détaillés : `logs/current-pass-tests.json` et
`logs/current-pass-build.log`. La suite Jest complète et les intégrations
contre les services externes réels n'ont pas été relancées dans cette passe.
