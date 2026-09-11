# Verification of point 20

`panier-express/content.ts` now contains only source loading, canonical content projection, validation, and schema integration. The effect transformation and runtime instruction generation live in `content-effects.ts`; event and exchange data live in JSON sources. The content module is reduced to 266 lines and no longer embeds the effect tables or effect instruction orchestration.

Verification: `content.ts`, `content-effects.ts`, extracted JSON sources, TypeScript compilation, and the complete Panier Express test suite.
