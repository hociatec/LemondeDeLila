# Guide DÃ©veloppeur - Moteur de Jeux

**DerniÃ¨re mise Ã  jour** : 21 dÃ©cembre 2025
**Version** : 1.0.0

---

## Table des matiÃ¨res

1. [Introduction](#introduction)
2. [Architecture Globale](#architecture-globale)
3. [Flow d'une Action](#flow-dune-action)
4. [CrÃ©er un Nouveau Jeu](#crÃ©er-un-nouveau-jeu)
5. [Ajouter une Action](#ajouter-une-action)
6. [Ajouter une Phase](#ajouter-une-phase)
7. [ImplÃ©menter un Bot](#implÃ©menter-un-bot)
8. [Debugging](#debugging)
9. [Tests](#tests)
10. [Patterns et Bonnes Pratiques](#patterns-et-bonnes-pratiques)

---

## Introduction

Ce guide dÃ©crit l'architecture du moteur de jeux et explique comment crÃ©er de nouveaux jeux, ajouter des fonctionnalitÃ©s, et maintenir le code.

### Concepts ClÃ©s

- **GameRulesAdapter** : Interface que chaque jeu doit implÃ©menter
- **GameStateEntity** : Ã‰tat partagÃ© de la partie (joueurs, tour, metadata)
- **Metadata** : DonnÃ©es spÃ©cifiques au jeu (deck, scores, phases, etc.)
- **Actions** : OpÃ©rations que les joueurs peuvent effectuer
- **Phases** : Ã‰tapes du dÃ©roulement d'une partie
- **Bots** : IA qui joue Ã  la place des joueurs

---

## Architecture Globale

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        GAME ENGINE                               â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ GameRegistry â”‚â”€â”€â”€â”€â”€â”€â”‚ GameEngine   â”‚â”€â”€â”€â”€â”€â”€â”‚ RoomService  â”‚  â”‚
â”‚  â”‚  Service     â”‚      â”‚   Service    â”‚      â”‚              â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚         â”‚                      â”‚                      â”‚         â”‚
â”‚         â”‚                      â”‚                      â”‚         â”‚
â”‚         â–¼                      â–¼                      â–¼         â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚              GAME RULES ADAPTER                          â”‚  â”‚
â”‚  â”‚  (Interface implÃ©mentÃ©e par chaque jeu)                  â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚         â”‚                      â”‚                      â”‚         â”‚
â”‚         â–¼                      â–¼                      â–¼         â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚   Setup      â”‚      â”‚   Actions    â”‚      â”‚  Presenter   â”‚  â”‚
â”‚  â”‚   Service    â”‚      â”‚   Handlers   â”‚      â”‚   Service    â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚                                                                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     ABSTRACT SERVICES                            â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ AbstractGame     â”‚  â”‚ BasePresenter    â”‚  â”‚ ActionDisp.  â”‚  â”‚
â”‚  â”‚   Service        â”‚  â”‚    Service       â”‚  â”‚   Service    â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚                                                                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                       SHARED MODULES                             â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ DeckPool   â”‚  â”‚   Turn     â”‚  â”‚   Phase    â”‚  â”‚ Victory  â”‚  â”‚
â”‚  â”‚  Service   â”‚  â”‚  Service   â”‚  â”‚  Engine    â”‚  â”‚ Service  â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚                                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ ActionLog  â”‚  â”‚   Bot      â”‚  â”‚   Quiz     â”‚  â”‚  Logger  â”‚  â”‚
â”‚  â”‚  Service   â”‚  â”‚  Strategy  â”‚  â”‚  Runner    â”‚  â”‚ Service  â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚                                                                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Composants Principaux

#### 1. **GameEngineService**
- Point d'entrÃ©e principal pour toutes les opÃ©rations de jeu
- GÃ¨re l'application des actions et le dÃ©clenchement des bots
- Sauvegarde l'Ã©tat et broadcast aux clients

#### 2. **GameRegistryService**
- Enregistre tous les jeux disponibles
- Fournit l'accÃ¨s aux adaptateurs de rÃ¨gles

#### 3. **GameRulesAdapter**
- Interface que chaque jeu doit implÃ©menter
- MÃ©thodes clÃ©s : `hydrateInitialState()`, `applyActions()`, `exposeState()`

#### 4. **AbstractGameService**
- Classe de base pour tous les jeux
- Fournit des mÃ©thodes communes (template method pattern)
- MÃ©thodes : `extractActorId()`, `isPlayerBot()`, `findPlayer()`, etc.

#### 5. **BasePresenterService**
- Classe de base pour les presenters
- GÃ¨re l'exposition de l'Ã©tat au client
- Template methods pour personnalisation

#### 6. **ActionDispatcherService**
- Registry pattern pour les handlers d'actions
- Remplace les switch/case par un systÃ¨me extensible

---

## Flow d'une Action

Voici le flow complet d'une action joueur, du client au serveur et retour :

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   CLIENT    â”‚
â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜
       â”‚ 1. Emit 'game:action'
       â”‚    { type: 'draw', payload: {} }
       â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  GameGateway        â”‚
â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
       â”‚ 2. Validate WebSocket
       â”‚
       â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ GameEngineService   â”‚
â”‚  .applyActions()    â”‚
â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
       â”‚ 3. Load current state
       â”‚
       â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ GameRulesAdapter    â”‚
â”‚  .validateAction()  â”‚ â—„â”€â”€â”€â”€â”€â”€ Optional: Validation spÃ©cifique au jeu
â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
       â”‚ 4. Action validÃ©e
       â”‚
       â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ GameRulesAdapter    â”‚
â”‚  .applyActions()    â”‚
â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
       â”‚ 5. Dispatch action
       â”‚
       â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ ActionDispatcher    â”‚
â”‚  .dispatch()        â”‚
â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
       â”‚ 6. Find handler
       â”‚
       â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  ActionHandler      â”‚
â”‚   .handle()         â”‚
â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
       â”‚ 7. Execute logic
       â”‚ 8. Update state
       â”‚
       â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ PhaseEngine         â”‚
â”‚  .advance()         â”‚ â—„â”€â”€â”€â”€â”€â”€ Optional: Transition de phase
â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
       â”‚ 9. New state
       â”‚
       â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ VictoryService      â”‚
â”‚  .check()           â”‚ â—„â”€â”€â”€â”€â”€â”€ Optional: VÃ©rifier victoire
â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
       â”‚ 10. Save state
       â”‚
       â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ GameCoreService     â”‚
â”‚  .saveState()       â”‚
â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
       â”‚ 11. Broadcast
       â”‚
       â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ GameGateway         â”‚
â”‚  .broadcast()       â”‚
â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
       â”‚ 12. Emit 'game:state:update'
       â”‚
       â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   CLIENT    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Ã‰tapes DÃ©taillÃ©es

1. **Client Ã©met l'action** : WebSocket event `game:action`
2. **Gateway valide** : VÃ©rifie l'authentification et les permissions
3. **Engine charge l'Ã©tat** : RÃ©cupÃ¨re l'Ã©tat actuel depuis la base de donnÃ©es
4. **Validation** : L'adaptateur valide l'action (optionnel)
5. **Application** : L'adaptateur applique l'action
6. **Dispatch** : Le dispatcher trouve le handler appropriÃ©
7. **ExÃ©cution** : Le handler exÃ©cute la logique mÃ©tier
8. **Mise Ã  jour** : L'Ã©tat est mis Ã  jour
9. **Phase** : Transition de phase si nÃ©cessaire
10. **Victoire** : VÃ©rification des conditions de victoire
11. **Sauvegarde** : Ã‰tat sauvegardÃ© dans la base de donnÃ©es
12. **Broadcast** : Nouvel Ã©tat envoyÃ© Ã  tous les clients

---

## CrÃ©er un Nouveau Jeu

### Ã‰tape 1 : Structure de Dossiers

CrÃ©ez la structure suivante dans `backend/src/game/games/` :

```
my-game/
â”œâ”€â”€ actions/                    # Action handlers
â”‚   â”œâ”€â”€ my-action.handler.ts
â”‚   â””â”€â”€ ...
â”œâ”€â”€ bots/                       # IA
â”‚   â””â”€â”€ my-game-bot.service.ts
â”œâ”€â”€ definitions/                # Configurations statiques
â”‚   â”œâ”€â”€ game.definition.ts
â”‚   â”œâ”€â”€ rules.definition.ts
â”‚   â””â”€â”€ victory.definition.ts
â”œâ”€â”€ model/                      # Types et entitÃ©s
â”‚   â”œâ”€â”€ my-game.model.ts
â”‚   â””â”€â”€ content/                # Fichiers JSON
â”‚       â”œâ”€â”€ cards.json
â”‚       â””â”€â”€ ...
â”œâ”€â”€ phases/                     # Gestion des phases
â”‚   â””â”€â”€ my-game-phase.service.ts
â”œâ”€â”€ presenter/                  # Exposition d'Ã©tat
â”‚   â””â”€â”€ my-game-presenter.service.ts
â”œâ”€â”€ rulebook/                   # Validation
â”‚   â””â”€â”€ rulebook.ts
â”œâ”€â”€ setup/                      # Initialisation
â”‚   â””â”€â”€ my-game-setup.service.ts
â”œâ”€â”€ tests/                      # Tests
â”‚   â”œâ”€â”€ my-game.service.spec.ts
â”‚   â””â”€â”€ my-game.scenario.spec.ts
â”œâ”€â”€ manifest.json              # MÃ©tadonnÃ©es du jeu
â”œâ”€â”€ my-game.module.ts          # Module NestJS
â”œâ”€â”€ my-game.service.ts         # Service principal
â””â”€â”€ README.md                  # Documentation
```

### Ã‰tape 2 : DÃ©finir les MÃ©tadonnÃ©es

**`model/my-game.model.ts`**

```typescript
import { DeckPoolState } from '../../../../modules/cards/services/deck-pool.service';

export type MyGameMetadata = {
  gameType?: string;
  phase: string;
  round: number;
  // ... vos mÃ©tadonnÃ©es spÃ©cifiques
};

export type MyGameCard = {
  id: string;
  name: string;
  // ... propriÃ©tÃ©s de carte
};
```

### Ã‰tape 3 : CrÃ©er le Service Principal

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
        // GÃ©rer l'erreur
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

### Ã‰tape 4 : CrÃ©er le Setup Service

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
      // ... initialiser vos mÃ©tadonnÃ©es
    };
  }

  initializePlayers(baseState: GameStateEntity, metadata: MyGameMetadata): any[] {
    return (baseState.players ?? []).map(p => ({
      id: p.id,
      username: p.username,
      isBot: (p as any).isBot ?? false,
      // ... propriÃ©tÃ©s spÃ©cifiques au joueur
    }));
  }
}
```

### Ã‰tape 5 : CrÃ©er le Presenter Service

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
    // Retourner l'Ã©tat pending (quiz, choix, etc.)
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
      // ... vos extras spÃ©cifiques
    };
  }
}
```

### Ã‰tape 6 : CrÃ©er le Module

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

### Ã‰tape 7 : Enregistrer le Jeu

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

### Ã‰tape 8 : CrÃ©er le Manifest

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

### Ã‰tape 1 : CrÃ©er le Handler

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

### Ã‰tape 2 : ImplÃ©menter la Logique

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

### Ã‰tape 3 : Enregistrer le Handler

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

### Ã‰tape 4 : Ajouter au Rulebook

**`rulebook/rulebook.ts`**

```typescript
export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  const actions: GameSingleActionDto[] = [];

  // VÃ©rifier si l'action est disponible
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
    // VÃ©rifier les permissions
    // Normaliser les donnÃ©es
  }

  return action;
}
```

---

## Ajouter une Phase

### Ã‰tape 1 : DÃ©finir les Phases

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
      // VÃ©rifier conditions de fin
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

### Ã‰tape 2 : CrÃ©er le Phase Service

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

## ImplÃ©menter un Bot

### Ã‰tape 1 : CrÃ©er le Bot Service

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

    // StratÃ©gie simple : choisir une action au hasard
    const randomAction = availableActions[
      Math.floor(Math.random() * availableActions.length)
    ];

    return [randomAction];
  }

  private getAvailableActions(
    state: GameStateEntity,
    playerId: number,
  ): GameSingleActionDto[] {
    // RÃ©cupÃ©rer les actions disponibles
    return [];
  }
}
```

### Ã‰tape 2 : StratÃ©gie AvancÃ©e

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
    // Choix alÃ©atoire
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
    // Algorithme optimisÃ© (minimax, etc.)
    return [];
  }
}
```

---

## Debugging

### Inspecter l'Ã‰tat du Jeu

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
   - Cliquez Ã  gauche du numÃ©ro de ligne
   - Lancez le debugger (F5)

3. **Inspecter les Variables**
   - Variables locales : panneau "Variables"
   - Watch expressions : panneau "Watch"
   - Call stack : panneau "Call Stack"

### VÃ©rifier les Validations

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
        // Mock des dÃ©pendances
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
      // VÃ©rifier les modifications
    });
  });
});
```

### Tests de ScÃ©narios

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

UtilisÃ© dans `AbstractGameService` et `BasePresenterService` :

```typescript
// Classe de base dÃ©finit le squelette
abstract class AbstractGameService {
  // MÃ©thode template
  protected processAction(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    const validated = this.validateAction(state, action);
    const applied = this.applyAction(state, validated);
    return this.postProcess(applied);
  }

  // MÃ©thodes abstraites Ã  implÃ©menter
  protected abstract applyAction(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity;

  // MÃ©thodes avec implÃ©mentation par dÃ©faut
  protected postProcess(state: GameStateEntity): GameStateEntity {
    return state;
  }
}
```

### 2. Registry Pattern

UtilisÃ© dans `ActionDispatcherService` :

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

UtilisÃ© pour les bots :

```typescript
interface BotStrategy {
  getActions(state: GameStateEntity, botId: number): GameSingleActionDto[];
}

class EasyBotStrategy implements BotStrategy {
  getActions(state, botId) {
    // StratÃ©gie facile
  }
}

class HardBotStrategy implements BotStrategy {
  getActions(state, botId) {
    // StratÃ©gie difficile
  }
}
```

### 4. ImmutabilitÃ©

Toujours retourner un nouvel objet Ã©tat :

```typescript
// âœ… BIEN
function updateState(state: GameStateEntity): GameStateEntity {
  return {
    ...state,
    metadata: {
      ...state.metadata,
      round: state.metadata.round + 1,
    },
  };
}

// âŒ MAL
function updateState(state: GameStateEntity): GameStateEntity {
  state.metadata.round += 1; // Mutation directe
  return state;
}
```

### 5. Validation en Couches

```typescript
// 1. Validation gÃ©nÃ©rique (moteur)
GameEngineService.validateAction()

// 2. Validation spÃ©cifique au jeu (rulebook)
MyGameRulebook.validateAction()

// 3. Validation du handler (action-specific)
MyActionHandler.handle() // VÃ©rifications finales
```

### 6. Erreurs TypÃ©es

```typescript
import { GameValidationError, PlayerActionError } from '../../../common/errors/game-errors';

// Utiliser des erreurs avec contexte
throw new GameValidationError('Invalid action', {
  gameType: 'my-game',
  action: action.type,
  reason: 'not-your-turn',
});
```

### 7. Logging StructurÃ©

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

## Ressources SupplÃ©mentaires

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

**Fin du Guide DÃ©veloppeur**


