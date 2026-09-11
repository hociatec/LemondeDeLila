# Préparation des schémas — 9 septembre 2026

Points 644–646 clôturés et retirés après validation. Il reste 255 points ouverts.

Défaut reproduit avant correction : modifier les limites, les membres d'une enum
ou les champs d'un objet après création de son schéma changeait le parsing sans
recréer le schéma. Preuve : logs/corrections-schema-capture-before.log.

Les fabriques capturent désormais les options, listes, alternatives et fonctions
de parsing. Les champs d'objet sont préparés une fois, pas réénumérés à chaque
action. Les objets de schéma retournés sont gelés et leurs descriptions restent
des copies indépendantes. Un champ déclaré __proto__ est conservé comme donnée
propre sans modifier le prototype du résultat.

Cela complète la compilation existante des définitions, contenus, références
statiques et priorités automatiques. Aucun cache global ni traitement spécifique
à un jeu n'est ajouté. Un callback personnalisé reste responsable de sa propre
pureté : capturer sa fonction ne rend pas magiquement immuable son état externe.

## Mesures

Mesure avant modification, puis après, avec tools/game-input-benchmark.cjs :
20 000 parsings de chauffe, sept séries de 100 000 parsings d'un même objet
représentatif (champs scalaires, enum, optionnel, tableau d'objets).

| Mesure | Avant | Après |
| --- | --- | --- |
| Médiane pour 100 000 parsings | 155,59 ms | 87,47 ms |
| Maximum des sept séries | 166,48 ms | 98,05 ms |
| Somme de contrôle | 30 240 000 | 30 240 000 |

La médiane baisse d'environ 44 % sur ce microbenchmark. Ce n'est pas une mesure
de latence HTTP/WS ni un résultat de charge serveur. Les valeurs retournées sont
comparées aux valeurs attendues, pas seulement chronométrées.
Journaux : logs/corrections-schema-benchmark-{before,after}.log.

## Validation

Quatre suites / 56 tests ciblés réussis, typage complet et contrôle structurel
réussis. Les catalogues restent identiques selon le comparateur de contenu.
Validation finale : **246 suites / 1 050 tests réussis**, typage, lint, build/AppModule, quality:check, verify:dist et contrôle du diff réussis. Journaux : logs/corrections-schema-{all-tests,typecheck,lint,build,quality}.log.

Les points 641–642 et 647 restent ouverts : aucun résultat global sur les caches,
toutes les allocations ou tous les chemins chauds n'est revendiqué. Le point
643 est couvert par la compilation/capture des schémas décrite ci-dessus.
