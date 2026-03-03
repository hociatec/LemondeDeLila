# Gouvernance d’architecture (moteur de jeux)

## Constat (problème prioritaire)
Une partie des jeux implémentent localement des fonctionnalités qui devraient être mutualisées (ou qui existent déjà sous forme de modules). On observe notamment des duplications autour de:

- score / conditions de fin
- inventaire / collections / statuts
- progression / objectifs
- orchestration des `pending` (prompts, choix, résolutions)
- setup flow (choix du pion, ordre de jeu, transitions setup -> started)
- règles d’exposition (presenter: filtrage par joueur, prompts privés, extras UI)

Conséquences:

- comportements incohérents entre jeux
- divergence des implémentations
- coût de maintenance et de mise à jour accru
- régressions fréquentes lors de changements “core”
- couplage fort jeu <-> implémentation ad-hoc

Ce sujet est traité comme un objectif de stabilité et de scalabilité du monde Lila.

Références:

- Plan: `backend/src/game/MUTUALIZATION_PLAN.md`
- Matrice: `backend/src/game/MUTUALIZATION_MATRIX.md`

## Architecture cible (séparation stricte)

Le code est structuré en 4 couches. Chaque couche a un rôle, et des règles d’accès.

1. `src/game/core/**`
- État commun (`GameStateEntity`), helpers communs, construction de base.
- Doit rester agnostique des règles spécifiques d’un jeu.

2. `src/game/engine/**`
- Exécution (engine), registry, WS, abstractions (adapters/presenters).
- Infrastructure d’orchestration, pas de logique métier “jeu X”.

3. `src/game/modules/**`
- Modules mutualisés (primitives + politiques): turn, pending-action, cards, board/movement, victory, setup-flow, etc.
- C’est ici que doivent vivre les comportements génériques réutilisables.

4. `src/game/games/<monde>/<jeu>/**`
- Adapteurs et règles spécifiques au jeu.
- Doit rester “thin”: composition de modules, contenu (cartes/board/quizzes), règles propres et exceptionnelles.

## Règles d’architecture (contraignantes)

### 1) “2 jeux = mutualisation”
Dès qu’un pattern apparaît dans 2 jeux (même si “presque identique”), il devient un candidat obligatoire à mutualiser dans `src/game/modules/**` (ou à étendre un module existant).

### 2) Pas de “framework local” dans un jeu
Un jeu ne doit pas introduire:

- son propre mini-engine (turn loop, pending loop, dispatcher maison)
- ses propres conventions de state/pending qui dupliquent des contrats existants

Si un jeu a besoin d’une capacité absente, on crée/étend un module mutualisé, puis on migre.

### 3) Modèle d’état: conventions et compatibilité
- Les données génériques (turn, pending, log, players) restent dans `GameStateEntity`.
- Les données spécifiques vont dans `state.metadata`, mais doivent:
  - utiliser des clés standardisées quand le concept est générique (ex: score)
  - être typées dans un modèle (éviter `any` partout) dès qu’elles sont partagées ou réutilisables

### 4) Présentation: centraliser ce qui est récurrent
Les règles de filtrage par utilisateur (prompts privés, pending owner, extra UI standards) doivent être poussées dans `engine/abstract/base-presenter.service.ts` ou un module presenter/policy partagé, pas recopiées jeu par jeu.

### 5) Outil officiel de création de jeu
La création d’un jeu passe par `cd backend && npm run create:game`. Le template doit refléter l’architecture cible et empêcher de partir sur des patterns isolés.

## Exemples de duplication (non exhaustif)
Ces exemples servent uniquement à illustrer le problème de divergence (ils ne sont pas une liste complète):

- Gestion de score “inline” dans les jeux:
  - `src/game/games/vents-infinis/arche-de-mnemosyne/arche-de-mnemosyne.service.ts`
  - `src/game/games/vents-sacres/lama/**` (scores, conditions de fin, exposition)

## Processus de mutualisation (strangler, PRs petites)

1. Identifier le pattern (et les jeux concernés) via la matrice.
2. Créer/étendre un module dans `src/game/modules/**` avec:
   - API minimale
   - typage (DTO / modèle)
   - tests unitaires
3. Migrer 1 jeu pilote (parité de comportement + tests scénario).
4. Migrer un “cluster” de jeux similaires (par vagues, cf. plan).
5. Supprimer progressivement les helpers redondants dans `src/game/games/**`.

## Checklist de revue (PR)
- Le changement évite-t-il une duplication (ou en retire-t-il une existante) ?
- Un concept générique a-t-il été ajouté dans un jeu au lieu d’un module partagé ?
- Les contrats `pending` sont-ils typés et alignés (pas de shapes ad-hoc inutiles) ?
- Les règles d’exposition joueur (presenter) sont-elles cohérentes avec le socle ?
- Les tests de non-régression sont-ils présents (au moins 1 scénario critique) ?

## Métriques et garde-fous

- `npm run test:transverse`: tests “socle” transverses
- `npm run quality:check`: métriques anti-dérive (ex: parsing payload manuel, pending ad-hoc, mojibake, etc.)

