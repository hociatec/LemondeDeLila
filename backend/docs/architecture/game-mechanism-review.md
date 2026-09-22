# Revue des 38 modules de mecanismes

Les 39 definitions du catalogue sont recompilees et rejouees sous une autre
identite par `parameterized-catalog.spec.ts`. La colonne de revue distingue
les modules dont les associations ont ete extraites pendant cette serie
des modules deja exprimes en operations et donnees. Les identifiants
historiques des proprietes restent compatibles.

| Module | Mecanisme | Revue |
| --- | --- | --- |
| `board-movement-landings` | Deplacements et effets de cases | Contrat existant conserve |
| `board-path-walls` | Chemins sur grille et placement de murs | Contrat existant conserve |
| `board-property-economy` | Proprietes, achats, loyers et variantes declarees | Parametrage complete |
| `cards-battle-ties` | Comparaison de valeurs, egalites et reprises de plis | Contrat existant conserve |
| `cards-discard-penalty` | Defausse et penalites par valeurs distinctes | Contrat existant conserve |
| `cards-judged-submission` | Soumissions privees et juge tournant | Contrat existant conserve |
| `cards-ordered-assembly` | Assemblage de collections ordonnees | Contrat existant conserve |
| `cards-ordered-parade` | Sequence ordonnee et recompenses | Contrat existant conserve |
| `cards-public-domain` | Cartes privees, categories collectables et exposition publique | Parametrage complete |
| `cards-ritual-phases` | Phases, familles, echanges et effets de cartes | Parametrage complete |
| `cards-shared-prestige` | Main partagee et modificateurs de scores | Parametrage complete |
| `cards-theme-name` | Combinaison de soumissions et operations speciales liees par donnees | Parametrage complete |
| `choice-anonymous-vote` | Reponses simultanees puis vote anonyme | Parametrage complete |
| `choice-chapter-encounter` | Rencontres, collections et questions multidecks | Parametrage complete |
| `choice-simultaneous-paw-scoring` | Manches simultanees, obstacles, contres et quotas | Parametrage complete |
| `choice-simultaneous-quiz` | Questions simultanees, temps et baremes | Contrat existant conserve |
| `choice-story-challenge` | Defis, choix, transferts et operations ciblees | Parametrage complete |
| `collection-family-effects` | Demandes de familles et effets de cartes | Contrat existant conserve |
| `collection-family-request` | Demande de cartes et completion de familles | Contrat existant conserve |
| `collection-market-exchange` | Echanges de marche et collections | Contrat existant conserve |
| `collection-species-troops` | Groupes collectables, vol, echange et pieges | Parametrage complete |
| `collection-themed-circles` | Completion de groupes de cartes | Contrat existant conserve |
| `collection-track-zones` | Parcours, zones et collections | Contrat existant conserve |
| `race-bidirectional-collision` | Deplacements dans deux directions, regions et collisions | Parametrage complete |
| `race-bounce-quiz` | Rebond, questions et protections | Contrat existant conserve |
| `race-chained-tile-cards` | Cases configurees et resolution de cartes en chaine | Parametrage complete |
| `race-directional-hazards` | Conditions de position, modificateurs et mouvements collectifs | Parametrage complete |
| `race-event-cards` | Parcours et cartes evenement | Contrat existant conserve |
| `race-goose-track` | Cases configurees, rebond, blocage et liberation | Parametrage complete |
| `race-multi-pawn` | Deplacement et selection de plusieurs pions | Contrat existant conserve |
| `race-paired-pawns` | Parcours, gains, rencontres et seuils | Parametrage complete |
| `race-protected-haunted-track` | Protections par categorie et alterations du lancer | Parametrage complete |
| `race-quiz-event-track` | Parcours avec questions, defis et evenements | Contrat existant conserve |
| `race-resource-track` | Faces, ressources, cases et classement configures | Parametrage complete |
| `race-route-delivery` | Itineraires et livraisons | Contrat existant conserve |
| `race-team-pawn-capture` | Groupes de pions, entrees, captures et progression finale | Parametrage complete |
| `race-treasure-track` | Parcours, collections, protections et seuils de victoire | Parametrage complete |
| `spatial-grid-placement` | Placement et alignement sur grille | Contrat existant conserve |

Les roles fixes (depart/arrivee, famille/carte speciale, correct/incorrect),
les operations elementaires (doubler, reculer de un, echanger deux pions)
et les alias de protocole ne constituent pas une connaissance des jeux.
Le quiz simultane conserve son format historique correct/wrong1/wrong2/wrong3.
Leurs limites et la composition des programmes sont decrites dans
[le contrat de parametrage](parameterized-game-mechanisms.md).
