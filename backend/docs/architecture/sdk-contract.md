# Évolution du contrat auteur

La version courante de l'API auteur est 6.16.0. Elle est indépendante de la
version du backend, des règles des jeux et des schémas de snapshots.

La version 6.16 expose les distributions initiales et placements de grille
déclaratifs dans `GameInitialization`, ainsi que
`counters.drain(counterId)`. Ces ajouts sont compatibles : les déclarations
existantes restent valides, les nouveaux champs sont optionnels et aucun format
de snapshot existant ne change. La variation de déclaration privée du
contrôleur de dés correspond à la sélection déterministe d'un ancien dernier
lancer et n'ajoute aucun nom à la façade publique.

La version 6.11 ajoute `resources.exchange(leftId, rightId, leftOffer, rightOffer)`
et l'instruction JSON `exchange-resources`. Chaque offre contient une ressource
et une quantité entière positive. Les deux offres et les soldes résultants sont
validés avant mutation ou émission d'événement. Les anciennes APIs sont conservées
et aucun champ de snapshot ne change.

La version 6.10 ajoute les instructions `start-round`, `end-round` et
`eliminate-player` à l'union fermée d'effets. Les deux premières refusent un
enchaînement invalide ; la troisième utilise les cibles et validations moteur.
Le JSON peut déclarer une victoire par arrivée, dernier joueur actif ou nombre
de manches, avec classement et égalités explicites. Les états existants ne
changent pas de format. Un ancien moteur refuse ces nouveaux effets ; les
paquets qui les adoptent doivent publier une nouvelle version de règles et
conserver leur ancien contenu pour les sessions qui le référencent.

La version 6.9 ajoute `cards.deckCards` (lecture détachée) et `cards.takeFromDeck`
(retrait validé d'une occurrence). `ChoiceOptions` distingue désormais le type
d'une option de celui du résultat ; les défauts de `many`, `players` et `ordering`
doivent être des listes. Les anciens défauts scalaires doivent être remplacés par
des listes : ils étaient refusés à l'exécution. Les timeouts `last` et `random`
respectent maintenant la cardinalité des choix multiples. Les sélections JSON
`selectCards` utilisent des occurrences, même lorsque les identifiants se répètent.
Les continuations des nouveaux choix sont de simples données, sans fonction.

Les invariants des opérations existantes sont renforcés sans modification de
signature : identités de joueurs entières sûres et non nulles (bots négatifs
acceptés), quantités de cartes entières bornées, correspondance main/pioche et
validation des destinataires avant transfert. `inventory.items()` renvoie une
copie ; les lectures ne créent plus d'inventaires ou de mains. Les mutations
passent par les méthodes du kit. Score et Ranking partagent le même classement.
Les formats persistés sont inchangés ; les états invalides sont refusés.

La version 6.8 ajoute l'empreinte optionnelle `requestFingerprint` au reçu de
commande interne. Les auteurs n'ont aucune adaptation à faire. Une ancienne
sauvegarde reste chargeable ; un ancien reçu sans empreinte ne permet plus de
confirmer une relance et celle-ci est refusée sans mutation. Les nouvelles
commandes utilisent une empreinte SHA-256 préfixée `v1:`. Le catalogue de
références des effets accepte également les identifiants de la session pour
contrôler les cibles sauvegardées, sans figer des joueurs dans le contenu JSON.
La version 6.7 ajoute `cards.deck({ catalog })`, catalogue accepté optionnel
distinct de la pile initiale. Sans cette option, les cartes initiales constituent
le catalogue. Les jeux ajoutant des cartes plus tard doivent déclarer leur univers
complet ; Dame Nature et Olympia le font désormais. Les identifiants étrangers
sont refusés, y compris à la restauration. Aucun champ de snapshot n'est ajouté.
Les snapshots contenant une carte hors catalogue ne sont pas convertis : leur
contenu doit être corrigé explicitement ou repris avec leur runtime historique.
Le nouveau membre privé du contrôleur Cards est un détail interne sans API auteur.
La version 6.6 ajoute les cibles `previous`, `random-player`, `leader` et `last`,
ainsi que l'ordre optionnel `seating`/`turn` des voisins. Les sélecteurs existants
conservent leur comportement et leur représentation sans option. Les classements
imposent une politique explicite d'égalité. La grammaire JSON 1 reçoit ces variantes
compatibles ; une version antérieure du moteur les refuse comme inconnues.
Elle ajoute également les conditions de comparaison du score, des ressources
et des quantités d'inventaire, ainsi que la vérification de propriété.
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

### Version 6.12 — identifiants des bots

playerId, gameInput.playerId et playerMap acceptent les entiers sûrs non nuls :
positifs pour les humains, négatifs pour les bots, conformément aux identifiants
du runtime. Zéro, fractions et dépassements restent refusés. Les types exportés
ne changent pas ; cette extension corrige le refus antérieur des bots dans les
actions ciblées et les votes. Les entrées précédemment valides gardent leur
comportement ; aucune migration de snapshot moteur n'est nécessaire.

### Version 6.13 — mains communes à plusieurs paquets

`cards.hands.acceptedDecks` déclare les paquets supplémentaires autorisés pour la pioche et la défausse. Chaque catalogue doit être couvert par celui du paquet principal, avec une représentation identique des cartes. Les références incompatibles sont rejetées avant le démarrage. Sans cette option, la main conserve son unique paquet. Cette extension additive restaure le fonctionnement explicite des six paquets d’Olympia.

### Version 6.14 — ordre durable des soumissions

SubmissionSession.valueOrder conserve les identifiants dans leur ordre de soumission. Les vues de valeurs reconstituent cet ordre après une persistance JSON qui réorganise les propriétés. Les clés entières positives gardent leur ordre numérique JavaScript historique. Le champ est optionnel pour les anciens snapshots : leur ordre observable est conservé, puis enregistré lors de la prochaine écriture. Un ordre présent mais incohérent est rejeté. L’ordre antérieur déjà perdu dans un ancien stockage JSON ne peut pas être reconstitué. Cette extension ne modifie pas les règles des parties valides en mémoire.

### Version 6.15 — distribution initiale filtrée

`cards.hands.initialDeferredCardIds` et le cinquième argument optionnel de `cards.deal` déclarent les cartes à écarter pendant la distribution. Chaque joueur reçoit les cartes admissibles à tour de rôle ; les cartes écartées sont remises au-dessus de la pioche dans leur ordre de tirage. La distribution est bornée par la pile disponible, sans recyclage automatique des cartes écartées. Sans cette option, le comportement est inchangé. Les références initiales sont vérifiées avant le démarrage et le JSON expose le même champ. Aucun champ de snapshot ni algorithme de replay ne change. Entre Rites et Lumières et Les Mains de la Terre remplacent leurs boucles de setup par cette déclaration, avec traces initiales identiques sur trois graines chacun.
