# Analyse du client et du backend du Monde de Lila

**État initial conservé pour référence.** Les corrections et leurs validations ultérieures sont décrites dans le [bilan des corrections](corrections.md). Les sondes ci-dessous reproduisent les anciens défauts et ne doivent pas être interprétées comme des tests attendus au vert sur le code corrigé.

Audit du 7 octobre 2026 sur `main`, commit `25eeff841`. Douze problèmes sont retenus, concernant les accès administrateur, les sessions, les sons, les sauvegardes de parties, la messagerie et les publications. Les plus urgents peuvent laisser un accès administrateur actif ou faire perdre des données. Les corrections audio déjà intégrées couvrent le remplacement séquentiel normal ; elles ne protègent pas encore les remplacements simultanés.

Les constats ci-dessous distinguent les reproductions locales des conclusions tirées du chemin complet dans le code. Les reproductions utilisent des répertoires temporaires, une clé JWT créée pour le test et des dépendances simulées. Elles ne constituent pas des incidents constatés en production. Aucun correctif applicatif n'a été appliqué dans cet audit.

| Référence | Priorité | Problème | Vérification |
| --- | --- | --- | --- |
| 1 | Haute | Les droits administrateur restent utilisables après leur retrait | Gardes HTTP exécutés et parcours de révocation inspecté |
| 2 | Haute | Réinitialiser le mot de passe ne révoque pas les sessions existantes | Lecture des parcours de changement et de renouvellement |
| 3 | Haute | Des opérations audio simultanées perdent des références ou suppriment le nouveau son | Deux reproductions locales |
| 4 | Haute | Restaurer une partie peut modifier des valeurs de jeu ordinaires | Reproduction locale |
| 5 | Haute | Supprimer définitivement un message le supprime aussi chez l'autre personne | Reproduction locale et dépôt SQL inspecté |
| 6 | Haute | Une erreur de lecture audio peut entraîner l'écrasement du catalogue | Reproduction locale |
| 7 | Moyenne | Un téléchargement audio retarde les commandes et la fermeture du client | Chaîne client inspectée et test existant du thread audio exécuté |
| 8 | Moyenne | Une ancienne URL audio peut rester utilisée après des erreurs 404 | Lecture croisée du client et du serveur |
| 9 | Moyenne | Une boucle audio en cours conserve l'ancien son après une mise à jour | Lecture du traitement des notifications et du cache |
| 10 | Moyenne | Une création d'ambiance échouée peut laisser une ambiance sans son | Lecture du parcours client et des deux opérations serveur |
| 11 | Moyenne | Un arrêt brutal peut bloquer les publications suivantes | Reproduction avec un verrou abandonné |
| 12 | Moyenne | Une panne pendant le renouvellement de session peut imposer une reconnexion | Reproduction avec panne de base de données simulée |

**1. Les droits administrateur ne sont pas réévalués sur les requêtes HTTP**

Un administrateur se connecte, puis un autre administrateur lui retire son rôle, le bannit ou supprime son compte. Son ancien jeton correctement signé contient toujours `ROLE_ADMIN`. Les gardes HTTP vérifient sa validité cryptographique et son rôle embarqué, sans relire l'état du compte. Les routes d'administration des sons et des utilisateurs utilisent ces gardes.

L'ancien jeton peut donc continuer à autoriser ces opérations jusqu'à son expiration. La durée par défaut dans le code est de 12 heures ; la configuration réelle peut la modifier. Il ne s'agit pas d'une possibilité de fabriquer un jeton : le scénario nécessite un jeton administrateur auparavant valide.

Preuve : la sonde exécute les deux gardes avec un jeton signé localement. L'inspection des contrôleurs et du seul garde global, chargé de limiter les requêtes, confirme l'absence de vérification complémentaire de l'état du compte sur ces routes. Les commandes de retrait de rôle, de bannissement et de suppression ne révoquent pas ces jetons.

Sources : [garde JWT](../backend/src/platform/auth/infrastructure/presentation/http/http-jwt.guard.ts), [garde administrateur](../backend/src/platform/auth/infrastructure/presentation/http/admin-role.guard.ts), [commandes utilisateurs](../backend/src/modules/admin/application/use-cases/admin-users/admin-users-command.service.ts), [contrôleur sons](../backend/src/modules/sounds/infrastructure/presentation/http/controllers/admin-sounds.controller.ts), [durée des jetons](../backend/src/modules/user/infrastructure/security/jwt-user-token.service.ts).

Correction recommandée : vérifier l'état actuel du compte pour les opérations sensibles, avec un mécanisme de révocation ou de version de session. Tester explicitement un jeton émis avant une rétrogradation, un bannissement et une suppression.

**2. La réinitialisation d'un mot de passe laisse les anciennes sessions renouvelables**

`resetPassword` remplace le mot de passe stocké, mais ne révoque pas les jetons de renouvellement. Le changement de mot de passe par la commande de modification du compte présente le même problème. Le renouvellement vérifie l'existence et le bannissement du compte, mais ne compare aucune version de mot de passe ou de session.

Une personne déjà connectée, ou détentrice d'un jeton de renouvellement dérobé, peut ainsi renouveler sa session après la réinitialisation du mot de passe. Attendre l'expiration du seul jeton d'accès ne résout pas ce cas. Le mécanisme `revokeAllForUser` existe, mais son utilisation retrouvée dans ces parcours est limitée à la déconnexion globale.

Sources : [réinitialisation du mot de passe](../backend/src/modules/admin/application/use-cases/admin-users/admin-users-command.service.ts), [renouvellement](../backend/src/modules/user/application/use-cases/refresh-user-session.service.ts), [révocation globale](../backend/src/modules/user/application/use-cases/logout-user-session.service.ts).

Correction recommandée : révoquer les renouvellements et invalider les accès concernés lors des changements de mot de passe. Ce point complète le précédent : il concerne la possibilité de recréer des accès, pas seulement la durée de vie d'un accès déjà émis.

**3. Les écritures audio simultanées ne sont pas protégées**

Deux scénarios sont reproduits avec le véritable gestionnaire d'envoi et le véritable nettoyage des fichiers. Seul le traitement audio est simulé ; les lectures et écritures sont coordonnées pour imposer un entrelacement possible.

- Deux sons différents sont envoyés. Les deux opérations lisent le même ancien catalogue, puis chacune écrit sa version. Elles réussissent toutes les deux, mais le catalogue final ne contient qu'une des deux nouvelles références.
- Deux fichiers différents remplacent la même ambiance. Chaque opération conserve son propre fichier et considère celui de l'autre comme ancien. Les deux opérations réussissent, mais le répertoire final ne contient plus aucun WAV. Le catalogue référence donc un fichier absent.

L'écriture atomique du fichier JSON évite un fichier partiellement écrit ; elle ne protège pas l'ensemble lecture, modification, écriture et nettoyage. Le même type de coordination manque autour de l'activation, de la suppression et de la gestion des définitions d'ambiances.

Sources : [persistance et nettoyage après envoi](../backend/src/modules/sounds/infrastructure/storage/sounds-upload.manager.ts), [suppression des anciens fichiers](../backend/src/modules/sounds/infrastructure/storage/sounds-storage-maintenance.ts), [autres mutations audio](../backend/src/modules/sounds/infrastructure/storage/sounds.service.ts).

Correction recommandée : sérialiser toutes les mutations du catalogue et coordonner le nettoyage avec l'état effectivement validé. La protection doit fonctionner entre plusieurs processus si le backend est répliqué. Ajouter les deux scénarios concurrents aux tests de non-régression, en inversant les assertions des sondes d'audit.

**4. La restauration des parties remplace tous les nombres correspondant à un ancien bot**

Le remappage parcourt tout l'état sauvegardé et remplace chaque valeur numérique trouvée dans la table de correspondance des bots. Il ne distingue pas un identifiant de joueur d'une position, d'un score ou d'une autre valeur métier.

Reproduction : un bot passe de l'identifiant `-1` à `-99`. Une position de plateau valant `-1` devient elle aussi `-99`. Le dépôt contient des jeux utilisant une position initiale `-1`. Le problème se déclenche lorsque la valeur métier coïncide avec l'un des anciens identifiants négatifs ; toutes les sauvegardes ne sont donc pas affectées. Selon les validations du moteur, la restauration peut être refusée ou produire un état incorrect.

Sources : [remappage des valeurs, ligne 28](../backend/src/modules/vault/application/services/vault-game-state-remapper.ts), [attribution des nouveaux identifiants](../backend/src/modules/vault/application/services/vault-snapshot-restore.service.ts), [position initiale des Foulées fantastiques](../backend/src/game/games/vents-sacres/foulees-fantastiques/game.json).

Correction recommandée : remapper uniquement les références de joueurs définies par les contrats de l'état. Préserver les valeurs de scores, positions, compteurs et paramètres. Le test doit vérifier simultanément le changement d'identifiant et la stabilité des valeurs métier.

**5. La suppression définitive d'un message affecte aussi son correspondant**

L'expéditeur place son message dans sa corbeille, puis le supprime définitivement. Le serveur vérifie uniquement que le message est dans la corbeille de cet expéditeur, puis supprime la ligne entière. Le destinataire peut encore avoir ce message dans sa boîte de réception, sans l'avoir lu ni supprimé.

La sonde reproduit l'appel de suppression alors que `deletedByRecipientAt` est nul. Le dépôt TypeORM confirme une suppression globale par `messageId`. La notification de compteurs vise seulement la personne ayant demandé la suppression : l'autre client peut conserver momentanément un affichage périmé.

Sources : [purge, ligne 188](../backend/src/modules/messaging/application/services/private-messaging.service.ts), [suppression SQL](../backend/src/modules/messaging/infrastructure/persistence/typeorm/repositories/private-message-typeorm.repository.ts), [notification après purge](../backend/src/modules/messaging/infrastructure/presentation/ws/messaging-ws.handler.ts).

Correction recommandée : mémoriser une suppression définitive indépendante pour chacun et supprimer physiquement quand les deux côtés l'autorisent. Si une suppression pour tout le monde est réellement souhaitée, elle doit être une action distincte avec une règle et un libellé explicites.

**6. Une erreur de lecture est traitée comme un catalogue audio vide**

La lecture du manifeste sonore et celle des définitions d'ambiances interceptent aussi les erreurs autres que l'absence initiale du fichier : accès refusé, JSON invalide, fichier trop volumineux, etc. Elles renvoient une configuration vide. Une opération de modification peut ensuite écrire cette configuration et perdre les données précédentes.

Reproduction : une configuration valide contient une ambiance existante. Une seule lecture échoue avec `EACCES`, puis la création d'une nouvelle ambiance continue. Le fichier final ne contient que la nouvelle ambiance, qui réutilise même `TableAmbience1`. Les fichiers audio précédents peuvent rester sur disque, mais leur catalogue ou leurs libellés sont perdus.

Sources : [lecture des définitions, ligne 157](../backend/src/modules/sounds/infrastructure/storage/sounds-table-ambiences.manager.ts), [lecture du manifeste, ligne 154](../backend/src/modules/sounds/infrastructure/storage/sounds.service.ts).

Correction recommandée : accepter une configuration vide uniquement pour une absence initiale attendue. Sur les autres erreurs, refuser la mutation, conserver le fichier et signaler précisément l'échec. Une copie de récupération du dernier catalogue valide apporterait une protection supplémentaire.

**7. Un téléchargement audio peut retarder l'arrêt et la fermeture du client**

Le client télécharge le fichier audio complet sur l'unique thread qui exécute les commandes sonores. Les commandes d'arrêt et de changement d'extrait attendent derrière cette opération. La fermeture graphique appelle `ShutdownGracefully`, qui attend la fin du thread avec `join`.

Avec un fichier volumineux et une connexion lente, le son demandé à l'arrêt peut encore démarrer avant que la commande d'arrêt soit traitée. La fenêtre peut aussi cesser de répondre pendant la fermeture. Les délais WinHTTP par opération ne fournissent pas ici une annulation pilotée par la fermeture ni une échéance globale pour un transfert qui continue lentement.

Le test existant `TestShutdownKeepsBackendOnWorkerThread` confirme explicitement que l'arrêt attend une opération active. L'impact d'un réseau lent découle du téléchargement synchrone dans cette opération ; aucun gel en production n'est affirmé.

Sources : [file de commandes et attente du thread](../client-wx/src/modules/audio/infrastructure/AsyncAudioBackend.cpp), [téléchargement du son](../client-wx/src/modules/audio/infrastructure/SoundAssetPath.cpp), [lecture HTTP](../client-wx/src/shared/network/infrastructure/http/WsTicketTransport.cpp), [fermeture graphique](../client-wx/src/app/navigation/presentation/AppNavigator.Session.cpp).

Correction recommandée : rendre les téléchargements annulables avec une échéance globale et traiter la fermeture sans bloquer le thread graphique. Conserver la sérialisation des appels BASS, qui protège contre d'autres courses.

**8. Les erreurs 404 audio ne rafraîchissent pas le catalogue du client**

Un client charge le catalogue, puis le son est remplacé avant qu'il ne télécharge ce fichier. Si la notification est manquée, le serveur refuse l'ancienne URL avec une erreur 404. Le client journalise l'échec mais garde `manifestLoaded_` à vrai. Les essais suivants peuvent continuer à demander cette même ancienne URL.

La récupération dépend alors d'une autre invalidation : reconnexion, nouvelle notification ou écoute d'un aperçu. Pour une ambiance sans fichier local de secours, cela peut maintenir l'absence de son. Un autre déclencheur existe dans le code actuel : si le nettoyage strict échoue après l'enregistrement du nouveau son, la notification de mise à jour n'est pas émise.

Sources : [cache du catalogue et traitement de l'échec](../client-wx/src/modules/audio/infrastructure/SoundAssetPath.cpp), [rejet des anciennes URL](../backend/src/modules/sounds/infrastructure/storage/sounds.service.ts), [échec de nettoyage avant notification](../backend/src/modules/sounds/infrastructure/storage/sounds-upload.manager.ts).

Correction recommandée : sur une version absente, invalider le catalogue, le relire et réessayer une seule fois avec la nouvelle référence. Prévoir une réconciliation après une publication partiellement réussie.

**9. La boucle déjà audible conserve l'ancienne version du son**

Une notification `sounds.updated` appelle `RefreshAssets`. Cette méthode invalide le catalogue et libère les flux inactifs, mais conserve volontairement la boucle active. Elle ne compare pas son ancienne empreinte au nouveau son et ne réévalue pas sa désactivation.

Un joueur peut continuer à entendre l'ancien fichier après un remplacement ou une désactivation du son jusqu'à un nouveau changement de fond sonore. Le serveur peut parfaitement n'avoir qu'un seul fichier : cela ne garantit pas que le client a cessé de jouer l'ancienne version déjà ouverte.

Sources : [réception des notifications](../client-wx/src/app/navigation/presentation/AppNavigator.Audio.cpp), [rafraîchissement](../client-wx/src/modules/audio/infrastructure/BassAudioBackend.Assets.cpp), [conservation du flux actif](../client-wx/src/modules/audio/infrastructure/BassStreamCache.cpp).

Correction recommandée : préserver la boucle quand son contenu est inchangé, la remplacer quand son empreinte change et l'arrêter quand elle est désactivée. Le comportement actuel évite le redémarrage de la musique à la connexion ; la correction doit conserver ce bénéfice.

**10. Une ambiance peut rester créée alors que l'envoi de son fichier échoue**

Le client commence par créer la définition de l'ambiance, puis envoie son fichier dans une deuxième requête. La création serveur rend immédiatement cette définition active. Si l'envoi échoue, le client efface le chemin en attente et affiche l'erreur, sans annuler la création ni proposer une reprise attachée à cette création.

La liste peut donc contenir une ambiance sans son. Recommencer par « créer » peut consommer un autre emplacement ; le serveur limite le catalogue à 20 ambiances. Ce scénario nécessite un échec après la première requête réussie.

Sources : [enchaînement client, ligne 124, et erreur, ligne 79](../client-wx/src/modules/admin/presentation/AdminFrame.Completion.cpp), [création active côté serveur](../backend/src/modules/sounds/infrastructure/storage/sounds-table-ambiences.manager.ts).

Correction recommandée : conserver l'identifiant créé et permettre de reprendre l'envoi, ou créer un brouillon inactif qui n'est publié qu'après validation du fichier. Une opération serveur unique serait également possible.

**11. Un verrou abandonné bloque les nouvelles publications du client**

La publication crée `.publish.lock` avec ouverture exclusive et le supprime dans un `finally`. Un arrêt brutal du processus ou de la machine ne passe pas par ce `finally`. Le fichier restant suffit alors à faire rejeter les publications suivantes comme si une publication était encore active.

La sonde laisse volontairement un tel fichier, sans processus propriétaire, puis constate deux refus successifs. Un simple redémarrage du backend ne retire pas ce fichier dans le parcours inspecté.

Source : [verrou de publication, ligne 238](../backend/src/modules/update/infrastructure/persistence/wx-update-publication.manager.ts).

Correction recommandée : utiliser un verrou libéré par la disparition du processus, ou une récupération vérifiable de son propriétaire. Supprimer automatiquement un verrou uniquement parce qu'il est ancien serait dangereux : un processus encore actif peut être suspendu.

**12. Une panne après rotation du jeton de renouvellement casse la session**

Le serveur consomme l'ancien jeton de renouvellement avant de terminer la recherche du compte et la signature du nouvel accès. Si la base de données échoue ensuite, le client reçoit une erreur sans obtenir le nouveau jeton. Réessayer avec son ancien jeton échoue puisqu'il a déjà été consommé.

La sonde simule cette panne de base : premier appel en erreur technique, deuxième appel rejeté comme jeton invalide. Le client efface sa session lorsqu'un renouvellement est explicitement rejeté. Une panne temporaire peut donc se transformer en déconnexion nécessitant une nouvelle authentification.

Sources : [ordre des opérations du renouvellement](../backend/src/modules/user/application/use-cases/refresh-user-session.service.ts), [consommation Redis et émission suivante](../backend/src/modules/user/infrastructure/security/redis-refresh-token.service.ts), [traitement client du rejet](../client-wx/src/modules/session/application/SessionStore.Refresh.cpp).

Correction recommandée : rendre le renouvellement récupérable ou idempotent sur une tentative identifiée, tout en conservant la détection de réutilisation abusive. Tester séparément une panne Redis, une panne SQL et la perte de la réponse après réussite côté serveur.

**Deux points conditionnels à ne pas confondre avec les problèmes précédents**

- Le remappage Vault applique une deuxième fois la correspondance à `players[].id` et à `turn.currentPlayerId`. La sonde avec `-1 → -2` et `-2 → -3` produit deux joueurs `-3`. Le défaut de fonction est reproduit, mais le chevauchement des anciens et nouveaux identifiants dépend de leur allocation ; il peut être absent avec une séquence de base strictement croissante. Il est à couvrir dans la correction du point 4, sans affirmer que les restaurations courantes créent déjà ces doublons.
- Le blocage social n'est pas consulté par le parcours d'envoi des messages privés inspecté. Si « bloquer » doit empêcher ces messages, la règle n'est pas appliquée sur ce parcours. Il faut fixer ce contrat produit avant de classer ce comportement comme un défaut fonctionnel certain. Sources : [envoi de message](../backend/src/modules/messaging/application/services/private-messaging.service.ts), [gestion du blocage](../backend/src/modules/social/application/services/social-relationship.service.ts).

**Vérifications et portée**

Les [sondes conservées](probes.spec.ts) ont exécuté neuf scénarios avec succès. Ici, « succès » signifie que le comportement indésirable attendu a été reproduit. Le traitement ffmpeg est simulé pour isoler les courses de persistance. Les erreurs de stockage et de base sont injectées ; aucune base ni aucun fichier métier en production n'est modifié.

Les tests existants relancés passent également : 52 tests backend dans huit suites, et sept suites CTest côté client. Ils couvrent notamment la navigation administrateur du quiz, les caches et manifestes audio, le thread audio, les contrats réseau/options, la messagerie, la publication, les sauvegardes, les compensations de restauration, l'authentification, l'idempotence des commandes de jeu et la visibilité des événements. Ces résultats ne couvrent pas tous les scénarios de panne présentés ci-dessus.

Résultats conservés : [sondes](probes.log), [backend messagerie audio publication](backend-existing.log), [backend états de jeu et authentification](backend-state-auth.log), [client](client-tests.log).

Pour relancer les sondes depuis la racine du dépôt :

```powershell
node audit-2026-10-07/run-probes.cjs
```

Le lanceur utilise les dépendances locales et un adaptateur de transformation JavaScript pour l'environnement de test, sans modifier la configuration applicative. Il peut aussi lancer des suites existantes avec `--existing` suivi de leurs noms.

Cette analyse couvre les chemins cités du client Windows et du backend. Elle ne vaut pas validation exhaustive de tous les jeux, audit de l'infrastructure de production, mesure de charge ni test manuel complet avec lecteur d'écran. Les hypothèses sur les délais et les droits en production restent dépendantes de la configuration déployée.

L'ordre de correction conseillé est : révocation des accès et sessions ; mutations et stockage audio ; sauvegardes Vault et purge des messages ; puis récupération réseau, fermeture du client et publication. Les sondes peuvent servir de base aux tests de non-régression en exigeant cette fois la conservation des données et le rejet des anciens accès.
