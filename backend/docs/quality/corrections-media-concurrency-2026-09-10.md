# Correction média — concurrence des outils audio

Les appels ffmpeg/ffprobe passent maintenant par un quota global de deux
processus simultanés. La file d’attente protège la machine contre les rafales
multi-requêtes ; le transcodage conserve en plus `-threads 1` et
`-filter_threads 1`, tandis que les limites de durée et de sortie restent
actives.

Preuves :

- `src/modules/sounds/infrastructure/storage/sounds-audio-process.ts`
- `src/modules/sounds/infrastructure/storage/sounds-audio-process.concurrency.spec.ts`
- `src/modules/sounds/infrastructure/storage/sounds-audio-cleanup.spec.ts`
- `npm run typecheck`
