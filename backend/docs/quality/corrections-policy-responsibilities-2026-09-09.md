# Décisions pures et lectures applicatives

La revue porte sur les onze fichiers de policies : origines WS, identifiants et
bannissements utilisateur, paramètres de chat, règles des tables de bots,
bannissement admin, démarrage, entrée, accès client, administration et lobby des
tables. Ils calculent ou refusent une décision à partir des données fournies.

Deux accès externes ont été retirés des décisions :

- `AdminUsersCommandService` lit son horloge applicative et transmet l'instant à
  `AdminUserBanPolicyService`. La durée est calculée avec cet instant explicite.
- `RoomClientPolicyService` retourne `allow`, `deny` ou `invitation`. Le service de
  session consulte les invitations uniquement pour cette dernière décision.
  Les accès publics, propriétaires et participants conservent leur court-circuit.

Les composants qui effectuent des lectures ont été renommés :
`ClientUpdateQueryService` charge et projette les informations de mise à jour ;
`ClientVersionReader` exprime la lecture de version minimale à la frontière temps
réel ; `operationalSettings` contient la configuration des délais. Les consommateurs,
ports et associations de providers utilisent les nouveaux noms, sans alias ancien.
Les variables d'environnement et les messages échangés avec les clients restent
identiques.

L'audit d'architecture contrôle les fichiers `*-policy.ts`, `*.policy.ts` et
`*-policy.service.ts`. Il refuse les injections par constructeur, callbacks,
attentes asynchrones et accès techniques/horloges/hasard ambiants identifiés par
l'AST. Les fonctions de date recevant un instant explicite restent autorisées.
Ce garde complète la revue des onze implémentations ; il ne prétend pas prouver
la pureté de JavaScript arbitraire.

Les responsabilités des autres noms de services et les wrappers superflus
restent à examiner dans les points distincts du backlog.

Le point 688 est clôturé. Validation : sept suites / 43 tests, vingt tests des
audits, architecture sans violation, typage, lint, quality:check et build/AppModule
réussis. Journaux `logs/corrections-policy-*`. La suite générale de 266 suites /
1 193 tests précède cette dernière séparation ; les tests ciblés valident celle-ci.
