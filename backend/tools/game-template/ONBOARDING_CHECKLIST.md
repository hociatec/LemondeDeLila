# Onboarding Nouveau Jeu (Checklist obligatoire)

Date: 2026-02-18

## 1) Scaffold obligatoire
- Lancer `npm run create:game`.
- Ne pas créer un jeu à la main en dehors de la structure standard.

## 2) Structure minimale attendue
- `manifest.json`
- `rules.md`
- `<jeu>.module.ts`
- `<jeu>.service.ts`
- `setup/`
- `actions/`
- `rulebook/`
- `presenter/`
- `phases/`
- `definitions/`
- `tests/`

## 3) Contrats backend obligatoires
- `validateAction` renvoie une action normalisée.
- `getAvailableActions` respecte les `pending` bloquants.
- `applyActions` est déterministe sur un état donné.
- Les aliases legacy passent par les helpers centraux.

## 4) Qualité obligatoire avant merge
- `npm run quality:check`
- `npm run test:transverse`
- `npm run build`

## 5) Revue
- Vérifier les logs joueur (pas de mojibake).
- Vérifier l'absence de nouveaux patterns locaux interdits.
- Vérifier que les tests du nouveau jeu couvrent setup + action + scénario.
