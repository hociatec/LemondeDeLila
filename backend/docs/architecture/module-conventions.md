# Conventions des modules backend

## Structure de référence

Un domaine métier expose `public-api.ts` et ne crée que les dossiers utiles :

```text
modules/feature/
  domain/          règles, entités, value objects et erreurs sans Nest/DB/Redis
  application/     commandes, queries, résultats, contrats, use-cases et ports
  infrastructure/  adapters techniques entrants et sortants
    presentation/  controllers, gateways, DTO de transport et presenters
    persistence/   adapters de stockage
  module/           composition Nest lorsque le wiring est réellement volumineux
  public-api.ts
```

La présentation est une frontière logique distincte de la persistence, mais
reste physiquement un adapter entrant sous `infrastructure`. Cette convention
évite une cinquième couche racine tout en conservant la direction
`presentation -> application`. Elle est uniforme dans les modules ; déplacer
les 148 fichiers vers un dossier frère ne modifierait ni leur responsabilité ni
leurs dépendances.

Pour un gros domaine, `application` est organisé par capacité (`membership`,
`lifecycle`, `lobby`, `maintenance`) plutôt que par suffixe. Un use-case porte une
action applicative d'entrée ; un service applicatif fournit une capacité partagée
par plusieurs use-cases. `domain` n'est jamais créé uniquement pour satisfaire la
forme. Les données applicatives sont nommées selon leur rôle : command, query,
result, DTO, projection, record, model ou contract. `application/models`
contient les structures internes partagées qui ne sont ni des messages d'entrée,
ni des vues de lecture ; les nouvelles vues de lecture vont dans
`application/read-models`.

Les dépendances suivent `presentation -> application -> domain` et
`infrastructure -> application/domain`. Le domaine et l'application n'importent
jamais un adapter. Les dépendances inter-domaines passent par `public-api.ts` ou
par un port. Le contrôle `npm run architecture:check` bloque toute régression.

## Ports et adapters

`application/ports` désigne exclusivement les dépendances externes dont
l'application est propriétaire. On ne sépare `ports/in` et `ports/out` que si le
volume rend cette direction ambiguë ; sinon le suffixe du port suffit. `contract`
désigne une donnée échangée, pas une dépendance injectable.

- `Repository` : collection durable d'agrégats métier.
- `Store` : stockage durable orienté clé/document/session, sans sémantique de
  collection d'agrégats.
- `Cache` : donnée reconstructible dont la perte ne détruit pas le métier.
- `Reader` / `Writer` : vue volontairement unidirectionnelle d'une ressource.
- `Adapter` : implémentation technique d'un port.

Redis est classé selon son usage : cache, session store, transport Pub/Sub ou
queue. TypeORM est sous `infrastructure/persistence/typeorm`; Redis durable sous
`persistence/redis`, un cache sous `infrastructure/cache`, et un transport sous
`infrastructure/transport`. Les migrations globales portent un préfixe de domaine
dans leur nom de classe et décrivent leur ownership.

Les contrats `RoomVaultSnapshotSource` et `VaultRoomSnapshotSource` sont les
deux vues volontairement distinctes de la frontière Room/Vault. Room expose la
forme minimale que son adapter peut publier ; Vault déclare la forme dont son
writer a besoin. Aucun module n'importe le port, le service ou l'infrastructure
de l'autre, ce qui maintient l'ownership de chaque côté.

Les `platform/*/public-api.ts` peuvent exporter une implémentation technique :
Platform est la couche technique partagée et cette surface sert au wiring. Cette
exception ne s'applique pas aux bounded contexts métier, dont les API publiques
restent limitées aux contrats applicatifs. `shared` reste réservé aux types et
fonctions sans dépendance métier ; les primitives de jeu vont dans le moteur.

Les contrats `RoomVaultSnapshotSource` et `VaultRoomSnapshotSource` sont les
deux vues volontairement distinctes de la frontière Room/Vault. Room expose la
forme minimale que son adapter peut publier ; Vault déclare la forme dont son
writer a besoin. Aucun des deux modules n'importe le port, le service ou
l'infrastructure de l'autre, ce qui maintient l'ownership de chaque côté.

Les `platform/*/public-api.ts` peuvent exporter une implémentation technique :
Platform est la couche technique partagée et cette surface sert au wiring. Cette
exception ne s'applique pas aux bounded contexts métier, dont les API publiques
restent limitées aux contrats applicatifs. `shared` reste réservé aux types et
fonctions sans dépendance métier ; les primitives de jeu vont dans le moteur.

## Frontières transversales

`modules/user` possède identité, credentials, hashing, émission JWT et rotation
des refresh tokens. `platform/auth` fournit la vérification JWT, les clés/JWKS
et les gardes transport ; `platform/session` possède le stockage des sessions WS.
`platform/realtime` est le transport générique
(connexion, routage, resynchronisation) ;
`modules/room/infrastructure/presentation/ws` porte les
commandes métier Room ; `platform/ws` ne contient que les primitives protocole,
authentification WS et sécurité communes. Ces trois niveaux ne dupliquent pas de
règle métier.

Dans `game`, `engine/sdk/public-api.ts` est l'unique surface des jeux concrets.
`core` orchestre l'exécution durable ; `engine/runtime` exécute le modèle
déclaratif déterministe ; `engine/application` porte le catalogue ;
`composition` contient la découverte des définitions, le registre et le
wiring Nest. Un jeu n'importe jamais ces internes, règle vérifiée par les tests de
contrat.

## Vocabulaire et tests

Les suffixes ont une portée stricte : `Entity` désigne un agrégat métier ou une
entité ORM selon son emplacement ; `Model` désigne une structure applicative
de données ou d'état ; `Record` désigne une valeur sans comportement de
persistance, éventuellement issue d'un adapter ; `DTO` désigne une forme de transport externe
validée ; `Command` exprime une intention de mutation ; `Query` exprime une
lecture ; `Port` est une dépendance abstraite possédée par l'application ;
`Adapter` est une implémentation technique d'un port, placée dans
`infrastructure` ou dans la composition inter-module `app/boundaries`.
Les autres noms doivent décrire une responsabilité (`Projection`, `Reader`,
`Writer`, `Policy`, `Presenter`) plutôt que masquer une forme générique.
L'audit `npm run naming:audit` contrôle ces suffixes, leurs emplacements, les
décorateurs des entités ORM et les noms des classes DTO/Adapter.

Aux frontières JSON, une propriété facultative absente est omise. `null`
représente une absence explicite et stable (par exemple une date inconnue ou une
commande qui efface une valeur). Un DTO d'entrée n'accepte donc `null` que si ce
sens est déclaré par son type et sa validation. Les tableaux ne contiennent
jamais `undefined`. `stringifyExternalJson` applique cette convention aux sorties
WS, Pub/Sub et notifications ; `normalizeOptional` projette les valeurs
nullables qui doivent toujours être présentes dans une réponse.

Les emplacements et les entrées de composition sont précisés dans
[les rôles des contrats applicatifs](application-contract-roles.md).

- `service` : capacité cohésive avec comportement ; `manager` est réservé à une
  ressource technique avec cycle de vie ; `handler` traduit une commande de
  transport ; `controller` est une entrée HTTP/Nest ; `presenter` projette une
  réponse ; `runtime` exécute un modèle ; `facade` protège une frontière stable.
- `helper` est une petite fonction pure colocalisée. Une orchestration ou un état
  mutable devient un service/objet nommé. `binder` relie des événements et
  `tracker` maintient explicitement une observation éphémère.
- Les tests unitaires et de contrat sont colocalisés en `*.spec.ts`. Les scénarios
  d'intégration restent près de la feature. Les audits de dépendances et de
  structure vivent dans `tools/` ou dans un dossier explicitement nommé
  `game/testing/architecture-tests`, jamais parmi les fixtures de jeu.

Les facades sans frontière sont interdites : une facade doit stabiliser une API,
appliquer une politique ou coordonner plusieurs capacités, pas seulement renvoyer
chaque appel vers un autre objet.

La [matrice et le guide auteur](authoring-and-boundaries.md) précisent les
critères de création d'un jeu, d'un kit et d'un module. Les audits représentent
les garanties mécaniques ; les critères de revue restent explicitement humains.
