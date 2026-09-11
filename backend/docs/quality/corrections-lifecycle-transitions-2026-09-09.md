# Transitions du lifecycle — point 164

La phase courante possède un seul chemin de mutation : `GameContext.transitionTo`.
Il valide la destination et l'arête du graphe avant toute sortie, exécute le
hook de sortie, annule le timer de l'ancienne phase, entre dans la nouvelle phase
et émet son événement. Une demande vers la phase courante ne répète rien.
L'entrée initiale reste réservée à l'orchestrateur du runtime, hors SDK auteur.

Les états de partie et de manche restent gérés par leurs contrôleurs `match`
et `round`. La fin de tour est coordonnée par `GameTurnController`, qui exécute
les hooks, expirations, tours supplémentaires/sautés et changement de joueur.
Les règles de jeux utilisent ces capacités ; la revue des écritures ne trouve
pas de mutation de phase de session dans les services applicatifs.

`phase-transition-contract.spec.ts` vérifie avec un runtime réel l'ordre des
hooks, le remplacement des timers, l'absence de répétition d'événement et le
refus d'un retour interdit sans modification. Deux tests réussis, journal
`logs/corrections-phase-transition-tests.log`. Ils complètent les 264 suites /
1 180 tests de la série générale, ainsi que les contrôles de typage et de style.
La stabilité des règles automatiques est suivie séparément (161, 162).
