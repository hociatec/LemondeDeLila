# Cohérence des manifestes et définitions

Points **626, 627 et 628 clôturés et retirés** : 277 points restent ouverts.

Validation : 230 suites / 887 tests réussis ; typage, lint, compilation et
chargement AppModule, quality:check, verify:dist et contrôle du diff réussis.
Les 20 tests de l’audit/générateur passent. Les données JSON des 38 catalogues
sont préservées et les six compatibilités précédentes restent inchangées.
Aucune migration SQL ni aucun déploiement.

Les 38 jeux importent leur manifeste comme source canonique de code, nom,
description et limites de joueurs. Les identifiants de contenu sont dérivés
du même fichier. Le catalogue, la définition compilée et le runtime sont
comparés avant leur enregistrement et après invalidation du cache du catalogue.
La vérification couvre aussi les anciens alias de moteur et les divergences
de limites ; Panier ne peut plus annoncer dix joueurs pour six pions.

Le générateur produit les deux fichiers de package qu'il omettait : manifeste
et règles Markdown. Ses modèles gardent les quatre fichiers TypeScript
déclaratifs. Un test compile tous les modèles contre le SDK de production ;
un autre vérifie leur découverte, le refus d'un manifeste incohérent ou de
règles absentes, et la conservation du registre précédent lors de ces refus.

L'audit possède une règle AST empêchant le retour des copies de métadonnées.
Le contrôle ne se limite pas à comparer des valeurs qui pourraient diverger
plus tard. Aucun seuil de dette ou baseline n'est augmenté.

Contrat : [Métadonnées canoniques](../architecture/game-manifest-metadata.md).
Journaux : `logs/corrections-manifests-*.log`.
