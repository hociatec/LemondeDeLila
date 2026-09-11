# Jeux JSON, schéma 1

Le registre importe maintenant le véritable `game.json` et le compile une seule
fois par paquet. Le manifeste fournit l'identité et les limites de joueurs ;
le document fournit les règles. Le même objet compilé alimente les définitions
et les paquets du registre. `create:game --json-only` produit un paquet jouable.

L'entrée `src/game/engine/json/public-api.ts` expose le compilateur et les
descripteurs JSON Schema exportables `urn:lila:game:1` et `urn:lila:effects:1`.
Les schémas sont immuables et tous les objets structurés sont fermés. Les champs
inconnus, nombres encodés en texte, fonctions, accesseurs, prototypes spéciaux,
cycles et arbres de plus de 64 niveaux ou 100 000 valeurs sont refusés.

Le profil actuel couvre les pioches, mains, pistes, dés, inventaires, pions, quiz, ressources et compteurs
initiaux, actions sans paramètres exécutant des effets, phases explicites et
victoires par seuil de score ou de ressource. Les effets utilisent la grammaire
canonique du moteur, avec conditions et cibles imbriquées. Les références sont
vérifiées avant de produire les callbacks moteur ; un effet personnalisé sans
résolveur ou une mécanique sans composant installé échoue à la compilation.

Le champ optionnel `patterns` accepte les unions fermées `race`,
`push-your-luck` et `simultaneous-answers`. Un pattern `race` déclare sa piste,
ses dés et ses effets de cases ; ses composants passent les mêmes validations
de références et de collisions que les composants explicites. La composition
rejette aussi les identifiants de patterns dupliqués et les politiques de tour
incompatibles. Aucune fonction ni chaîne de code exécutable n'est acceptée.

Le champ optionnel `board` décrit une primitive de parcours : déplacement,
résolution ordonnée des cases et continuation après un choix. Ses capacités
optionnelles couvrent la distribution, le choix de pions, la collecte, le quiz
et les échanges. Les actions `board-roll` et `board-draw` sont des recipes du
moteur. Les opérations et leurs `bindings` forment des unions fermées ; elles
n'acceptent aucun callback auteur. La victoire `by-board` est déclenchée par les
opérations d'arrivée. Les références de composants, phases, catalogues et tags,
les collisions de choix et les données d'effets sont validées à compilation.

Panier Express est entièrement décrit par son `game.json` en production :
40 cases, 58 cartes, 30 quiz, six pions, distribution, raccourcis, choix et
victoire. Aucun fichier TypeScript de production ne subsiste dans son paquet.
Trois traces de 150 commandes comparent les événements métier avec l'ancienne
implémentation ; une simulation complète atteint la victoire en 1 048 commandes.
La version de règles 2 refuse les anciens snapshots dont les continuations
avaient une autre forme. Il faut terminer ces parties avant le déploiement ou
effectuer une conversion hors ligne explicitement validée.

Les paramètres arbitraires d'actions, votes et callbacks auteur ne font pas
partie de ce profil JSON. Les champs non pris en charge sont refusés, jamais
ignorés. Les autres jeux peuvent toujours utiliser le SDK TypeScript.

`schemaVersion` versionne la grammaire auteur. `definitionVersion` alimente
`rulesVersion`, indépendamment de la version de l'algorithme moteur et du schéma
d'état. `contentVersion` est l'étiquette auteur incluse dans le document ;
l'identité effective du contenu est calculée sur le document complet. Une
modification de règle change donc cette identité même si l'auteur oublie de
modifier son étiquette. Le chargeur de snapshots refuse alors la restauration
avec les nouvelles règles. Les releases externes utilisent leur SHA-256 vérifié.
L'ordre des clés servant à l'identité est indépendant de la locale du serveur.

Le paquet `src/game/testing/fixtures/json-course` démontre une partie entièrement
JSON jusqu'à la victoire, avec distribution, placement, ressources et tours.
Il reste volontairement un exemple de test, hors catalogue de production.
