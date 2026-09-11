# Sac à Malices : références de contenu

Travail de contribution aux points 25, 27, 30, 429 et 501. Les points 25, 27, 429 et 501 ont ensuite été clôturés après la revue
transversale du 9 septembre ; le point 30 reste ouvert. Voir
[le rapport transversal](corrections-text-content-2026-09-09.md).

Les sept variantes utilisent un catalogue JSON unique validé par `defineGameContent`.
Les cases, groupes, équipements et cartes possèdent des identifiants explicites.
L'achat, les loyers, les hypothèques, la possession des groupes et les déplacements
ne recherchent plus une correspondance dans les titres ou les couleurs affichées.
La validation refuse les références inconnues, les doublons et les appartenances
incohérentes avant la construction du runtime.

Corrections concrètes : les groupes bleus sont reconnus malgré l'ancienne variation
« Bleu/bleue » ; quatre cases d'équipement auparavant neutres sont correctement
typées ; 21 destinations de cartes sont structurées ; la prison de Gaia référence
sa case explicite. Les textes, prix, ordre des cases et autres effets sont conservés.
Les 42 anciennes sources JSON et deux helpers inutilisés ont une sauvegarde exacte
dans `logs/sac-retired-sources.json` avant retrait.

Le format de contenu passe à 2 et les règles à 2. Les anciennes sauvegardes sont
refusées par le contrôle de version ; aucune migration automatique n'est déclarée.
Le maintien ou la migration des parties utilisant les anciennes règles reste à
traiter dans les points de compatibilité 130, 632, 633 et 638. Aucun déploiement
ni changement de données de production n'a été effectué.

Vérifications : tests ciblés des sept variantes, changements de libellés, références
invalides, rejouabilité et rechargement des 38 catalogues ; typage, lint, compilation,
chargement AppModule, quality:check et verify:dist réussis. Le script
`logs/check-sac-stable-catalogue.cjs` vérifie que les 37 autres catalogues sont
strictement identiques et que seules les modifications Sac décrites sont présentes.
Journaux : `logs/corrections-sac-ids-*.log`.
