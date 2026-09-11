# Corrections des points 727–728 — règles structurelles strictes

Le compteur de dette structurelle est à zéro et
`tools/structural-quality-baseline.json` ne contient aucune exception. Il n’y
a donc pas d’allowlist temporaire à conserver ou à supprimer. Le contrôle
`structure:check` applique directement les limites strictes, tandis que
`structural-quality-check.spec.cjs` vérifie le refus des nouvelles dettes et
des aggravations.
