# Guide Développeur - Moteur de Jeux

**Dernière mise à jour** : 21 décembre 2025
**Version** : 1.0.0

---

## Table des matières

1. [Introduction](#introduction)
2. [Architecture Globale](#architecture-globale)
3. [Flow d'une Action](#flow-dune-action)
4. [Créer un Nouveau Jeu](#créer-un-nouveau-jeu)
5. [Ajouter une Action](#ajouter-une-action)
6. [Ajouter une Phase](#ajouter-une-phase)
7. [Implémenter un Bot](#implémenter-un-bot)
8. [Debugging](#debugging)
9. [Tests](#tests)
10. [Patterns et Bonnes Pratiques](#patterns-et-bonnes-pratiques)

---

## Introduction

Ce guide décrit l'architecture du moteur de jeux et explique comment créer de nouveaux jeux, ajouter des fonctionnalités, et maintenir le code.

### Concepts Clés

- **GameRulesAdapter** : Interface que chaque jeu doit implémenter
- **GameStateEntity** : État partagé de la partie (joueurs, tour, metadata)
- **Metadata** : Données spécifiques au jeu (deck, scores, phases, etc.)
- **Actions** : Opérations que les joueurs peuvent effectuer
- **Phases** : Étapes du déroulement d'une partie
- **Bots** : IA qui joue à la place des joueurs

---

## Architecture Globale

```
�"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�",                        GAME ENGINE                               �",
�"o�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�",                                                                  �",
�",  �"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�      �"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�      �"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�  �",
�",  �", GameRegistry �",�"?�"?�"?�"?�"?�"?�", GameEngine   �",�"?�"?�"?�"?�"?�"?�", RoomService  �",  �",
�",  �",  Service     �",      �",   Service    �",      �",              �",  �",
�",  �""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~      �""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~      �""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~  �",
�",         �",                      �",                      �",         �",
�",         �",                      �",                      �",         �",
�",         �-�                      �-�                      �-�         �",
�",  �"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�  �",
�",  �",              GAME RULES ADAPTER                          �",  �",
�",  �",  (Interface implémentée par chaque jeu)                  �",  �",
�",  �""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~  �",
�",         �",                      �",                      �",         �",
�",         �-�                      �-�                      �-�         �",
�",  �"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�      �"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�      �"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�  �",
�",  �",   Setup      �",      �",   Actions    �",      �",  Presenter   �",  �",
�",  �",   Service    �",      �",   Handlers   �",      �",   Service    �",  �",
�",  �""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~      �""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~      �""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~  �",
�",                                                                  �",
�""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~

�"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�",                     ABSTRACT SERVICES                            �",
�"o�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�",                                                                  �",
�",  �"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�  �"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�  �"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�  �",
�",  �", AbstractGame     �",  �", BasePresenter    �",  �", ActionDisp.  �",  �",
�",  �",   Service        �",  �",    Service       �",  �",   Service    �",  �",
�",  �""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~  �""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~  �""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~  �",
�",                                                                  �",
�""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~

�"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�",                       SHARED MODULES                             �",
�"o�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�",                                                                  �",
�",  �"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�  �"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�  �"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�  �"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�  �",
�",  �", DeckPool   �",  �",   Turn     �",  �",   Phase    �",  �", Victory  �",  �",
�",  �",  Service   �",  �",  Service   �",  �",  Engine    �",  �", Service  �",  �",
�",  �""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~  �""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~  �""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~  �""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~  �",
�",                                                                  �",
�",  �"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�  �"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�  �"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�  �"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�  �",
�",  �", ActionLog  �",  �",   Bot      �",  �",   Quiz     �",  �",  Logger  �",  �",
�",  �",  Service   �",  �",  Strategy  �",  �",  Runner    �",  �", Service  �",  �",
�",  �""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~  �""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~  �""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~  �""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~  �",
�",                                                                  �",
�""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~
```

### Composants Principaux

#### 1. **GameEngineService**
- Point d'entrée principal pour toutes les opérations de jeu
- Gère l'application des actions et le déclenchement des bots
- Sauvegarde l'état et broadcast aux clients

#### 2. **GameRegistryService**
- Enregistre tous les jeux disponibles
- Fournit l'accès aux adaptateurs de règles

#### 3. **GameRulesAdapter**
- Interface que chaque jeu doit implémenter
- Méthodes clés : `hydrateInitialState()`, `applyActions()`, `exposeState()`

#### 4. **AbstractGameService**
- Classe de base pour tous les jeux
- Fournit des méthodes communes (template method pattern)
- Méthodes : `extractActorId()`, `isPlayerBot()`, `findPlayer()`, etc.

#### 5. **BasePresenterService**
- Classe de base pour les presenters
- Gère l'exposition de l'état au client
- Template methods pour personnalisation

#### 6. **ActionDispatcherService**
- Registry pattern pour les handlers d'actions
- Remplace les switch/case par un système extensible

---

## Flow d'une Action

Voici le flow complet d'une action joueur, du client au serveur et retour :

```
�"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�",   CLIENT    �",
�""�"?�"?�"?�"?�"?�"?�"��"?�"?�"?�"?�"?�"?�"~
       �", 1. Emit 'game:action'
       �",    { type: 'draw', payload: {} }
       �-�
�"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�",  GameGateway        �",
�""�"?�"?�"?�"?�"?�"?�"��"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~
       �", 2. Validate WebSocket
       �",
       �-�
�"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�", GameEngineService   �",
�",  .applyActions()    �",
�""�"?�"?�"?�"?�"?�"?�"��"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~
       �", 3. Load current state
       �",
       �-�
�"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�", GameRulesAdapter    �",
�",  .validateAction()  �", �-"�"?�"?�"?�"?�"?�"? Optional: Validation spécifique au jeu
�""�"?�"?�"?�"?�"?�"?�"��"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~
       �", 4. Action validée
       �",
       �-�
�"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�", GameRulesAdapter    �",
�",  .applyActions()    �",
�""�"?�"?�"?�"?�"?�"?�"��"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~
       �", 5. Dispatch action
       �",
       �-�
�"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�", ActionDispatcher    �",
�",  .dispatch()        �",
�""�"?�"?�"?�"?�"?�"?�"��"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~
       �", 6. Find handler
       �",
       �-�
�"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�",  ActionHandler      �",
�",   .handle()         �",
�""�"?�"?�"?�"?�"?�"?�"��"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~
       �", 7. Execute logic
       �", 8. Update state
       �",
       �-�
�"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�", PhaseEngine         �",
�",  .advance()         �", �-"�"?�"?�"?�"?�"?�"? Optional: Transition de phase
�""�"?�"?�"?�"?�"?�"?�"��"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~
       �", 9. New state
       �",
       �-�
�"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�", VictoryService      �",
�",  .check()           �", �-"�"?�"?�"?�"?�"?�"? Optional: Vérifier victoire
�""�"?�"?�"?�"?�"?�"?�"��"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~
       �", 10. Save state
       �",
       �-�
�"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�", GameCoreService     �",
�",  .saveState()       �",
�""�"?�"?�"?�"?�"?�"?�"��"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~
       �", 11. Broadcast
       �",
       �-�
�"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�", GameGateway         �",
�",  .broadcast()       �",
�""�"?�"?�"?�"?�"?�"?�"��"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~
       �", 12. Emit 'game:state:update'
       �",
       �-�
�"O�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"�
�",   CLIENT    �",
�""�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"~
```

### Étapes Détaillées

1. **Client émet l'action** : WebSocket event `game:action`
2. **Gateway valide** : Vérifie l'authentification et les permissions
3. **Engine charge l'état** : Récupère l'état actuel depuis la base de données
4. **Validation** : L'adaptateur valide l'action (optionnel)
5. **Application** : L'adaptateur applique l'action
6. **Dispatch** : Le dispatcher trouve le handler approprié
7. **Exécution** : Le handler exécute la logique métier
8. **Mise à jour** : L'état est mis à jour
9. **Phase** : Transition de phase si nécessaire
10. **Victoire** : Vérification des conditions de victoire
11. **Sauvegarde** : État sauvegardé dans la base de données
12. **Broadcast** : Nouvel état envoyé à tous les clients

---

## Créer un Nouveau Jeu

### Étape 1 : Structure de Dossiers

Créez la structure suivante dans `backend/src/game/games/` :

```
my-game/
�"o�"?�"? actions/                    # Action handlers
�",   �"o�"?�"? my-action.handler.ts
�",   �""�"?�"? ...
�"o�"?�"? bots/                       # IA
�",   �""�"?�"? my-game-bot.service.ts
�"o�"?�"? definitions/                # Configurations statiques
�",   �"o�"?�"? game.definition.ts
�",   �"o�"?�"? rules.definition.ts
�",   �""�"?�"? victory.definition.ts
�"o�"?�"? model/                      # Types et entités
�",   �"o�"?�"? my-game.model.ts
�",   �""�"?�"? content/                # Fichiers JSON
�",       �"o�"?�"? cards.json
�",       �""�"?�"? ...
�"o�"?�"? phases/                     # Gestion des phases
�",   �""�"?�"? my-game-phase.service.ts
�"o�"?�"? presenter/                  # Exposition d'état
�",   �""�"?�"? my-game-presenter.service.ts
�"o�"?�"? rulebook/                   # Validation
�",   �""�"?�"? rulebook.ts
�"o�"?�"? setup/                      # Initialisation
�",   �""�"?�"? my-game-setup.service.ts
�"o�"?�"? tests/                      # Tests
�",   �"o�"?�"? my-game.service.spec.ts
�",   �""�"?�"? my-game.scenario.spec.ts
�"o�"?�"? manifest.json              # Métadonnées du jeu
�"o�"?�"? my-game.module.ts          # Module NestJS
�"o�"?�"? my-game.service.ts         # Service principal
�""�"?�"? README.md                  # Documentation
```

### Étape 2 : Définir les Métadonnées

**`model/my-game.model.ts`**

```typescript
import { DeckPoolState } from '../../../../modules/cards/services/deck-pool.service';

export type MyGameMetadata = {
  gameType?: string;
  phase: string;
  round: number;
  // ... vos métadonnées spécifiques
};

export type MyGameCard = {
  id: string;
  name: string;
  // ... propriétés de carte
};
```

### Étape 3 : Créer le Service Principal

**`my-game.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { AbstractGameService } from '../../../engine/abstract/abstract-game.service';
import { GameRegistryService } from '../../../engine/services/game-registry.service';
import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type { GameSingleActionDto, GameStateWithActions } from '../../../engine/dto/game-action.dto';
import { ActionDispatcherService } from '../../../engine/services/action-dispatcher.service';
import { MyGameSetupService } from './setup/my-game-setup.service';
import { MyGamePresenterService } from './presenter/my-game-presenter.service';
import * as MyGameRulebook from './rulebook/rulebook';

@Injectable()
export class MyGameService extends AbstractGameService {
  readonly gameType = 'my-game';
  readonly category = 'MyCategory';
  readonly displayName = 'My Awesome Game';
  readonly minPlayers = 2;
  readonly maxPlayers = 4;

  private readonly dispatcher: ActionDispatcherService = new ActionDispatcherService();

  constructor(
    registry: GameRegistryService,
    private readonly setup: MyGameSetupService,
    private readonly presenter: MyGamePresenterService,
  ) {
    super(registry);
    this.initializeActionHandlers();
  }

  private initializeActionHandlers(): void {
    // Enregistrer vos handlers ici
    // this.dispatcher.register(new MyActionHandler(...));
  }

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const metadata = this.setup.buildMetadata();
    const players = this.setup.initializePlayers(baseState, metadata);

    return {
      ...baseState,
      players,
      metadata,
      status: 'started',
      turn: {
        currentPlayerId: players[0]?.id ?? null,
        direction: 1,
      },
      turnIndex: 0,
    };
  }

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    let next = state;

    for (const action of actions) {
      const actorId = this.extractActorId(action);

      try {
        next = this.dispatcher.dispatch(next, action, actorId);
      } catch (error) {
        // Gérer l'erreur
        console.error('Action error:', error);
      }
    }

    return next;
  }

  getAvailableActions(state: GameStateEntity, playerId: number): GameSingleActionDto[] {
    return MyGameRulebook.getAvailableActions(state, playerId);
  }

  validateAction(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameSingleActionDto {
    return MyGameRulebook.validateAction(state, action, actorId);
  }

  exposeState(state: GameStateEntity): GameStateWithActions {
    return this.presenter.exposeState(state);
  }

  exposeStateForUser(state: GameStateEntity, userId: number): GameStateWithActions {
    return this.presenter.exposeStateForUser(state, userId);
  }
}
```

### Étape 4 : Créer le Setup Service

**`setup/my-game-setup.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { MyGameMetadata } from '../model/my-game.model';

@Injectable()
export class MyGameSetupService {
  buildMetadata(): MyGameMetadata {
    return {
      gameType: 'my-game',
      phase: 'setup',
      round: 1,
      // ... initialiser vos métadonnées
    };
  }

  initializePlayers(baseState: GameStateEntity, metadata: MyGameMetadata): any[] {
    return (baseState.players ?? []).map(p => ({
      id: p.id,
      username: p.username,
      isBot: (p as any).isBot ?? false,
      // ... propriétés spécifiques au joueur
    }));
  }
}
```

### Étape 5 : Créer le Presenter Service

**`presenter/my-game-presenter.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { BasePresenterService } from '../../../../engine/abstract/base-presenter.service';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { MyGameMetadata } from '../model/my-game.model';
import { MY_GAME_PHASES } from '../definitions/rules.definition';
import { MY_GAME_VICTORY } from '../definitions/victory.definition';

@Injectable()
export class MyGamePresenterService extends BasePresenterService {
  protected buildCatalog(): { phases: string[]; victory: any } {
    return {
      phases: MY_GAME_PHASES.map(p => p.id),
      victory: MY_GAME_VICTORY,
    };
  }

  protected buildPendingState(
    state: GameStateEntity,
    metadata: MyGameMetadata,
    currentPlayerId: number | null,
  ): any {
    // Retourner l'état pending (quiz, choix, etc.)
    return null;
  }

  protected buildExtras(
    state: GameStateEntity,
    metadata: MyGameMetadata,
    currentPlayerId: number | null,
  ): Record<string, unknown> {
    const baseExtras = this.getBaseExtras(state);

    return {
      ...baseExtras,
      // ... vos extras spécifiques
    };
  }
}
```

### Étape 6 : Créer le Module

**`my-game.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { MyGameService } from './my-game.service';
import { MyGameSetupService } from './setup/my-game-setup.service';
import { MyGamePresenterService } from './presenter/my-game-presenter.service';

@Module({
  providers: [
    MyGameService,
    MyGameSetupService,
    MyGamePresenterService,
  ],
  exports: [MyGameService],
})
export class MyGameModule {}
```

### Étape 7 : Enregistrer le Jeu

**`backend/src/game/game.module.ts`**

```typescript
import { MyGameModule } from './games/my-category/my-game/my-game.module';

@Module({
  imports: [
    // ... autres modules
    MyGameModule,
  ],
})
export class GameModule {}
```

### Étape 8 : Créer le Manifest

**`manifest.json`**

```json
{
  "id": "my-game",
  "name": "My Awesome Game",
  "category": "MyCategory",
  "description": "Description de mon jeu",
  "minPlayers": 2,
  "maxPlayers": 4,
  "version": "1.0.0"
}
```

---

## Ajouter une Action

### Étape 1 : Créer le Handler

**`actions/my-action.handler.ts`**

```typescript
import type { ActionHandler } from '../../../../engine/services/action-dispatcher.service';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';

export class MyActionHandler implements ActionHandler {
  readonly actionType = 'my_action';

  constructor(
    private readonly handleFn: (
      state: GameStateEntity,
      action: GameSingleActionDto,
      actorId: number | null,
    ) => GameStateEntity,
  ) {}

  handle(
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ): GameStateEntity {
    return this.handleFn(state, action, actorId);
  }
}
```

### Étape 2 : Implémenter la Logique

Dans votre service principal :

```typescript
private handleMyAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameStateEntity {
  const meta = state.metadata as MyGameMetadata;
  const players = state.players;

  // Votre logique ici

  return {
    ...state,
    metadata: { ...meta, /* modifications */ },
    players,
  };
}
```

### Étape 3 : Enregistrer le Handler

```typescript
private initializeActionHandlers(): void {
  const wrapperMyAction = (
    state: GameStateEntity,
    action: GameSingleActionDto,
    actorId: number | null,
  ) => this.handleMyAction(state, action, actorId);

  this.dispatcher.register(new MyActionHandler(wrapperMyAction));
}
```

### Étape 4 : Ajouter au Rulebook

**`rulebook/rulebook.ts`**

```typescript
export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  const actions: GameSingleActionDto[] = [];

  // Vérifier si l'action est disponible
  if (/* conditions */) {
    actions.push({
      type: 'my_action',
      payload: { /* ... */ },
    });
  }

  return actions;
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = action.type as MyGameActionType;

  if (type === 'my_action') {
    // Valider le payload
    // Vérifier les permissions
    // Normaliser les données
  }

  return action;
}
```

---

## Ajouter une Phase

### Étape 1 : Définir les Phases

**`definitions/rules.definition.ts`**

```typescript
import type { PhaseDefinition } from '../../../../modules/state/services/phase-engine.service';
import type { MyGameMetadata } from '../model/my-game.model';

export const MY_GAME_PHASES: PhaseDefinition<MyGameMetadata>[] = [
  {
    id: 'setup',
    canEnter: (state) => state.status === 'open',
    onEnter: (state) => {
      return {
        ...state,
        metadata: {
          ...state.metadata as MyGameMetadata,
          phase: 'setup',
        },
      };
    },
  },
  {
    id: 'playing',
    canEnter: (state) => {
      const meta = state.metadata as MyGameMetadata;
      return meta.phase === 'setup';
    },
    onEnter: (state) => {
      return {
        ...state,
        metadata: {
          ...state.metadata as MyGameMetadata,
          phase: 'playing',
        },
      };
    },
  },
  {
    id: 'finished',
    canEnter: (state) => {
      const meta = state.metadata as MyGameMetadata;
      // Vérifier conditions de fin
      return false;
    },
    onEnter: (state) => {
      return {
        ...state,
        status: 'finished',
        metadata: {
          ...state.metadata as MyGameMetadata,
          phase: 'finished',
        },
      };
    },
  },
];
```

### Étape 2 : Créer le Phase Service

**`phases/my-game-phase.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PhaseEngineService } from '../../../../modules/state/services/phase-engine.service';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { MyGameMetadata } from '../model/my-game.model';
import { MY_GAME_PHASES } from '../definitions/rules.definition';

@Injectable()
export class MyGamePhaseService {
  constructor(
    private readonly phases: PhaseEngineService<MyGameMetadata>,
  ) {}

  advance(state: GameStateEntity): GameStateEntity {
    return this.phases.tryAdvance(state, MY_GAME_PHASES);
  }

  getCurrentPhase(state: GameStateEntity): string {
    const meta = state.metadata as MyGameMetadata;
    return meta.phase ?? 'setup';
  }
}
```

---

## Implémenter un Bot

### Étape 1 : Créer le Bot Service

**`bots/my-game-bot.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { MyGameMetadata } from '../model/my-game.model';

@Injectable()
export class MyGameBotService {
  getBotActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    const meta = state.metadata as MyGameMetadata;
    const availableActions = this.getAvailableActions(state, botPlayerId);

    if (!availableActions.length) {
      return [];
    }

    // Stratégie simple : choisir une action au hasard
    const randomAction = availableActions[
      Math.floor(Math.random() * availableActions.length)
    ];

    return [randomAction];
  }

  private getAvailableActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    // Récupérer les actions disponibles
    return [];
  }
}
```

### Étape 2 : Stratégie Avancée

```typescript
import type { BotStrategy } from '../../../../modules/bot/bot-strategy.interface';

export class MyGameBotStrategy implements BotStrategy {
  readonly difficulty: 'easy' | 'medium' | 'hard';

  constructor(difficulty: 'easy' | 'medium' | 'hard' = 'medium') {
    this.difficulty = difficulty;
  }

  getActions(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    switch (this.difficulty) {
      case 'easy':
        return this.easyStrategy(state, botPlayerId);
      case 'medium':
        return this.mediumStrategy(state, botPlayerId);
      case 'hard':
        return this.hardStrategy(state, botPlayerId);
    }
  }

  private easyStrategy(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    // Choix aléatoire
    return [];
  }

  private mediumStrategy(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    // Logique heuristique
    return [];
  }

  private hardStrategy(
    state: GameStateEntity,
    botPlayerId: number,
  ): GameSingleActionDto[] {
    // Algorithme optimisé (minimax, etc.)
    return [];
  }
}
```

---

## Debugging

### Inspecter l'État du Jeu

#### Via les Logs

```typescript
import { playingLog } from '../../../../../common/utils/playing-logger';

private log(label: string, state: GameStateEntity, payload: Record<string, unknown>): void {
  const meta = state.metadata as MyGameMetadata;

  playingLog(label, {
    roomId: meta?.roomId ?? null,
    gameType: this.gameType,
    turnIndex: state?.turnIndex ?? null,
    currentPlayerId: state?.turn?.currentPlayerId ?? null,
    ...payload,
  });
}

// Utilisation
this.log('action.my_action', state, {
  actorId: 123,
  payload: action.payload,
});
```

#### Via le GameEngineService

```typescript
// Dans le backend
const state = await this.gameEngine.getState(roomId, gameType);
console.log('Current state:', JSON.stringify(state, null, 2));
```

#### Via le Client

```typescript
// Dans le client Java
socket.on("game:state:update", (data) => {
  System.out.println("State: " + data);
});
```

### Breakpoints et Debug

1. **VSCode Launch Configuration**

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "start:dev"],
  "cwd": "${workspaceFolder}/backend",
  "console": "integratedTerminal",
  "skipFiles": ["<node_internals>/**"]
}
```

2. **Ajouter des Breakpoints**
   - Ouvrez le fichier du service
   - Cliquez à gauche du numéro de ligne
   - Lancez le debugger (F5)

3. **Inspecter les Variables**
   - Variables locales : panneau "Variables"
   - Watch expressions : panneau "Watch"
   - Call stack : panneau "Call Stack"

### Vérifier les Validations

```typescript
export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  console.log('Validating action:', {
    type: action.type,
    payload: action.payload,
    actorId,
    currentPlayer: state.turn?.currentPlayerId,
  });

  // Validation logic

  return action;
}
```

---

## Tests

### Tests Unitaires

**`tests/my-game.service.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MyGameService } from '../my-game.service';
import { MyGameSetupService } from '../setup/my-game-setup.service';
import { MyGamePresenterService } from '../presenter/my-game-presenter.service';

describe('MyGameService', () => {
  let service: MyGameService;
  let setup: MyGameSetupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyGameService,
        MyGameSetupService,
        MyGamePresenterService,
        // Mock des dépendances
      ],
    }).compile();

    service = module.get<MyGameService>(MyGameService);
    setup = module.get<MyGameSetupService>(MyGameSetupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('hydrateInitialState', () => {
    it('should initialize game state correctly', () => {
      const baseState = {
        players: [
          { id: 1, username: 'Player1' },
          { id: 2, username: 'Player2' },
        ],
        metadata: {},
      };

      const result = service.hydrateInitialState(baseState as any);

      expect(result.status).toBe('started');
      expect(result.players).toHaveLength(2);
      expect(result.turn?.currentPlayerId).toBe(1);
    });
  });

  describe('applyActions', () => {
    it('should apply action correctly', () => {
      const state = {
        /* ... */
      };
      const actions = [{ type: 'my_action', payload: {} }];

      const result = service.applyActions(state as any, actions);

      expect(result).toBeDefined();
      // Vérifier les modifications
    });
  });
});
```

### Tests de Scénarios

**`tests/my-game.scenario.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MyGameService } from '../my-game.service';

describe('MyGameService - Scenarios', () => {
  let service: MyGameService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        /* providers */
      ],
    }).compile();

    service = module.get<MyGameService>(MyGameService);
  });

  it('complete game flow', () => {
    // 1. Initialize game
    let state = service.hydrateInitialState({
      players: [
        { id: 1, username: 'Player1' },
        { id: 2, username: 'Player2' },
      ],
      metadata: {},
    } as any);

    expect(state.status).toBe('started');

    // 2. Player 1 plays
    state = service.applyActions(state, [
      { type: 'my_action', payload: {}, actorId: 1 },
    ]);

    // 3. Verify state
    expect(state.turn?.currentPlayerId).toBe(2);

    // 4. Player 2 plays
    state = service.applyActions(state, [
      { type: 'my_action', payload: {}, actorId: 2 },
    ]);

    // 5. Continue until game ends
    // ...

    // 6. Verify victory
    expect(state.status).toBe('finished');
  });
});
```

### Tests des Handlers

```typescript
describe('MyActionHandler', () => {
  it('should handle action correctly', () => {
    const handler = new MyActionHandler((state, action, actorId) => {
      return { ...state, /* modifications */ };
    });

    const state = { /* ... */ };
    const action = { type: 'my_action', payload: {} };

    const result = handler.handle(state as any, action, 1);

    expect(result).toBeDefined();
  });
});
```

### Patterns de Tests

#### 1. **Fixtures**

```typescript
// tests/fixtures.ts
export const createBaseState = () => ({
  players: [
    { id: 1, username: 'Player1', isBot: false },
    { id: 2, username: 'Player2', isBot: false },
  ],
  status: 'started' as const,
  turn: { currentPlayerId: 1, direction: 1 as const },
  turnIndex: 0,
  metadata: {},
});

export const createAction = (type: string, payload: any = {}) => ({
  type,
  payload,
  actorId: 1,
});
```

#### 2. **Helpers**

```typescript
// tests/helpers.ts
export function applyMultipleActions(
  service: MyGameService,
  state: GameStateEntity,
  actions: GameSingleActionDto[],
): GameStateEntity {
  return actions.reduce(
    (currentState, action) => service.applyActions(currentState, [action]),
    state,
  );
}
```

---

## Patterns et Bonnes Pratiques

### 1. Template Method Pattern

Utilisé dans `AbstractGameService` et `BasePresenterService` :

```typescript
// Classe de base définit le squelette
abstract class AbstractGameService {
  // Méthode template
  protected processAction(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    const validated = this.validateAction(state, action);
    const applied = this.applyAction(state, validated);
    return this.postProcess(applied);
  }

  // Méthodes abstraites à implémenter
  protected abstract applyAction(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity;

  // Méthodes avec implémentation par défaut
  protected postProcess(state: GameStateEntity): GameStateEntity {
    return state;
  }
}
```

### 2. Registry Pattern

Utilisé dans `ActionDispatcherService` :

```typescript
class ActionDispatcherService {
  private handlers = new Map<string, ActionHandler>();

  register(handler: ActionHandler): void {
    this.handlers.set(handler.actionType, handler);
  }

  dispatch(action: GameSingleActionDto): GameStateEntity {
    const handler = this.handlers.get(action.type);
    return handler.handle(state, action);
  }
}
```

### 3. Strategy Pattern

Utilisé pour les bots :

```typescript
interface BotStrategy {
  getActions(state: GameStateEntity, botId: number): GameSingleActionDto[];
}

class EasyBotStrategy implements BotStrategy {
  getActions(state, botId) {
    // Stratégie facile
  }
}

class HardBotStrategy implements BotStrategy {
  getActions(state, botId) {
    // Stratégie difficile
  }
}
```

### 4. Immutabilité

Toujours retourner un nouvel objet état :

```typescript
// OK. BIEN
function updateState(state: GameStateEntity): GameStateEntity {
  return {
    ...state,
    metadata: {
      ...state.metadata,
      round: state.metadata.round + 1,
    },
  };
}

// KO. MAL
function updateState(state: GameStateEntity): GameStateEntity {
  state.metadata.round += 1; // Mutation directe
  return state;
}
```

### 5. Validation en Couches

```typescript
// 1. Validation générique (moteur)
GameEngineService.validateAction()

// 2. Validation spécifique au jeu (rulebook)
MyGameRulebook.validateAction()

// 3. Validation du handler (action-specific)
MyActionHandler.handle() // Vérifications finales
```

### 6. Erreurs Typées

```typescript
import { GameValidationError, PlayerActionError } from '../../../common/errors/game-errors';

// Utiliser des erreurs avec contexte
throw new GameValidationError('Invalid action', {
  gameType: 'my-game',
  action: action.type,
  reason: 'not-your-turn',
});
```

### 7. Logging Structuré

```typescript
import { myGameLog } from '../utils/my-game-logger';

myGameLog('action.my_action', {
  gameType: 'my-game',
  roomId: 123,
  actorId: 456,
  action: 'my_action',
  payload: { /* ... */ },
});
```

---

## Ressources Supplémentaires

- **Exemples de Jeux** :
  - `backend/src/game/games/vents-dansants/la-bande-a-banane/` (jeu complet)
  - `backend/src/game/games/les-quatre-vents/panier-express/` (jeu plateau)
  - `backend/src/game/games/vents-sacres/foulees-fantastiques/` (jeu avec setup)

- **Documentation API** :
  - Voir les JSDoc dans `GameRulesAdapter` interface
  - Voir les JSDoc dans `BasePresenterService`
  - Voir les JSDoc dans `ActionDispatcherService`

- **Template** :
  - Voir `backend/GAME_TEMPLATE/` pour un template complet

---

**Fin du Guide Développeur**


