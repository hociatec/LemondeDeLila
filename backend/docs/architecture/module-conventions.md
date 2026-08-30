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
forme. Les données applicatives sont sous `application/contracts` et nommées
selon leur rôle : command, query, result, DTO, projection, record ou contract.
Le dossier générique `application/models` est interdit par l'audit de layout.

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

## Frontières transversales

`modules/user` possède identité et profil. `platform/auth` possède
authentification, credentials, hashing, JWT, refresh tokens et sessions.
`platform/realtime` est le transport générique
(connexion, routage, resynchronisation) ;
`modules/room/infrastructure/presentation/ws` porte les
commandes métier Room ; `platform/ws` ne contient que les primitives protocole,
authentification WS et sécurité communes. Ces trois niveaux ne dupliquent pas de
règle métier.

Dans `game`, `engine/sdk/public-api.ts` est l'unique surface des jeux concrets.
`core` contient l'implémentation du moteur ; `engine` expose et compose ses
capacités applicatives ; `composition` ne contient que découverte, registry et
wiring Nest. Un jeu n'importe jamais ces internes, règle vérifiée par les tests de
contrat.

## Vocabulaire et tests

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
