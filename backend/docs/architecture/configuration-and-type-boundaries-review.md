# Configuration et frontières de types

Les lectures directes de `process.env` dans le code source sont limitées à
`platform/config`. Les autres composants utilisent son API. ESLint interdit les
nouveaux accès directs hors de cette plateforme, avec exception pour les tests.
Cette centralisation ne prétend pas que chaque variable possible est déjà validée
au démarrage : la couverture exhaustive et les fallbacks critiques restent ouverts.

La revue JWT confirme la priorité du PEM explicite sur le chemin de fichier,
l'échec si la clé manque et l'absence de secret arbitraire de repli dans ces helpers.
La lecture utilise un import statique de `node:fs` ; aucune désactivation ESLint
n'est nécessaire. L'erreur publique ne contient ni chemin ni détail du filesystem.
La séparation complète de cette lecture d'infrastructure hors application et le
chargement des clés au démarrage restent des évolutions distinctes.

Le bootstrap TypeORM vérifie `IGNORE_ENV_FILE` avant tout chargement de dotenv.
`createRequire(__filename)` garde le chargement conditionnel sans désactivation
ESLint. Importer inconditionnellement `dotenv/config` aurait annulé ce comportement.
Il ne reste aucun `eslint-disable` dans les fichiers de production inspectés.

Les audits AST et le lint vérifient l'absence de type `any` explicite et de `as any`
en production. `@ts-ignore` et `@ts-nocheck` sont interdits ; `@ts-expect-error`
est réservé aux tests avec une justification d'au moins dix caractères, et interdit
dans le périmètre de lint de production. Les casts doubles restent un point séparé.

L'audit d'architecture interdit TypeORM dans application et domain : ni QueryBuilder,
ni EntityManager de transaction, ni décorateur d'entité ne doivent s'y introduire.
Les imports Joi, Zod, class-validator et class-transformer sont également interdits
dans domain. Le test de l'auditeur injecte ces dépendances dans des fixtures et
vérifie leur rejet. Ces garde-fous ne prouvent pas la validation exhaustive de
toutes les entrées HTTP, WebSocket ou DB ; ces exigences restent ouvertes.
