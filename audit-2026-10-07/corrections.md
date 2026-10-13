# Corrections de l’audit du 7 octobre 2026

Les douze constats de l’[audit initial](rapport.md) ont reçu un correctif sur la branche `fix/audit-client-backend-20261007`, à partir de `25eeff841`. Les modifications sont locales : aucune publication ni migration de production n’a été exécutée.

| Points | Correction |
| --- | --- |
| 1–2 — Accès et sessions | Les gardes HTTP et les commandes WebSocket relisent le compte et ses droits. Les jetons sont liés à une empreinte du mot de passe stocké : un changement de mot de passe invalide les anciens accès et leur renouvellement. Les connexions WebSocket vérifient aussi le compte avant leur enregistrement. |
| 3 — Concurrence audio | Un verrou système commun sérialise les mutations, y compris entre instances. Deux sons différents conservent leurs références ; deux remplacements de la même ambiance laissent exactement le fichier courant. |
| 4 — Restauration Vault | Le remappage cible les références de joueurs et les dictionnaires indexés par joueur. Les scores, positions, quantités, cartes et sens de jeu restent inchangés. Une correspondance d’identifiants n’est appliquée qu’une fois. |
| 5 — Messagerie | La purge appartient à chaque participant. La ligne n’est effacée que lorsque les deux copies sont purgées. Une sauvegarde tardive ne peut pas recréer une ligne déjà effacée. |
| 6 — Stockage audio | Seul un fichier absent donne un catalogue vide. Un fichier illisible ou mal formé bloque la mutation et reste intact. |
| 7 — Téléchargement et fermeture | Les commandes prioritaires et la fermeture peuvent annuler les requêtes audio WinHTTP. Les requêtes disposent aussi d’une échéance totale. Les appels BASS restent sur le thread audio. |
| 8 — Ancienne URL | Une récupération audio échouée entraîne une relecture bornée du manifeste et une tentative sur le nouveau fichier si son empreinte a changé. |
| 9 — Ambiance active | Une notification rafraîchit la boucle active si son fichier change, et l’arrête si le son est désactivé. La désactivation d’une ambiance de table figure désormais dans le manifeste audio ; ses notifications sont prises en compte. Les notifications distinctes partageant le même horodatage ne sont plus ignorées. |
| 10 — Création d’ambiance | Le client envoie le nom et le fichier dans une seule requête. Le serveur prépare une ambiance désactivée, valide le fichier, puis active l’ambiance. Une erreur traitée déclenche le nettoyage de la création ; le fichier temporaire est supprimé. |
| 11 — Publication | Le verrou de publication est détenu par le système d’exploitation. Un fichier de verrou abandonné ne bloque plus une nouvelle publication ; un propriétaire vivant conserve son exclusion. |
| 12 — Renouvellement | La lecture du compte et la signature précèdent la rotation. La rotation Redis est atomique ; pendant 60 secondes, une reprise restitue le même successeur. Un ancêtre dont le successeur est déjà renouvelé ou révoqué est refusé. Redis ne stocke pas les jetons en clair. |

Le blocage social empêche désormais l’envoi de messages privés dans les deux sens. Le contrôle conserve les messages existants. Le chevauchement d’identifiants de bots est couvert par la correction Vault.

La vérification a aussi corrigé des fixtures TypeScript devenues incompatibles, séparé les constructeurs de schémas pour respecter la limite de taille des fichiers, et ajouté la dépendance de génération des contrats au test audio CMake.

## Validation

- **216 tests backend, dans 42 suites**, validés. La campagne élargie comptait initialement une assertion attendant l’ancien filtrage silencieux des ambiances invalides ; cette assertion a été remplacée par la vérification du refus et de la conservation du fichier, puis la suite a été relancée avec succès. Le test d’arrêt forcé du détenteur de verrou a été ajouté et exécuté ensuite.
- **11 suites CTest**, toutes réussies : navigation administrateur, contrats, audio asynchrone, caches, manifestes, récupération après remplacement et annulation d’une vraie réponse HTTP bloquée sur localhost.
- Tests de purge et de migration exécutés sur **MySQL 9.1 isolé**, avec données fictives. Les bases temporaires sont supprimées par les tests.
- Compilation complète du client Windows ; `npm run build`, chargement de l’`AppModule` compilé et vérification TypeScript complète réussis.
- ESLint sur les fichiers TypeScript modifiés ; contrôles d’architecture backend/client et de structure backend réussis.

Les tests Jest ont utilisé le [lanceur local](run-probes.cjs) pour adapter la transformation JavaScript aux dépendances déjà installées. Les anciennes [sondes](probes.spec.ts) reproduisent les défauts de la version initiale ; elles constituent une preuve historique, pas la suite de validation des corrections.

Preuves : [campagne backend](backend-final-tests.log), [relance de la suite corrigée](backend-final-recheck.log), [contrats de migration](migration-contracts.log), [arrêt forcé et verrous](file-lock-final.log), [MySQL](messaging-mysql.log), [client](client-final-tests.log), [compilation backend](backend-build.log), [compilation client](client-app-clean-build.log).

La rotation a été vérifiée avec un Redis simulé, sans serveur Redis réel disponible dans cet environnement. Les scénarios de concurrence audio utilisent de vrais fichiers et verrous, avec le transcodage simulé. Cette validation ne remplace pas une campagne de charge ni une écoute manuelle complète avec lecteur d’écran.

## Déploiement

1. Appliquer la migration `1791367200000-AddIndependentMessagePurge` avant de démarrer le nouveau backend. Son empreinte est enregistrée dans le registre des migrations. Elle peut reprendre après une application partielle ; son retour arrière refuse de rendre visibles des copies déjà purgées.
2. Effectuer un redémarrage coordonné des anciennes instances : l’ancien protocole de verrou de publication et le nouveau ne doivent pas fonctionner simultanément. Les fichiers `.publish.lock` et `.sounds.lock` sont désormais des fichiers stables ; leur présence seule n’indique pas un blocage.
3. Sous Linux, disposer de `flock` — déjà exigé par `updatecmd`. Sous Windows, le verrou utilise PowerShell. Les tests de verrou ont été exécutés sous Windows.
4. Prévoir une reconnexion unique des utilisateurs : les anciens jetons ne portent pas l’empreinte de session requise. Publier le nouveau backend avant le client qui utilise la création d’ambiance avec fichier en une requête.

Une interruption brutale pendant la préparation d’une ambiance peut conserver un brouillon désactivé ; le nettoyage automatique décrit ci-dessus couvre les erreurs traitées par le serveur. Les connexions WebSocket inactives sont revérifiées à la prochaine commande, et non par un balayage périodique.
