# Ordre des états WebSocket — 11 septembre 2026

Corrections appliquées au suivi de diffusion des états de jeu, dans le
périmètre du point 153. Le backlog reste à 52 points : cette passe valide le
serveur local, pas l'ordre de réception côté client dans une installation
multi-instance.

- Le suivi compare désormais le salon, le jeu, le numéro de partie et la
  version. Une partie suivante peut repartir à la version 1 après une partie
  ayant atteint la version 100. Un message tardif de la partie précédente
  est rejeté même si sa version est supérieure.
- Les connexions disparues sont retirées du suivi à la prochaine diffusion.
  Le service conserve au plus une entrée par connexion présente lors de la
  dernière diffusion, au lieu d'accumuler les connexions historiques.
- Le nettoyage utilise les identités exactes. Effacer le suivi de `lama`
  n'efface plus accidentellement celui de `lama-plus`, et les séparateurs dans
  les identifiants de connexion ne perturbent pas la sélection du salon.
- La version envoyée est enregistrée après présentation et acceptation par
  le transport. Une exception ou un retour `false` du hub ne fait plus avancer
  ce suivi. L'acceptation du transport n'est pas un accusé de réception client.

Le format réseau existant conserve `runId` et `version`. Aucun changement
de contrat SDK, migration de données ou déploiement.

Les tests de non-régression couvrent le changement de partie, les messages
tardifs, les échecs de projection et de transport, les connexions disparues
et les identités contenant des préfixes communs. Les suites de présentation,
cycle de vie WebSocket et hub sont exécutées avec ces tests.

Résultats : 4 suites et 37 tests réussis. Audits de structure et d'architecture
réussis. Build de 1 683 fichiers et chargement du module compilé réussis.
La suite complète du backend n'a pas été relancée pendant cette passe.
