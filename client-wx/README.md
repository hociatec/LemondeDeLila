# client-wx

Prototype de client natif `wxWidgets` pour `Le Monde de Lila`.

## Mise à jour automatique

Les distributions de production sont démarrées par `lila_launcher.exe`, jamais
directement par `lemonde_de_lila_wx.exe`. Le lanceur vérifie le manifeste public
au démarrage puis toutes les deux minutes, télécharge les versions dans un
dossier de staging, vérifie les limites ZIP, l'espace disque, SHA-256, la
signature RSA du manifeste complet et les signatures Authenticode, bascule
atomiquement de version et revient à la version précédente si le signal de
santé du client n'arrive pas sous trente secondes. Les erreurs sont consignées
dans `state/update.log` avec rotation automatique.

Toute la responsabilité de distribution native est contenue dans
`src/modules/update` : contrat de manifeste, comparaison des versions, signaux
de cycle de vie, configuration et launcher. Le client métier ne remplace aucun
fichier de son installation.

La première migration s'effectue avec l'archive `bootstrap` produite par le
workflow `client-wx-auto-update.yml`. Exécuter `Installer.cmd`; les mises à
jour suivantes sont automatiques.

Secrets CI requis :

- `LILA_UPDATE_PUBLIC_KEY_DER_BASE64` : clé publique RSA au format DER/base64 ;
- `LILA_UPDATE_PRIVATE_KEY_PEM_BASE64` : clé privée PEM/base64 réservée à la CI ;
- `CODESIGN_PFX_BASE64` et `CODESIGN_PFX_PASSWORD` : signature Authenticode ;
- `LILA_API_BASE` et `LILA_UPLOAD_TOKEN` : publication backend.

`LILA_ALLOW_UNSIGNED_UPDATES=1` est réservé au développement local. Un lanceur
de production sans clé publique refuse toute nouvelle version.

Le manifeste public principal est
`GET /api/client/releases/latest?platform=windows&arch=x64&current=<version>`.
La route historique `/api/client-wx/manifest` reste disponible pendant la
migration. Les releases utilisent le schéma signé `lila-client-wx-manifest-v2`.

## Objectifs

- architecture modulaire claire
- UI native Windows
- base propre pour l'accessibilité et la fluidité
- backend branche via services injectes, pas via logique UI

## Structure

- `src/app` : point d'entrée `wxWidgets` et navigation applicative
- `src/bootstrap` : assemblage des services et des modules
- `src/shared` : accessibilité, configuration, réseau et theming transverse
- `src/modules/home` : accueil natif `Accueil / Connexion / Inscription`
- `src/modules/user` : module utilisateur
- `src/modules/session` : session authentifiée et écrans post-login
- `src/modules/update` : mise à jour native, launcher et protocole signé
  - `domain` : contrats metier
  - `application` : cas d'usage
  - `infrastructure` : implementation technique
  - `presentation` : vues wxWidgets

## Build

Exemple avec `CMake` :

```powershell
& "C:\Program Files\CMake\bin\cmake.exe" --preset windows-vcpkg-debug
& "C:\Program Files\CMake\bin\cmake.exe" --build --preset windows-vcpkg-debug
```

## Etat actuel

- module `user` initialise
- module `session` initialise
- écran d'accueil `Accueil / Connexion / Inscription` implémenté
- authentification branchee sur `auth.login` via `/ws/api`
- inscription branchee sur `auth.register` via `/ws/api`
- navigation centralisée entre connexion et session
- persistance locale de la session dans le profil utilisateur Windows
- la navigation d'entrée ne dépend plus de l'ancienne frame de connexion
- transport WebSocket long-vivant cote client
- contrats JSON typés et valides dès la couche temps réel
- reste a ajouter : tickets WS authentifies et modules post-login

## Environnement installe

- `CMake 3.31.6` : `C:\Program Files\CMake\bin\cmake.exe`
- `Visual Studio Build Tools` : `C:\BuildTools`
- `vcpkg` : `C:\vcpkg`
- `wxWidgets` via `vcpkg` : triplet `x64-windows`
- `nlohmann-json` via `vcpkg`
