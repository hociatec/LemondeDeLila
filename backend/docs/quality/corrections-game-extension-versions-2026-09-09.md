# Identification des extensions spécifiques

Le point 129 est couvert par les versions déjà persistées et l'ajout de
`gameContract` à toutes les projections déclaratives. Les règles d'évolution
sont décrites dans [game-extension-versions.md](../architecture/game-extension-versions.md).
Le champ est transmis aux joueurs et spectateurs sans exposer le stockage moteur.

Le contrat de projection reçoit un champ optionnel compatible ; la référence du
SDK passe de 5.0.0 à 5.1.0. Les 77 noms exportés et les 81 fichiers de déclarations
suivis sont conservés. L'ajout ne modifie aucune donnée persistée ni règle de jeu.

Les tests couvrent des versions non standard, les joueurs/spectateurs, l'absence
de mutation et de fuite d'état, le refus par un runtime incompatible et la
transmission au présentateur WS. Les tests existants du chargeur vérifient le
refus séparé des versions incompatibles de schéma, règles et contenu.

Validation : trois suites ciblées / 44 tests puis 266 suites / 1 193 tests réussis.
Typage, lint, quality:check, build/AppModule et verify:dist passent. Journaux
`logs/corrections-game-extension-*`. Le point 129 est clôturé après ces contrôles.
