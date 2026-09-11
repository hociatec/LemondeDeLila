# Politique de migration d'une partie en cours

## Point traité

Le point 718 demande une règle explicite lorsqu'un correctif modifie la
sémantique déterministe du moteur pendant qu'une partie est persistée.

## Politique appliquée

1. Une correction incompatible incrémente `GAME_ENGINE_ALGORITHM_VERSION`.
2. Le chargeur compare la version stockée à la version courante avant toute
   commande ou reprise ; une version différente est rejetée comme incompatible.
3. Une migration automatique n'est autorisée que pour les versions de contenu,
   via le graphe borné `ContentSnapshotMigration`. Elle ne peut pas contourner
   la version d'algorithme, du schéma ou des règles.
4. Pour conserver une partie en cours, une migration explicite doit donc être
   ajoutée et testée avant de changer la version acceptée ; sinon la partie est
   arrêtée proprement et signalée comme incompatible, sans exécution partielle.

## Vérification

`game-state-loader.spec.ts` vérifie la compatibilité d'algorithme, le chemin de
migration de contenu, les versions de schéma/règles et les chaînes bornées.
