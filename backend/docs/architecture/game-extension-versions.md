# Versions des extensions propres aux jeux

Chaque snapshot déclaratif contient `engine.schemaVersion`, `engine.rulesVersion`
et `engine.contentVersion`. `schemaVersion` reprend le `stateVersion` déclaré par
le jeu et couvre son état auteur `game` ainsi que les données moteur attendues.
Le chargeur central compare les trois identités avant toute action ou projection.
Une incompatibilité de schéma ou de règles est refusée sans modifier la sauvegarde.

Chaque projection du runtime publie également `gameContract` :

```json
{
  "gameContract": {
    "stateVersion": 1,
    "rulesVersion": "1",
    "contentVersion": "empreinte-du-catalogue"
  },
  "game": {}
}
```

Ces valeurs identifient l'extension propre au jeu, pour un joueur comme pour un
spectateur. Elles restent présentes après projection de visibilité et présentation
WebSocket. Elles ne donnent accès ni au stockage `engine`, ni à l'état auteur brut.
Le type les rend optionnelles pour accepter les réponses des serveurs antérieurs.

Une modification incompatible de l'état auteur augmente `stateVersion`. Une
modification incompatible des règles ou de la forme de l'extension publique `game`
augmente `rulesVersion`. Une modification du catalogue change son empreinte de
contenu. `viewVersion` reste la version du cadre de vue générique ; `version` et
`runId` identifient respectivement la révision et la génération d'une partie.
Ils ne remplacent aucune de ces versions de contrat.

L'ajout de `gameContract` est compatible et ne modifie pas les snapshots existants.
Un client ancien ignore ce champ ; un client interprétant une extension spécifique
peut vérifier son contrat avant de la lire. Les migrations incompatibles et la
conservation de runtimes historiques restent des travaux distincts : ajouter cette
identité ne fournit pas à lui seul une conversion de sauvegarde.
