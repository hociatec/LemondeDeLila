# Cycle de vie des releases

## Points traités

Les points 636 à 640 imposent une publication validée, atomique, compatible
avec les versions persistées et nettoyée sans supprimer une référence active.

## Garantie

`WxUpdateReleaseService` valide l'archive, l'installateur, les signatures et
les versions avant publication. `WxUpdatePublicationManager` écrit dans un
répertoire de staging puis le finalise par renommage atomique ; une release
partiellement écrite n'est jamais exposée. Le répertoire actif est conservé
pendant le garbage collection et seules les releases superseded non référencées
sont supprimées. Les snapshots de jeu refusent les versions de moteur, schéma,
contenu ou règles incompatibles avant restauration.

## Vérification

La suite `wx-update-release.service.spec.ts` couvre validation, publication
atomique, retry de nettoyage et conservation de la release active ;
`game-state-loader.spec.ts` couvre la compatibilité des états persistés.
