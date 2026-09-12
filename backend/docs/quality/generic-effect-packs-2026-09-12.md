# Packs d'effets génériques — 12 septembre 2026

Le moteur ne possède plus de dossier, de contrat ni de scope d'extension propre
à un jeu. Les jeux de production restent des paquets de données (`game.json`,
`manifest.json`, `rules.md`) et composent les capacités du moteur.

Les 38 contributions exécutables sont des packs d'effets avec un contrat fermé :
`scope: 'generic'`, un domaine obligatoire, un schéma, une compilation, des
actions/handlers et une validation. Le registre statique expose également les
packs par domaine : `board` (3), `cards` (9), `choice` (5), `collection` (6),
`race` (14) et `spatial` (1). Le profil de sélection de cartes complète le
domaine `choice` sans contribution exécutable séparée.

Les 39 répertoires ont été renommés avec une capacité générique préfixée par son
domaine, par exemple `board-property-economy`, `cards-discard-penalty` ou
`race-bidirectional-collision`. L'audit refuse désormais un nom qui ne correspond
pas à `<domaine>-<mécanique>`, un scope autre que `generic`, une incohérence de
domaine, un namespace appartenant à un jeu, un consommateur non revu ou une
croissance non validée des LOC.

Les doublons structurels sont recalculés automatiquement. Les gros packs à
consommateur unique conservent une revue comparative obligatoire : être utilisé
par un seul jeu ne transforme pas une capacité du moteur en code appartenant à
ce jeu.

Preuves exécutables :

```text
npm run engine:effects:audit
node tools/runtime-separation-audit.cjs
npm run architecture:test
npm run final:game-contracts
npm run quality:check
```
