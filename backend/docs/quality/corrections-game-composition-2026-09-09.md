# Composition des jeux — point 37

Les 38 `game.ts` composent les métadonnées, composants et comportements importés.
Les décisions exécutées pendant une partie ont été déplacées : 21 bots dans
`bot-rules.ts`, 21 mises en place dans `setup-rules.ts`, quatre configurations dans
`configuration.ts`, et 26 groupes de choix/effets/hooks/vues dans `rule-bindings.ts`.
Les corps des fonctions ont été déplacés sans changer leur logique ; les constantes
nécessaires ont suivi leurs consommateurs et les imports inutilisés ont été retirés.

Les fichiers de composition conservent les transformations de métadonnées statiques,
les choix d'actions constants et les délégations directes. L'auditeur refuse les
constructeurs de règles et les décisions inline utilisant le contexte de partie.
Il détecte aussi les alias des imports SDK. Le contrôle transitif du point 36 reste
actif et aucune exception n'a été ajoutée.

Les deux contrats auteur ajoutés sont documentés dans
[game-authoring-files.md](../architecture/game-authoring-files.md).

Validation : 260 suites / 1 152 tests réussis hors campagne longue,
`typecheck`, `lint` et `quality:check` réussis. Journaux :
`logs/corrections-composition-tests.log`, `logs/corrections-composition-typecheck.log`,
`logs/corrections-composition-lint-final.log`, `logs/corrections-composition-quality-final.log`.
La campagne de 152 parcours a passé avant les extractions, qui ne modifient pas
les algorithmes des jeux ; elle n'a pas été rejouée après chaque déplacement.

Le point 39 et la suppression de toutes les mécaniques dupliquées restent ouverts.
