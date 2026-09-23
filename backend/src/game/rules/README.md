# Bibliothèque de règles

- `game-specific/<pack>` : composition métier dont la réutilisation n'est pas démontrée.
- `reusable/<pack>` : composition promue après preuve exécutable et revue (ADR-008).
- `primitives/<pack>` : contribution possédant un contrat indépendant explicitement revu.
- `effect-packs` : registre généré et adaptation du catalogue, sans implémentation métier.

Les capacités élémentaires du noyau restent dans `engine/runtime/kits`, `cards`,
`effects`, `patterns` et `recipes/gameplay`. Elles ne dépendent pas du catalogue.
Les recettes indépendantes de `rules/recipes` séparent aussi détection de collision,
coût de protection et calcul d'un déficit de leurs conséquences métier. Leurs
contrats et preuves de composition sont décrits dans
[ADR-010](../../../docs/architecture/adr-010-orthogonal-rule-capabilities.md).
Chaque pack possède son contrat de données (`program.ts`), son schéma, ses
validations et sa compilation. Ses helpers internes restent dans le même dossier.
Les tests de schéma ont été rapprochés de leur propriétaire ; les campagnes de
replay transversales restent sous `game/testing`.

Le dossier doit correspondre au `scope` de la politique. Le générateur et les
audits refusent un pack absent, dupliqué, non classifié ou rangé au mauvais endroit.
`npm run effects:registry` reconstruit le registre statique dans l'ordre déclaré
par la politique ; aucune découverte de fichiers n'a lieu au runtime.
