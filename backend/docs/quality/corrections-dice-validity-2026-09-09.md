# Validité des dés — 9 septembre 2026

Point 569 clôturé après validation : 255 suites / 1 117 tests hors campagne
longue, typage, lint, build/AppModule, quality:check, verify:dist et contrôle
du diff réussis. Le fichier de travail conserve 251 points ouverts.

## Défauts reproduits

La validation globale imposait le nombre de dés de base et une somme brute,
alors que `rollWith` accepte des dés supplémentaires, la sélection d'un dé,
un multiplicateur et un modificateur. Tout près de Maman utilise effectivement
les dés supplémentaires. Un résultat autorisé par le contrôleur pouvait donc
faire refuser la commande après son exécution.

Les relances perdaient également les dés supplémentaires. Les résultats par
joueur n'étaient pas validés, et le compteur de séquence pouvait dépasser
la borne des entiers exacts. Sept des huit premiers tests ciblés reproduisent
ces défauts avant correction ; le test du résultat classique valide passe.

## Correction

`assertDiceRoll` est commun au contrôleur et à la validation de session. Les
résultats persistés capturent les paramètres arithmétiques et de sélection ;
la validation vérifie le nombre de faces gardées, leurs valeurs et le calcul
exact du total. Les définitions, quantités et amplitudes restent bornées.
Les résultats par joueur suivent le même contrat. Le compteur de séquence
est contrôlé avant tirage ; la réinitialisation retire aussi les résultats
des joueurs. Une relance conserve le nombre de dés supplémentaires.

Les résultats renvoyés par `roll`, `rollWith` et `last` restent des copies
`{ values, total }`. Le callback de relance reçoit une copie du résultat,
afin qu'il ne puisse pas modifier le résultat sélectionné.

Les sauvegardes sans paramètres de politique conservent les règles classiques
(nombre de dés déclaré et somme brute). Les champs sont additifs ; aucun
ancien résultat incomplet n'est reconstruit par supposition.

## Preuves

Tests ciblés : politiques de nombre, sélection et arithmétique, données
corrompues par joueur, dépassement de séquence, reset, relance et ancien format.
Tests de Tout près de Maman et de projection inclus. Journaux :
`logs/corrections-dice-policy-{before,targeted}.log` et
`logs/corrections-dice-{all-tests,typecheck-final,lint,build,quality}.log`.
La campagne globale lancée avant correction conserve son résultat historique.
