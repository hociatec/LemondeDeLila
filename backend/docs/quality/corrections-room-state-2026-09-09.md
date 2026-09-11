# État des tables — 9 septembre 2026

Point 233 clôturé après validation : 258 suites / 1124 tests hors campagne longue,
typage, lint, build/AppModule, quality:check, verify:dist et contrôle du diff.
Le fichier de travail conserve 250 points ouverts.

`RoomGatewayStateService` coordonne la lecture, les transitions et les annonces
d'état. L'envoi des trames et le nettoyage des ensembles de sockets appartiennent
désormais à `RoomPayloadBroadcaster`. La sérialisation reste mutualisée par
liste de droits pour chaque diffusion ; ce cache est local à l'appel.

`projectRoomRoster` prépare une copie du payload pour les joueurs connectés,
spectateurs visibles et, si demandé, le spectateur masqué qui consulte sa propre
vue. Il ne modifie pas le payload source. Le service de session utilise aussi
cette projection pour la réponse de départ, et copie le payload avant d'adapter
la réponse d'information. Les callbacks de mutation de roster ont été retirés
du contexte du gateway.

Quatre tests vérifient la séparation joueurs/spectateurs, la source inchangée,
la vue personnelle masquée et les itérateurs utilisables une seule fois. Un
test du broadcaster vérifie les permissions distinctes, la trame réutilisée,
la socket défaillante retirée et le payload non modifié. Les tests de gateway
existants passent : 11 suites / 48 tests, puis le test ciblé du broadcaster.

Le provider du broadcaster est câblé explicitement dans le module Room.
Journaux de validation : `logs/corrections-room-state-{all-tests,typecheck-final,lint,quality,build}.log`.
