# Verification of point 24

The Panier Express effect registry exposes only namespaced, game-specific effects (`panier.move-and-resolve`, `panier.draw-course`, `panier.quiz`, `panier.nearest-stand`, and `panier.strategic-swap`). The audit prevents a bare generic `move`, `draw`, `give`, `take`, `score`, `choose`, or `exchange` effect from being added to this registry.

Verification: `npm run panier:effects:audit` and `node --test tools/panier-effects-audit.spec.cjs`.

The extracted event and exchange JSON sources are also parsed through explicit discriminated unions, and their cardinalities are checked against the corresponding card identifier lists before the game content is created.
