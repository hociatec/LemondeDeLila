# Quality & Test Strategy

## Tooling

- `LILA_ENABLE_CLANG_TIDY=ON` active `clang-tidy` si disponible.
- `LILA_ENABLE_CPPCHECK=ON` active `cppcheck` si disponible.
- `LILA_ENABLE_ASAN=ON` active AddressSanitizer sur les cibles applicatives et de tests quand le compilateur le supporte.
- `LILA_ENABLE_UBSAN=ON` et `LILA_ENABLE_TSAN=ON` sont exposés côté CMake. Sous MSVC, la configuration émet un avertissement explicite et il faut utiliser Clang/GCC pour les activer réellement.

## Parser fuzzing

- La cible `lemonde_de_lila_wx_parser_fuzz` injecte des entrées arbitraires dans `ChatProtocol`, `RealtimeProtocol` et la conversion UTF-8.
- Elle fournit un point d’entrée visible pour du fuzzing local ou CI corpus-driven.

## Automated regression areas

- parsing JSON/réseau malformé
- session expirée et nettoyage de session
- Unicode/UTF-8
- limites d’historique chat
- atomicité et corruption des fichiers locaux
- navigation accessibilité de base
- droits d’action temporels sur les messages chat

## Architecture guardrails

- Les textes UI ne doivent plus être ajoutés comme gros blocs `inline constexpr` dans un header unique. Ils passent désormais par un catalogue chargé depuis `resources/texts.fr.json` avec fallback intégré.
- Les nouvelles erreurs transverses doivent privilégier `AppError` / `AppException` plutôt que propager du `std::exception::what()` comme contrat implicite entre couches.
- Quand une règle de comportement UI devient métier-ish ou temporelle, elle doit sortir du frame/controller vers un helper nommé et testable, sur le modèle de `ChatMessageActions`.
- La factorisation UI doit rester opportuniste et locale. On partage les briques répétées quand elles sont déjà identiques (`NavigationController`, formatage de statuts de comptage), mais on évite d’introduire une classe supplémentaire pour une seule opération.
- Avant d’ajouter un nouveau `*Controller`, `*Store`, `*Router` ou `*Binder`, vérifier si la responsabilité peut rester lisible dans un composant existant sans augmenter le couplage.
- La fragmentation est désormais un risque explicite du repo: si une abstraction n’améliore ni la testabilité, ni la lisibilité, ni la réutilisation concrète, elle ne doit pas être introduite.

## Limits kept explicit

- Les scénarios UI natifs de fermeture pendant requête restent couverts ici via interruption de service/gateway, pas par automation de fenêtre bout-en-bout.
- Le catalogue de textes externe est en place en français, avec fallback embarqué; une vraie stratégie multi-langue reste à étendre si une seconde langue devient nécessaire.
