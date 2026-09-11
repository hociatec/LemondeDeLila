# Évolution du contrat auteur

La version courante de l'API auteur est 6.5.0. Elle est indépendante de la
version du backend, des règles des jeux et des schémas de snapshots.
Le passage depuis 4.0 retire du contexte auteur les membres réservés au runtime,
et ajoute deux contrats de callbacks ; les 38 jeux et leurs tests de typage
utilisent la nouvelle surface. Voir ADR-006 pour la migration.

La version 5.1 ajoute le champ optionnel `gameContract` au contrat de projection
publique. Le runtime le produit pour chaque vue de joueur ou de spectateur ; les
producteurs plus anciens restent acceptés par le type. Les 77 exports restent
identiques et aucune donnée persistée n'est modifiée par cet ajout.

`npm run sdk:contract` compile en mémoire les déclarations TypeScript depuis
`engine/sdk/public-api.ts`. Il suit récursivement leurs imports, réexports et
`import()` de types, y compris les cycles. L'empreinte couvre les fichiers de
déclarations : paramètres, retours, surcharges, contraintes et défauts génériques,
propriétés optionnelles/readonly et types indirects. Un changement de méthode
d'un contrôleur est détecté même si son exposition utilise `Pick`/`keyof`.
Les erreurs du compilateur font échouer le contrôle avant toute écriture.

La référence `tools/sdk-contract-reference.json` contient les empreintes par
fichier, la version d'API et celle du compilateur. Les corps de fonctions et les
commentaires sont exclus. Les chemins sont relatifs au dépôt. Le contrôle est
volontairement conservateur : une déclaration interne ou un déplacement dans la
chaîne des types peut déclencher une revue sans constituer une rupture publique.
Il ne prouve pas la compatibilité comportementale, qui reste vérifiée par les
tests des règles. Les éventuels types de bibliothèques externes sont identifiés
par version ; les bibliothèques standard suivent la version TypeScript.

Pour faire évoluer l'API :

1. Examiner les déclarations avec `node tools/sdk-contract-check.cjs --print` et
   le diff des sources signalées par le contrôle.
2. Documenter l'effet sur les auteurs : version majeure pour une rupture,
   mineure pour un ajout compatible, corrective pour une correction compatible.
   Mettre à jour la version dans l'outil et l'ADR, avec la migration nécessaire.
   Une modification purement interne peut conserver la version après revue.
3. Adapter les jeux et exemples concernés, puis valider le typage et les tests.
4. Régénérer explicitement la référence avec
   `node tools/sdk-contract-check.cjs --write`, examiner son diff et exécuter
   `npm run sdk:contract` et `npm run quality:check`.

La CI vérifie cette référence sans la régénérer. Le contrôle des 81 noms exportés
et l'interdiction des imports profonds restent également actifs.

Lors de la revue initiale du 11 septembre 2026, les contrats ont été
déplacés et le contexte auteur ne dérive plus de sa classe d'exécution, sans
changement intentionnel de signature publique. Une assertion de compatibilité
bidirectionnelle compare la nouvelle interface à l'ancienne forme structurelle ;
les restrictions readonly et les opérations réservées au runtime sont testées.
La référence inclut aussi les déplacements déjà effectués vers `models` et `ports`.
Les imports profonds ne font pas partie de l'API publique ; les auteurs utilisant
le SDK n'ont pas de migration à effectuer. Les règles et versions persistées ne
changent pas. Voir [la direction des contrats](runtime-contract-direction.md).

La finalisation porte l'API à 6.5.0. Elle ajoute des options compatibles :
`gameInput.number({ coerce: false })`, le rejet des champs inconnus des objets,
et l'ordre de sélection des pions avec démarrage optionnel de la manche.
Les comportements par défaut restent ceux des recettes existantes. Les options
et schémas des handlers sont capturés à leur construction. La référence contient
111 fichiers de déclarations ; les 39 jeux et les contrats de typage la valident.
L'entrée JSON est distincte du SDK : son schéma 1 reçoit l'extension optionnelle
de parcours documentée dans [json-game-authoring.md](json-game-authoring.md).
