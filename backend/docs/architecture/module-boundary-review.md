# Revue des frontières applicatives

Les modules fonctionnels passent par `public-api.ts`. Les imports directs vers
les services privés, le domaine privé ou l'infrastructure d'un autre module
sont interdits, y compris depuis `module/*.ts`. Le contrat ne considère plus
`index.ts` comme une entrée publique. Les exceptions internes entre le moteur
et les jeux restent explicites ; la composition racine assemble les modules.

Le stockage des bots présents dans une salle appartient à `room`.
`RoomBotsRepository` expose des contrats applicatifs sans entité TypeORM.
`AppBotPortsModule` le relie au port consommé par `bot`. Les mutations conservent
la transaction et le verrou pessimiste de la salle avant le callback. Le test
vérifie que la lecture dans le callback suit la prise du verrou et utilise le
manager de la transaction. Ce test ne remplace pas un essai de concurrence MySQL.

Le module `admin` reste une orchestration de backoffice. Ses imports externes
passent par les API publiques. Son seul stockage propre est `role_definitions`.
Une interdiction explicite empêche les composants fonctionnels et techniques
de dépendre de `admin`, même dans leur câblage. Seule la racine de l'application
peut l'assembler. Le test de l'auditeur couvre cette interdiction.

L'audit de `user/public-api.ts` confirme une dette : `User` est réexporté via
une façade de persistance et utilisé comme entité universelle. Son repository
et ses politiques de credentials sont également publics. Le passage par une
API publique ne supprime pas ce couplage ORM. Les points 214–217, 198 et 200
restent ouverts : il faudra introduire des références/identités puis migrer les
relations et les accès directs de plusieurs modules à `users`.

Le moteur continue également d'assembler ses entités de catalogue dans sa
composition interne. Les exemptions ORM ne sont donc pas déclarées résolues.
Les autres cycles et l'orchestration générale des workflows restent au backlog.

La revue des fichiers `src/modules/*/module/*.ts` confirme leur rôle de câblage :
imports/exports, listes de providers, alias de ports, instanciation et injection.
Les seules factories avec des blocs exécutables supplémentaires configurent
et connectent les transports Redis de presence et notification, avec journalisation
des erreurs de connexion. Elles ne prennent aucune décision métier, n'exécutent
aucune requête métier et ne transforment aucun modèle métier. Les callbacks
`forwardRef` ne font que résoudre les références des modules. Cette distinction
est la règle à conserver pour les futurs fichiers de module.
