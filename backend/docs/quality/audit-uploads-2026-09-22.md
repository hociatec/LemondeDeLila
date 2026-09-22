# Concurrence et erreurs disque des uploads WX — 22 septembre 2026

Deux défauts ont été reproduits avant correction dans
`logs/audit-upload-before.log` :

1. Le nom définitif d'un chunk existait dès le début de sa copie. Un appel
   concurrent pouvait donc le considérer comme reçu avant que son contenu soit
   complet, ou la finalisation pouvait lire une copie en cours.
2. L'assemblage ignorait `bytesWritten`. Une écriture partielle faisait perdre
   les octets non écrits ; le contrôle final rejetait alors l'archive tronquée.

## Corrections

La copie d'un chunk se fait maintenant sous un nom temporaire unique, avec
vérification de taille et synchronisation du fichier. Un lien physique publie
ensuite son contenu complet sans écraser un chunk concurrent déjà accepté.
Seule l'existence du nom définitif constitue un doublon accepté ; une collision
sur le staging reste une erreur et son fichier n'est pas supprimé.

L'assemblage poursuit chaque écriture jusqu'à épuisement du buffer. Une réponse
de zéro octet ou une longueur incohérente est rejetée pour éviter une boucle
infinie. Les vérifications de taille totale et de signature restent en place.

## Vérifications

- **9 suites, 44 tests réussis**, couvrant les mises à jour, le stockage et les
  quotas HTTP d'upload (`audit-upload-tests-final.log`, 37,467 secondes).
- **7 nouveaux tests** : deux producteurs concurrents avec contenus différents,
  panne pendant copie, synchronisation et création du lien, nouvelle tentative
  après chaque panne, écriture de zéro octet, collision de staging et assemblage
  de deux chunks avec des écritures limitées à deux octets chacune.
- Typage TypeScript complet : réussi.
- Lint : réussi.
- Compilation : **1 842 fichiers**, puis chargement du module de l'application
  réussi.
- Contrôle qualité global : réussi, dont architecture, persistance, contrats
  moteur et SDK (`audit-upload-quality.log`).

Les résultats et empreintes sont conservés dans
[le rapport JSON](audit-uploads-2026-09-22.json).

Les tests utilisent des fichiers temporaires réels et injectent uniquement les
pannes ou l'ordonnancement des écritures. Les assertions vérifient les octets
publiés, la conservation du premier chunk complet et les fichiers restants.

## Déploiement et portée

Le volume WX doit prendre en charge les liens physiques dans un même répertoire.
Ce support est exercé par les tests sur le système de fichiers local. Il faut
également le vérifier sur le volume partagé de l'environnement cible.
Un volume incompatible provoque une erreur d'upload, sans publier un chunk partiel.
Aucun changement de schéma SQL ni déploiement n'a été effectué.

Ce passage cible les uploads et leur stockage ; la suite générale des jeux n'a
pas été relancée. Il ne certifie pas une charge de production ni une résistance
universelle aux pannes matérielles.
