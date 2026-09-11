# Corrections des points 695–696 — état des paramètres bot

Le cache des paramètres bot est désormais privé à chaque instance de
`BotSettingsService`. Les données persistées ou les valeurs de repli d’une
instance ne peuvent plus être réutilisées par une autre instance du service.
Les constantes de configuration restent statiques et immuables ; seul l’état
mutable a été déplacé dans l’instance.

La suite `bot-settings.service.spec.ts` vérifie le seeding, le clamp/persist et
l’isolation de deux instances utilisant deux repositories différents.

Validation : `npm run test -- --runInBand
src/game/core/application/services/bot-settings.service.spec.ts` et le
typecheck passent.
