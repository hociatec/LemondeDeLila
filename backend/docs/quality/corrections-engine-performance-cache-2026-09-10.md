# Correction du point 641 — cache du moteur

Le chargement des releases externes ne conserve plus de manifeste dans un
état de module partagé. Chaque appel relit et valide `manifest.json` dans le
répertoire configuré ; une release modifiée ou supprimée est donc observée
immédiatement, sans purge globale implicite.

La performance reste maîtrisée par les caches explicitement possédés par
leurs services (registre/catalogue) et par le cache borné du compilateur,
indexé par définition. Aucun cache global caché n'est utilisé par le chemin
générique de chargement de contenu.

Preuve : `src/game/engine/runtime/content/external-content-release.spec.ts`
valide les checksums, les manifests invalides et la relecture après mutation
sans fonction de purge ; `npm run test -- --runInBand
src/game/engine/runtime/content/external-content-release.spec.ts` passe.
