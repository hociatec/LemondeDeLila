# Unification de la déclaration des catalogues

Rapport historique de la clôture 14. La passe suivante ferme le point 15 et
complète les compatibilités : [sources unifiées](corrections-content-sources-2026-09-08.md).

Point **14 clôturé et retiré** du fichier de travail : 281 points restent ouverts.

Validation : 230 suites / 885 tests réussis, puis 4 suites / 33 tests après
extraction des déclarations ; typage, lint, compilation/chargement AppModule,
verify:dist, quality:check et contrôle du diff réussis. Aucun seuil de dette
augmenté. La suppression des deux anciennes fonctions et les quatre nouveaux
exports sont versionnés explicitement dans le SDK 4.0 et son contrat public.

Les 38 jeux déclarent leur catalogue dans `content.ts` avec `defineGameContent`.
La composition et les règles consomment les mêmes données immuables validées.
Une release externe traverse le schéma du jeu et alimente désormais les tableaux
et index réellement utilisés pendant la partie. Les exports normalisés des
38 jeux peuvent être rechargés par ce protocole.

Les anciennes entrées SDK `loadGameContent` et `freezeGameContent` ont été
retirées. Les six modèles du générateur utilisent le SDK de production actuel,
des schémas de contenu et la forme typée de `defineGame` ; un test compile leurs
sources générées contre les vrais types du SDK.

La comparaison avec les catalogues capturés avant cette migration conserve
exactement les données et versions de 36 jeux. Panier Express ajoute les listes
d'articles et les stands ; Olympia ajoute les définitions complètes des cartes.
Leurs anciennes sections restent identiques. Les anciens exports de ces deux
jeux sont complétés par le parseur. Deux compatibilités de sauvegarde explicites
ne permettent que les transitions suivantes :

- Panier : `panier-express@content:531f119a` vers `panier-express@content:af1a6fc8`.
- Olympia : `olympia@content:25cb5135` vers `olympia@content:5429cc55`.

Les tests vérifient la conservation de l'état de partie et l'absence de mutation
du snapshot source. Un autre hash, une autre version de règles ou de schéma
reste refusé. Les releases externes n'héritent pas de ces compatibilités.
Panier limite aussi le nombre de joueurs aux six pions disponibles pour éviter
une sélection initiale sans issue.

Le point 15 reste ouvert : des lecteurs d'assets et normalisations locales
existent encore. La validation exhaustive des références (30), la séparation
de tout texte exécutable (25, 27) et la conservation de toutes les versions
nécessaires aux anciennes parties ne sont pas attestées par cette migration.

Journaux et comparaisons : `logs/corrections-content-*.log`,
`logs/embedded-content-before-unification.json`,
`logs/check-expanded-content.cjs`.
