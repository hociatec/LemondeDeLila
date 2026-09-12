# Cycle de vie des releases

## Points traités

Les points 636 à 640 imposent une publication validée, atomique, compatible
avec les versions persistées et nettoyée sans supprimer une référence active.

## Garantie

`WxUpdateReleaseService` valide l'archive, l'installateur, les signatures et
les versions avant publication. `WxUpdatePublicationManager` écrit dans un
répertoire de staging puis le finalise par renommage atomique ; une release
partiellement écrite n'est jamais exposée. Le répertoire actif est conservé
avec les anciennes releases : un client peut conserver un manifeste hors ligne
ou avoir un téléchargement en cours. La publication ne supprime donc aucun
répertoire publié ; seul le staging temporaire est nettoyé. Une suppression
opérationnelle exige de prouver que les anciennes URL ne sont plus utilisées.
Les snapshots de jeu refusent les versions de moteur, schéma,
contenu ou règles incompatibles avant restauration.

## Vérification

La suite `wx-update-release.service.spec.ts` couvre validation, publication
atomique, retry de nettoyage du staging et lecture des anciennes URL après
publication et retry ;
`game-state-loader.spec.ts` couvre la compatibilité des états persistés.

## Portée des verrous (point 86, 11 septembre 2026)

.publish.lock et .complete.lock protègent les opérations locales. La publication
et la finalisation WX utilisent des leases Redis ; sans lease acquis, elles
refusent de continuer. Le mode local de publication est limité aux environnements
hors production. La maintenance exige aussi Redis en production, même lorsque
son option distribuée vaut false. Les trois chemins libèrent les leases après
erreur ou succès et contrôlent leur détention pendant les opérations sensibles.
Un fichier de verrouillage ne constitue pas une garantie multi-instance. Le
stockage des releases doit être partagé ou distribué par l'exploitation pour
servir les mêmes URL depuis plusieurs instances.

Vérification : logs/json134-local-distributed-locks.json (3 suites, 26 tests),
couvrant contention locale, perte de lease, libération et refus sans Redis.
Audit des fichiers de verrouillage de production : ces trois chemins uniquement.
