# Corrections des quiz et de l'Arche — 21 septembre 2026

Le planificateur conserve le délai automatique lorsqu'un bot n'a plus d'action
à jouer, cherche les autres bots attendus et choisit le délai le plus proche.
L'Arche programme explicitement la pioche du bot suivant après la pause.

Chaque question reçoit un nouvel ordre de réponses produit par le générateur
aléatoire déterministe. Cet ordre est privé et persistant ; affichage, correction
et score utilisent les mêmes positions. Une session sauvegardée sans permutation
conserve l'ordre historique du catalogue.

L'administration et les nouvelles parties lisent désormais le même catalogue,
y compris avec `MNEMO_QUIZ_PATH` et en production. Si ce fichier n'existe pas,
l'administration l'initialise depuis le contenu embarqué, également disponible
dans un déploiement compilé. Chaque nouvelle partie conserve une copie privée
de son contenu : modifier ou retirer une question n'altère pas une partie déjà
commencée, même après restauration et redémarrage. Les anciennes parties sans
copie de contenu continuent de dépendre du catalogue embarqué correspondant.

Validation : 14 suites et 122 tests réussis, comprenant les blocages des bots,
le mélange, la correction, la confidentialité, les éditions administratives,
la restauration et le contrat des jeux déclaratifs. TypeScript, lint ciblé,
architecture, compilation et chargement du module compilé validés. Les trois
tests d'automatisation sont aussi relancés après leur déplacement hors du
répertoire des jeux. Les signatures SDK modifiées sont revues en 6.18.

La passe suivante traite les trois écarts de référence préexistants dans
`game-state.model.ts`, `game-input-schema.ts` et `pawn-selection.recipes.ts` :
la comparaison avec les sources de la référence confirme des ajouts optionnels
compatibles. Leurs empreintes sont régénérées : `npm run sdk:contract` réussit
ses 6 tests et valide les 111 fichiers de déclarations sans écart. Les 5 suites
ciblant les schémas d'entrée, les pions et l'automatisation passent leurs 66 tests.

Le contrôle global `npm run quality:check` avait ensuite signalé le comptage
par statut dans `bug-report-typeorm.repository.ts`. La requête filtre désormais
les six statuts reconnus et borne les groupes retournés à six. La limite porte
sur le résultat agrégé : tous les rapports concernés restent comptés, et
`rejected` reste regroupé dans `refused`.

L'audit de persistance passe, ainsi que ses 5 tests et les 6 tests ciblant le
dépôt et les cas d'usage des signalements. Le nouveau test inspecte le SQL
MySQL généré sans connexion à une base. Le contrôle qualité global complet
n'a pas été relancé après cette correction ciblée.
