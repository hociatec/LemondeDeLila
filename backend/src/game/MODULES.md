# Modules transversaux du gameplay

Chaque capacité générique du moteur possède son propre dossier. La structure cible est la même pour tous les modules :

- `domain` : règles et modèles indépendants des frameworks ;
- `application` : cas d'usage et services ;
- `infrastructure` : composition Nest, persistance et adaptateurs ;
- `presentation` : construction des contrats exposés aux clients.

Un sous-dossier n'est créé que lorsqu'il contient une responsabilité réelle. Les jeux de `game/games` consomment ces modules, mais conservent leurs règles spécifiques.

Les modules sont placés directement sous `game`. `game/core` contient uniquement le noyau transversal encore partagé par plusieurs capacités ; il respecte lui aussi les couches `application`, `domain` et `infrastructure`. Les fichiers de composition Nest globaux restent directement à la racine de `game`.

Modules déjà migrés :

- `action-resolver` ;
- `actionlog` ;
- `board-effects-policies` ;
- `cards` ;
- `deck-policies` ;
- `dice` ;
- `effects` ;
- `exchange` ;
- `grid` ;
- `history` ;
- `movement` ;
- `pawn-selection` ;
- `prompts` ;
- `quiz` ;
- `shortcuts` ;
- `state` ;
- `victory`.

Ils servent de structure de référence pour les prochains déplacements.
