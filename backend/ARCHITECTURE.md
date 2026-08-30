# Contrat d'architecture du backend

## Frontières racine

Le dossier `src` possède exactement quatre frontières de code :

```text
src/
├── modules/   capacités métier et applicatives
├── game/      moteur, SDK, composition et jeux
├── platform/  adapters et services techniques transversaux
└── shared/    primitives pures et types sans technologie applicative
```

`main.ts`, `app.module.ts`, `data-source.ts` et `typeorm-entities.ts` sont les
seuls points de composition conservés directement à la racine.

La direction générale est fermée et contrôlée :

```text
modules ─┬─> game (relations déclarées uniquement)
         ├─> platform
         └─> shared

game ────┬─> platform
         └─> shared

platform ─> shared
shared ───> aucune frontière supérieure
```

`typeorm-entities.ts` constitue le registre de composition TypeORM et connaît
les adapters de persistance des modules et de `game`. `platform/database`
reste purement technique : il reçoit ce registre par paramètre et ses migrations
sont autonomes, sans import vers un contrat métier. Il ne bénéficie d'aucune
exception à la direction `platform -> shared`.

## Modules métier

Chaque capacité sous `src/modules/<capacité>` expose un `public-api.ts` et suit
les couches utiles parmi `domain`, `application`, `infrastructure` et `module`.
Une dépendance entre capacités doit être déclarée dans
`tools/architecture-contract.json` et passer par l'API publique cible. Les
imports profonds, les entités TypeORM partagées et les cycles sont interdits
hors fichiers de composition Nest.

La présentation est un adapter entrant et reste sous
`infrastructure/presentation`. L'application et le domaine n'importent jamais
l'infrastructure. Le domaine n'importe ni NestJS ni TypeORM.

## Game

`src/game` est un contexte spécialisé distinct des modules applicatifs :

- `engine/sdk/public-api.ts` est la surface autorisée pour les jeux concrets ;
- `core` contient l'implémentation privée du runtime ;
- `composition` découvre et câble les jeux ;
- `games/<famille>/<jeu>` isole chaque jeu de ses voisins ;
- `testing/architecture-tests` contient les contrats transversaux du moteur.

Deux jeux ne s'importent jamais directement. Les dépendances internes
`game`, `game.engine` et `game.games.*` sont déclarées explicitement.

## Platform et Shared

`src/platform` contient `auth`, `config`, `database`, `observability`,
`pubsub`, `realtime`, `redis`, `session`, `validation` et `ws`. Ces composants
ne portent aucune règle métier. Lorsqu'une décision métier est nécessaire,
ils définissent un port et la composition racine injecte l'implémentation d'un
module. `platform/realtime` utilise ainsi un port de politique de version au
lieu d'importer `modules/update`.

`src/shared` contient uniquement les interfaces de données, déclarations de
types et utilitaires génériques. Il ne dépend ni de `platform`, ni de `modules`,
ni de `game`. Une primitive qui lit la configuration, journalise ou utilise un
adapter technique appartient à `platform`.

## Contrôles

`tools/architecture-check.cjs` vérifie les couches, APIs publiques, directions,
cycles et relations autorisées. `tools/layout-architecture-audit.cjs` verrouille
les quatre racines et leur inventaire. La baseline est vide : toute violation
future est donc une régression immédiate.

```bash
npm run architecture:test
npm run architecture:check
npm run layout:audit
```

La baseline ne doit être régénérée qu'après une modification volontaire et
revue du contrat, jamais pour accepter automatiquement une violation.
