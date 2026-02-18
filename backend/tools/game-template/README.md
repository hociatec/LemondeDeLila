# Game Template (backend)

Ce dossier sert de référence (non compilée/non scannée par le catalogue) pour créer un nouveau jeu avec la même architecture.

## Copier/coller : arborescence

Crée un nouveau dossier de jeu sous `backend/src/game/games/.../<mon-jeu>/` et reproduis :

```
<mon-jeu>/
  manifest.json
  rules.md
  <mon-jeu>.module.ts
  <mon-jeu>.service.ts
  actions/
  bots/
  definitions/
    game.definition.ts
    rules.definition.ts
    victory.definition.ts
  model/
    content/
  phases/
  presenter/
  rulebook/
  setup/
  tests/
```

## Exemples de fichiers

Voir :
- `backend/tools/game-template/examples/manifest.json`
- `backend/tools/game-template/examples/rules.md`
- `backend/tools/game-template/examples/model/content/content.example.json`
- `backend/tools/game-template/examples/definitions/game.definition.ts.txt`
- `backend/tools/game-template/examples/definitions/rules.definition.ts.txt`
- `backend/tools/game-template/examples/definitions/victory.definition.ts.txt`

## Checklist

Applique `backend/src/game/games/GAME_DOD.md`.

Checklist onboarding stricte:
- `backend/tools/game-template/ONBOARDING_CHECKLIST.md`
