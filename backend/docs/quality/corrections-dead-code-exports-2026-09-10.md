# Passe code mort et exports

Les points 731 et 732 sont vérifiés par une compilation TypeScript stricte avec
`noUnusedLocals` et `noUnusedParameters`, ainsi que par ESLint et le contrat SDK
public. La compilation ne signale aucun symbole local ou paramètre inutilisé ;
le contrat SDK fixe les exports publics effectivement exposés et détecte toute
dérive accidentelle.

Commandes exécutées :

- `npx tsc --noEmit --incremental false --noUnusedLocals --noUnusedParameters`
- `npm run lint -- --no-fix`
- `npm run sdk:contract`
