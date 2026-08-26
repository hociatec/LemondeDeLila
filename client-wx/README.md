# Client WX — Le Monde de Lila

Client de bureau Windows en C++20 et wxWidgets. Il couvre l’authentification,
les salons, le jeu, le chat, la messagerie, le social, le catalogue, le livre
des contes, le classement, le coffre, les options, l’audio et les mises à jour
automatiques.

## Architecture

- `src/app` : cycle de vie et navigation globale ;
- `src/bootstrap` : composition et injection des services ;
- `src/modules/<module>` : couches `domain`, `application`, `infrastructure`
  et `presentation` propres à chaque fonctionnalité ;
- `src/shared` : briques transverses sans logique métier de module ;
- `src/generated/protocol` : contrats C++ générés depuis les contrats backend ;
- `cmake` : règles communes de compilation et déclaration des tests ;
- `tests` : tests de contrat, robustesse, concurrence et présentation.

Les catalogues d’erreurs et les décodeurs JSON sont propriétaires de leur
module. Les contrôles et layouts réutilisables restent dans `src/shared`.

## Prérequis Windows

- CMake 3.28 ou plus récent ;
- Ninja et un environnement MSVC x64 ;
- Git ;
- vcpkg, exposé par la variable d’environnement `VCPKG_ROOT` ;
- `third_party/bass/bin/x64/bass.dll` pour le backend audio BASS.

Le manifeste `vcpkg.json` épingle la baseline et déclare wxWidgets ainsi que
nlohmann-json. Il n’est pas nécessaire d’installer ces bibliothèques à la
main.

## Compiler et tester

Depuis `client-wx` dans un shell MSVC :

```powershell
cmake --preset windows-vcpkg-debug
cmake --build --preset windows-vcpkg-debug
ctest --preset windows-vcpkg-debug
```

Pour une version optimisée, remplacer `debug` par `release`. Tous les tests
CTest sont construits par défaut. Les tests portables, également exécutés par
la CI Linux, peuvent être lancés sans wxWidgets :

```bash
bash tests/run_portable_checks.sh
```

Les options CMake `LILA_ENABLE_ASAN`, `LILA_ENABLE_UBSAN`,
`LILA_ENABLE_TSAN`, `LILA_ENABLE_CLANG_TIDY` et `LILA_ENABLE_CPPCHECK`
permettent d’activer les contrôles supplémentaires compatibles avec le
compilateur. ASan et TSan sont volontairement exclusifs.

Le build limite chaque fichier d’implémentation ou segment de test à 250
lignes afin d’empêcher le retour des unités monolithiques.

## Contrats protocole

Quand le dépôt backend voisin est présent, le build régénère strictement les
en-têtes de `src/generated/protocol` à partir de
`../backend/contracts/client-wx-fields.json` et des événements WebSocket. Sous
Windows, cette étape utilise PowerShell ; ailleurs, Node.js. Sans backend
local, les contrats versionnés dans le client sont utilisés.

## Mise à jour automatique

En production, l’application est démarrée par `lila_launcher.exe`. Le lanceur
vérifie le manifeste public, télécharge dans un dossier de staging, contrôle
les limites ZIP, l’espace disque, SHA-256, la signature RSA du manifeste et
les signatures Authenticode, puis effectue une bascule atomique avec retour à
la version précédente en l’absence de signal de santé.

La construction, la signature et la publication sont réalisées directement
sur le serveur avec `sudo updatecmd wx --force`, ou avec
`sudo updatecmd all --force` pour déployer aussi le backend. Les secrets de
signature et de publication restent dans la configuration locale du serveur.

`LILA_ALLOW_UNSIGNED_UPDATES=1` est réservé au développement local. Un
lanceur de production sans clé publique refuse toute nouvelle version.

Le manifeste principal est servi par
`GET /api/client/releases/latest?platform=windows&arch=x64&current=<version>`
avec le schéma signé `lila-client-wx-manifest-v2`.
