# client-wx

Prototype de client natif `wxWidgets` pour `Le Monde de Lila`.

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
