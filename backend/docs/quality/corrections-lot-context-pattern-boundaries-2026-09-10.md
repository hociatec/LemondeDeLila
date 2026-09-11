# Verification of points 30, 32 and 35

The author-facing game context is now assembled from named capability facades:
players, lifecycle, values, components, interactions, and effects. Runtime-only
orchestration remains excluded from that public contract.

Reusable gameplay patterns consume the single `pattern-capabilities.ts`
authoring bridge. The runtime-separation audit rejects direct pattern imports of
kits, lifecycle, cards, effects, recipes, or configuration internals, as well
as compiler and validator dependencies.

Verification: `npm run runtime:separation:audit`, its Node test, and the build
typecheck.
