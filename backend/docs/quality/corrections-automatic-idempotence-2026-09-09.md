# Stabilité des règles automatiques — points 161 et 162

Le contrat vérifié est celui d'un point fixe : après une stabilisation réussie,
une seconde stabilisation du même état, avec la même horloge, ne change ni son
JSON persistant, ni le RNG, ni ses événements. La vérification reconstruit le
contexte réel et réutilise `DeclarativeLifecycle`, sans exécuter une simulation
alternative des règles. Les états encore en configuration sont exclus jusqu'à
activation de la partie, comme dans le runtime.

La convergence est bornée par le moteur à 32 étapes, avec trace de diagnostic.
Une règle toujours applicable, même si elle augmente continuellement le score,
fait échouer la commande sans modifier son entrée. Les tests négatifs vérifient
ce cas, une mutation répétée et un événement répété malgré un identifiant stable.
Le contrôle ne se limite donc plus à l'unicité des noms de règles.

Les règles particulières suivent leur état métier : déblocage puis suppression
du blocage dans Contes, changement de joueur dans Lama, consommation du statut
de direction dans Panier, et source de pioche mémorisée dans Pimp. Le contrôle
est intégré aux tests des 38 définitions sur huit graines, puis à chaque étape
de la campagne de replay ; toute régression fait échouer les tests.

Validation : 152 parcours sur 38 jeux, quatre graines, 7 087 commandes, zéro échec.
Chaque parcours est borné à 64 commandes ; 65 parcours atteignent une fin de
partie. Il ne s'agit pas d'une exploration exhaustive de tous les états possibles.
Les 39 tests de campagne, les 39 tests de contrats initiaux et les cinq tests
ciblés de stabilité/non-convergence passent. Journaux :
`logs/corrections-automatic-idempotence-campaign.log`,
`logs/corrections-automatic-idempotence-tests.log`,
`logs/corrections-automatic-idempotence-fixtures.log` et
`logs/game-replay-campaign-results.json`.

La série générale actuelle passe également : 264 suites / 1 180 tests, plus
deux tests de transitions de phase ajoutés ensuite. Typage, lint, quality:check,
build/AppModule et verify:dist réussis. Le regroupement des deux assertions de
campagne dans un helper conserve leur logique et respecte le seuil de longueur.
