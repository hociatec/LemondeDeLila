# Preuves de livraison locales du 13 septembre 2026

## Résultats obtenus

| Contrôle                                  | Résultat                                                              |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `npm run quality:check`                   | réussi, backlog compris (`0` point ouvert)                            |
| `npm run lint`                            | réussi                                                                |
| `npm run typecheck:prod`                  | réussi                                                                |
| `npm audit --omit=dev --audit-level=high` | `0` vulnérabilité                                                     |
| `npm run build`                           | réussi, 1 760 fichiers compilés et `AppModule` chargé                 |
| `npm run verify:dist`                     | réussi, 39 manifestes et 83 JSON de contenu                           |
| contrats déclaratifs finaux               | 5 suites et 76 tests réussis                                          |
| audit des packs d'effets                  | 38 packs génériques, 0 code de jeu, 0 alias interdit, 0 import croisé |

## Artefact local

L'archive `backend-deployment.tar.gz` a été produite avec uniquement les
dépendances de production. Son contrôle donne :

- SHA-256 : `28613a298a63471bb95c1d7827bef11d8f88cfa3bedecfde43051d6e4a5354eb` ;
- taille : `158179539` octets ;
- `dist/main.js` et `package-lock.json` présents ;
- aucune dépendance Jest ;
- SHA source embarqué : `6718d13c4667a2e4ebe9d18052817115a131fe32` ;
- SHA-256 du lockfile embarqué : `481d344679f3e529254ef22949c8255875d4579666c4f944a545d832c033ad53`.

Le générateur d'artefact accepte désormais GNU tar en CI et BSD tar sous
Windows. Les options reproductibles strictes de GNU tar restent utilisées pour
l'artefact de release Linux.

## Preuves externes encore requises

`test:integration:real` n'a pas pu être exécuté dans cette session : Docker
Desktop est installé, mais son backend ne démarre pas, et aucun `redis-server`
natif n'est disponible. Le service Docker, initialement arrêté, a été remis dans
son état arrêté après le diagnostic.

L'archive locale a été créée sous Node `22.13.1`. Elle valide le processus, mais
ne remplace pas l'artefact officiel Node 24 produit par la CI. Une certification
de production complète exige encore le résultat du job Node 24 avec
MySQL/Redis/BullMQ, l'identité de l'artefact effectivement déployé et le rapport
du dernier exercice de restauration.
