# Verification of point 155

The post-refactor dead-code pass is automated with strict TypeScript unused-symbol checks. Public SDK exports remain covered by `sdk:contract`; no unused local or parameter is accepted in the production build.

Verification: `npm run dead-code:audit` and `npm run sdk:contract`.
