# Charte De Logs (Jeux)

Date: 2026-02-18

## Objectif
- Garantir des messages de log lisibles, homogènes et stables entre les jeux.
- Réduire les divergences de style pour limiter les régressions UX.

## Format Canonique
- Horodatage: porté par `GameLogEntry.timestamp` (ISO 8601).
- Message: texte court orienté action/résultat.
- Structure recommandée: `Acteur + action + contexte + résultat`.

Exemples:
- `C'est au tour de Lila.`
- `Lila place X en case 5 (Case 5 - Forêt).`
- `Lila lance un dé (4/6).`
- `Victoire de Lila.`

## Règles De Rédaction
- Français clair, cohérent, sans abréviations ambiguës.
- Une seule phrase par entrée de log.
- Ponctuation finale recommandée (`.`, `!`, `?`) selon le sens.
- Pas d'espaces parasites, pas de sauts de ligne.
- Apostrophes et accents normalisés (pas de séquences mojibake).

## Vocabulaire Standard
- Tour: `C'est au tour de {joueur}.`
- Dé: `{joueur} lance un dé ({valeur}/{faces}).`
- Placement: `{joueur} place {pion} en case {n} ({case}).`
- Victoire: `Victoire de {joueur}.`

## Application Technique
- Les messages passent par `GameCoreService.appendLog`.
- Normalisation automatique:
  - trim,
  - suppression des retours ligne/tabulations,
  - réduction des espaces multiples,
  - correction mojibake best-effort.
- Pour les messages fréquents, utiliser les helpers centralisés dans
  `backend/src/game/core/helpers/game-log-text.helper.ts`.
