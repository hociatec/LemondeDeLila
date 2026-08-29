# ADR-001 — Plateforme backend

Statut: accepté.

- MySQL est le moteur SQL de production. Aucun SQL PostgreSQL n'est autorisé.
- Redis transporte sessions, caches et signaux temps réel selon le tableau de dégradation; il n'est jamais l'unique stockage d'un événement métier durable.
- Les commandes de jeu utilisent queue locale, verrou MySQL inter-instance et CAS transactionnel, dans cet ordre, avec le CAS comme autorité.
- L'état courant et le contrat d'événements sont séparés par ports. Les états JSON sont versionnés, bornés, migrés et rejouables.
- Random et clock du métier viennent exclusivement du contexte déterministe.
- Le runtime central orchestre; les capacités optionnelles sont des composants/kits. Une mécanique propre à un jeu reste locale.
