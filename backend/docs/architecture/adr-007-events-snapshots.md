# ADR-007 — Événements et snapshots de jeu

Statut : accepté.

L'état courant versionné est la source de vérité d'exécution. Chaque commande
validée produit des événements structurés, séquencés et dotés d'une visibilité ;
les vues joueur filtrent les événements privés avant transport. Les événements
ne remplacent pas les règles d'autorité contenues dans l'état.

La session, ses événements et ses snapshots sont stockés dans des tables
séparées mais écrits dans la même transaction CAS. Un snapshot est périodique,
borné en taille, versionné et associé au run courant de la room. Le replay part
du dernier snapshot applicable puis rejoue les événements suivants dans l'ordre.
Une projection WS provenant d'un ancien run est rejetée.

Toute évolution incompatible de l'état ajoute une migration déterministe et un
fixture d'ancienne version. Les tests couvrent commit atomique, replay,
nettoyage concurrent sans suppression d'un snapshot plus récent, visibilité et
rejet des snapshots obsolètes.

