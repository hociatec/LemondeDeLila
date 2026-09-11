# Permissions déclaratives des actions

Le point 572 est couvert par les factories de conditions du SDK :
`whenTurnOfActor`, `whenPhase`, `whenNoPending`, `whenResourceAtLeast` et
`otherPlayer` portent les permissions réutilisables dans les définitions
d'actions. `otherPlayer` délègue maintenant à la garde centrale du contexte,
ce qui évite de répéter existence et exclusion de l'acteur dans les handlers.

Les validations restent exécutées côté serveur par le contrôleur d'actions ;
les énumérations utilisent les mêmes sources de joueurs et de phase.
