# Verification of points 22 and 23

Panier Express bindings and setup are kept as thin authoring declarations. The bindings use SDK choices and the generic `when` automation primitive; setup uses the generic random, round, and inventory capabilities and delegates sequential pawn selection to the shared recipe. The audit rejects oversized files and direct imports of runtime internals.

Verification: `npm run panier:wiring:audit` and `node --test tools/panier-wiring-audit.spec.cjs`.
