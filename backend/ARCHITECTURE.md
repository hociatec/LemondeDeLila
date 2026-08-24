# Contrat d'architecture du backend

## Règles v3 issues de la restructuration

Le contrat v3 distingue trois situations : le code interne d'un composant, le
câblage technique et les collaborations entre composants métier.

1. À l'intérieur d'un composant, les imports sont libres tant que les règles de
   couches restent respectées.
2. `common/*` constitue le socle partagé. Tous les composants peuvent en
   dépendre, mais `common/*` ne dépend jamais d'un composant métier.
3. `game`, `game/engine` et `game/games/*` appartiennent au même contexte de
   plateforme de jeu. Leurs dépendances internes sont autorisées explicitement.
   Deux jeux distincts restent isolés et ne peuvent pas s'importer.
4. Une dépendance entre composants métier doit être déclarée dans
   `dependencies.allowed` et passer par le `public-api.ts` du composant cible.
   Une nouvelle relation non déclarée échoue même si elle utilise une API
   publique.
5. Les fichiers de composition (`module/*`, `*.module.ts` et fichiers à la
   racine de `src`) peuvent importer directement les adaptateurs et entités
   nécessaires au câblage NestJS/TypeORM. Cette permission ne s'applique pas
   aux services, handlers ou repositories.
6. Un repository ne peut pas utiliser directement l'entité TypeORM d'un autre
   composant. La collaboration passe par un port, un service public ou un DTO.
7. Une API publique ne réexporte pas d'entité TypeORM.
8. Les cycles entre composants métier restent interdits, y compris lorsque
   chacune des relations qui compose le cycle est individuellement autorisée.

La liste directionnelle complète des collaborations actuellement reconnues se
trouve dans `tools/architecture-contract.json`. Elle constitue une liste
fermée : toute nouvelle dépendance doit être justifiée et ajoutée lors d'une
revue d'architecture, pas automatiquement ajoutée à la baseline.

Ce document décrit les règles vérifiées automatiquement par
`tools/architecture-check.cjs`. Le backend est un monolithe modulaire : les
frontières servent à limiter le couplage, pas à interdire toute collaboration
entre modules.

## Composants

- Chaque dossier directement sous `src/` est un composant métier principal.
- Chaque dossier `src/common/<nom>` est un composant partagé autonome.
- `src/game/engine` est le composant du moteur de jeu.
- Chaque dossier `src/game/games/<famille>/<jeu>` est un sous-contexte de jeu.
- `database`, `migrations`, `app.module.ts`, `data-source.ts`, les couches
  `module` et les fichiers `*.module.ts` sont des points de composition. Leurs
  imports ne créent pas de dépendance métier dans le graphe des cycles.

La liste des familles et composants partagés reconnus se trouve dans
`tools/architecture-contract.json` afin que le contrat puisse évoluer sans
modifier l'algorithme.

Les jeux peuvent importer les abstractions et services partagés du socle
`game`. Cette relation enfant vers parent est intentionnelle et n'exige pas une
façade pour chaque helper interne. En revanche, un jeu ne peut pas importer un
autre jeu.

Le socle `game` peut charger directement les modules et handlers des jeux dans
son registre de plugins. Cette relation parent vers plugin est une relation de
composition, pas une autorisation donnée à un jeu de connaître ses voisins.

## Couches

- `domain`, `model` et `rulebook` représentent le domaine pur. Ils ne doivent
  dépendre ni de NestJS, ni de TypeORM, ni d'une infrastructure.
- `application` orchestre les cas d'usage et dépend d'abstractions. Elle ne
  doit pas importer TypeORM ou une couche `infrastructure`.
- `infrastructure` contient les adaptateurs techniques, transports et dépôts.
- `module` assemble les fournisseurs NestJS et constitue une couche de
  composition.

La détection cherche ces segments après la racine du composant. Elle fonctionne
donc aussi dans les jeux imbriqués.

## Frontières publiques

Hors point de composition, un import entre deux composants passe par le
`public-api.ts` ou l'`index.ts` à la racine du composant cible. Les imports
directs d'entités TypeORM appartenant à un autre composant restent signalés
dans les services, handlers et repositories.

Une API publique ne supprime pas une dépendance : toute dépendance entre
composants alimente le graphe, même lorsqu'elle passe correctement par
`public-api.ts`. Le contrôle peut donc encore détecter un cycle. Une API
publique qui réexporte directement une entité TypeORM est également signalée.

Deux jeux distincts ne doivent pas dépendre l'un de l'autre. Ils partagent du
comportement via le moteur ou une abstraction commune.

## Baseline

La baseline version 2 agrège les occurrences par règle et relation sémantique
(`source -> cible`). Déplacer ou renommer un fichier sans augmenter le nombre
d'occurrences ne crée plus de fausse régression. Une augmentation échoue ; une
diminution est signalée et permet ensuite de rafraîchir la baseline après
revue.

Les cycles sont calculés sous forme de composantes fortement connexes : un
groupe cyclique n'est rapporté qu'une fois, sans compter toutes ses rotations.
Pour ce graphe, les jeux et `game/engine` sont agrégés sous `game`, et les
composants `common/*` sous `common`. Les frontières détaillées restent vérifiées
séparément, mais les cycles représentent ainsi les domaines fonctionnels plutôt
que chaque dossier interne.

Commandes :

```bash
npm run architecture:test
npm run architecture:check
npm run architecture:baseline:update
```

La baseline ne doit être régénérée qu'après validation d'un changement du
contrat ou remboursement volontaire d'une dette existante.
