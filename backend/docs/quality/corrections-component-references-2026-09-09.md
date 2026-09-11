# Références avant démarrage — point 30 encore ouvert

La compilation vérifie désormais l'appartenance d'une carte à la pioche de sa
main, la cohérence des paires pioche/main, les cases visées, les bornes de positions
initiales et les références aux ressources des effets, conditions, collections
et marchés. Les familles ne peuvent plus référencer des cartes d'une pioche vide.
Les branches conditionnelles et réactions et le contenu non installé sont contrôlés.

Le catalogue `resourceIds` est indépendant de l'initialisation des soldes ; les
patterns peuvent aussi déclarer leurs ressources. `marketGame` déclare sa monnaie
même sans solde initial. Six jeux déclarent leurs ressources créées ultérieurement.
Les identifiants littéraux sont préservés dans `GameResourceIdOf` et `GameContextFor`.

Preuves : `component-reference-validation.spec.ts`, `static-effect-references.spec.ts`,
`effect-content.spec.ts` et `game-context-contracts.spec.ts`. La validation complète
hors campagne longue comporte 260 suites / 1 152 tests réussis ; les 152 parcours
de la campagne précédente de cette reprise ont également réussi.

Le point 30 reste ouvert : ces contrôles couvrent les références déclaratives ;
ils ne constituent pas une preuve exhaustive de toutes les références calculées
par les callbacks particuliers et de leurs payloads custom.
