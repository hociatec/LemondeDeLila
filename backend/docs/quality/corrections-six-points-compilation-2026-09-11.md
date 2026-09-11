# Six points : compilation, capacités et jeu JSON

| Point courant | Correction appliquée |
| --- | --- |
| 5 | Contrats d'authoring et d'exécution séparés ; retrait des patterns exécutables de l'artefact compilé. |
| 6 | Plan intermédiaire neutre, gelé et sérialisable ; son module n'a aucune dépendance vers les builders ou exécuteurs. |
| 14 | `GameContextFor` dérive ses capacités du catalogue compilé et conserve les ressources issues des patterns. |
| 16 | Capacités de composants et d'interactions filtrées ; Scheduler explicite ; forme directe de `defineGame` corrigée. |
| 17 | Installation de Course des étoiles comme package sans TypeScript, découvert par le registre officiel. |
| 18 | Pipeline JSON exécuté sur ce jeu réel ; manifeste validé à la compilation ; audit compatible avec le profil JSON. |

Le [contrat de compilation et la migration des types](../architecture/game-compilation-contract-v6.md)
décrivent le périmètre, notamment la séparation entre plan de données et
callbacks TypeScript, et les possibilités actuelles du format JSON v1.

## Validation

- 97 tests Jest couvrent compilation, capacités, documents invalides, runtime
  et contrats déterministes des 39 jeux ; les trois suites concernées par
  la dernière correction du catalogue de ressources passent (15 tests).
- 34 tests Node couvrent le registre, les audits de packages et le graphe du
  runtime, dont l'absence de dépendances dans le plan neutre.
- Contrôle TypeScript, audits d'architecture, de disposition et de séparation
  du runtime validés, sans augmentation de baseline d'architecture.
- Contrat de déclarations SDK versionné en 6.0.0 et référence actualisée.
- Compilation et chargement du module applicatif compilé réussis.

Seuls les points 5, 6, 14, 16, 17 et 18 sont retirés de la liste courante.
Les autres chantiers du schéma JSON et la conversion des jeux existants restent
dans `corriger.txt`.
