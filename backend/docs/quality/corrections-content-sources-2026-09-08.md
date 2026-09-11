# Sources de contenu unifiées

Point **15 clôturé et retiré** ; 280 points restent ouverts.

Validation complète : 229 suites / 877 tests réussis ; typage, lint, build et
chargement AppModule, quality:check, verify:dist (38 manifestes, 80 JSON) et
contrôle du diff réussis. Comparaison : `logs/check-normalized-content.cjs`.
Les tests d’intégration qui nécessitent MySQL ne s’exécutent pas lorsque ce
service est indisponible ; aucun déploiement ni migration SQL réalisé.

Les onze jeux possédant encore des lecteurs d'assets utilisent désormais un
`catalogue.json` importé puis validé par `defineGameContent`. Les autres jeux
utilisaient déjà des données statiques. Les 22 anciens fichiers JSON/TXT de ces
onze jeux sont remplacés ; une sauvegarde octet pour octet précède leur retrait
dans `logs/retired-content-assets.json`.

Les fonctions locales de lecture et leurs parseurs de formats historiques
inutilisés sont supprimés. Le SDK ne fournit plus `gameContentAssets` et son
singleton filesystem. `GameContentLoader` et `FilesystemContentReader`, devenus
sans consommateur de production, sont supprimés avec leurs tests spécifiques.
Les gardes pures restent disponibles dans `content-guards.ts`. La sécurité de
lecture des releases reste testée à la frontière `readContainedContent`.
`verify:dist` contrôle maintenant tous les JSON empaquetés de chaque jeu,
y compris les nouveaux catalogues placés hors de `model/content`.

La conversion conserve les données JSON des 38 jeux, comparées à la capture
antérieure. Quatre empreintes changent parce que JSON omet les propriétés
optionnelles à `undefined` produites par les anciens constructeurs d'effets.
Le moteur reconnaît uniquement les transitions exactes suivantes :

| Jeu | Ancienne empreinte | Nouvelle empreinte |
| --- | --- | --- |
| Aventure Sauvage | c48df7e1 | f577dff1 |
| Mission Galaxie | 6a876766 | 1b17e6f9 |
| Pirates en vadrouille | ddf4bb7f | 3609939f |
| Tout près de Maman | f766ed9f | 6c60e669 |

Ces paires complètent les deux migrations additives de Panier et d'Olympia.
Chaque paire est testée sur un état de partie, avec conservation des données,
absence de mutation de la source et refus d'une version inconnue.
Les versions de règles et de schéma doivent toujours correspondre.
Une release externe n'hérite pas de ces migrations embarquées.

Le SDK 4.0 expose désormais 75 symboles après retrait du lecteur d'assets.
Cette modification explicite du contrat ne relâche aucun seuil de dette.
La sélection des releases externes contient encore des I/O et un cache global :
les points 694–696 restent ouverts.
