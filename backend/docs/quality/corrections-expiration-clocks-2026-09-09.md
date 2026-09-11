# Horloges d'expiration — 9 septembre 2026

Complément des points 249, 252 et 253, conservés ouverts tant que la revue de
toutes les décisions et de tous les caches n'est pas terminée.

Treize services supplémentaires reçoivent le port BusinessClock existant par
injection obligatoire. Le composition root de chaque module importe son
implémentation système ; aucune horloge de secours n'est cachée dans ces
services. Les tests peuvent avancer l'horloge sans attendre ni modifier celle
du processus.

Périmètre : login et renouvellement de session, durée des bannissements admin
et chat, nettoyage/filtrage des bannissements admin, fenêtre de modification
et suppression des messages, invitations et permission de spectateur,
nettoyage des rooms et sélection de leur ancienneté, activité presence, cache
et date d'obligation des releases du client WX.

Défauts corrigés au cours de cette revue :

- Une consommation d'invitation à l'instant zéro est bien une consommation.
  Les valeurs retournées sont détachées du stockage ; leur mutation ne permet
  plus de changer le destinataire ou de s'accorder le droit de spectateur.
- La date de création et l'expiration d'une invitation utilisent le même instant.
- Une date invalide ou future de message ne permet pas de contourner la fenêtre
  de modification/suppression. L'échéance exacte reste incluse dans cette fenêtre.
- Le premier nettoyage à l'instant zéro déclenche bien la période d'attente.
- Une activité envoyée par le client ne peut pas placer son dernier instant
  d'activité dans le futur par rapport au serveur.

Tests ciblés : 12 suites / 54 tests réussis. Bannissement testé une milliseconde
avant et à l'échéance pour le login et le refresh ; invitation à son échéance ;
date obligatoire d'un manifeste réellement signé ; intervalle de nettoyage ;
horodatage d'activité et isolation des invitations. Typage et contrôle structurel
réussis. Validation globale : **251 suites / 1 096 tests réussis**, lint,
build/AppModule, quality:check, verify:dist et contrôle du diff réussis.
Les tests conditionnels qui nécessitent MySQL ou Redis ne constituent pas une
preuve d'intégration réelle lorsque ces serveurs sont absents.

Les invitations restent locales à une instance. Cette série n'établit donc pas
les exigences de stockage distribué, d'outbox ou d'invalidation multi-instance.

Journaux : logs/corrections-clock-{targeted,second-targeted,typecheck,build}.log.
