# Preuve du point 524

L’audit des méthodes de production ne trouve pas de grande fonction réunissant
transport, persistance, validation et règles métier. Dans `SoundsService`, les
workflows d’upload, maintenance et ambiances sont délégués respectivement à
`SoundsUploadManager`, `SoundsMaintenanceManager` et
`SoundsTableAmbiencesManager`. Les méthodes restantes sont des adaptateurs
courts ou le workflow cohérent de suppression d’un son (manifest, fichiers,
notification). Le typecheck et les audits d’architecture passent.
