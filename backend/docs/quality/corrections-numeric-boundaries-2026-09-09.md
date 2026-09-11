# Parsings numériques et identifiants — 9 septembre 2026

Points **557, 558 et 561 clôturés et retirés** ; aucune clôture implicite des points 559–560.

## Corrections

Les parseurs partagés distinguent nombres décimaux finis et entiers décimaux
sûrs. Ils refusent coercitions de booléens/collections/objets, préfixes partiels,
hexadécimal et dépassements. Une limite de 128 caractères borne le parsing.
Les identifiants room/user, versions de commandes et bornes de choix passent
par ces parseurs. Une version fournie mais invalide ne disparaît plus comme si
elle était absente ; un identifiant de bot invalide ne supprime plus le dernier bot.

Les quatre DTO de pagination utilisent une transformation stricte avant les
contraintes class-validator. Les valeurs omises/null gardent leur contrat
optionnel antérieur. Le moteur conserve les identifiants négatifs des bots ;
les identifiants utilisateurs authentifiés sont des entiers strictement positifs.

Les JWT RS256 et tickets HS256 exigent un sujet décimal canonique et sûr. Une
claim `id` dupliquée doit correspondre exactement au sujet. HTTP peut dériver
l'identifiant du sujet signé ; WS continue à exiger la claim `id`. Les timestamps
JWT non finis sont refusés, même dans un JSON signé contenant `1e999`.

Les conversions ffprobe, index de fragments uploadés, paramètres de journaux,
résultats SQL de classement et de notifications ont été revues/corrigées.
Les conversions restantes sont inventoriées dans
`logs/number-conversions-inventory.json` (photographie avant corrections) :
valeurs internes typées, clés produites par le runtime, configuration validée,
données de contenu contrôlées avant conversion et durées monotones.
Ce travail ne prétend pas supprimer chaque appel à `Number`.

## Précision SQL

Aucune colonne d'identifiant BIGINT n'est actuellement déclarée dans les entities
ou les 39 migrations historiques : les IDs numériques existants sont des INT.
Les options MySQL `supportBigNumbers` et `bigNumberStrings` sont désormais
explicites. Le driver installé utilisait déjà ces valeurs par défaut.
Un identifiant dépassant la plage sûre est refusé par les contrats numériques ;
son adoption métier future nécessitera un contrat string, pas un cast `Number`.

Vérification **réelle MySQL 9.1 + TypeORM** sur une instance temporaire dédiée à
127.0.0.1:13307 : `9007199254740993` et `18446744073709551615` reviennent comme
chaînes décimales exactes. Le test contrôle aussi le petit BIGINT `42`.
Preuve : `logs/check-mysql-big-integers.cjs`,
`logs/corrections-mysql-big-integers.log`. Instance arrêtée par SQL après contrôle
de son répertoire de données ; aucune base applicative utilisée.

## Validation

Avant les derniers changements JWT/MySQL : 238 suites / 1 014 tests réussis.
Après ces changements : 3 suites / 39 tests ciblés réussis, typage complet,
build/chargement AppModule, lint et quality:check réussis.
Nouvelle exécution globale après tous les changements : **238 suites / 1 032 tests réussis** (`logs/corrections-numeric-jwt-all-tests.log`).

Les bornes métier exhaustives et tous les débordements arithmétiques restent
suivis séparément aux points 559 et 560. Cette correction porte sur les conversions
et la représentation aux frontières, pas sur toutes les opérations métier.
