# Corrections du journal et des invariants — 11 septembre 2026

Le snapshot courant de `corriger.txt` passe de 54 à **52 points ouverts**.
Les points 160 et 190 sont retirés après application des corrections et tests.
Le registre de gouvernance a été synchronisé : il indiquait à tort une liste vide.

## Points clôturés

- **160 — Contrat durable versionné** : le journal de jeu écrit le format 1,
  accepte les anciens événements sans en-tête comme format 1 et refuse les
  versions inconnues. Le replay vérifie les séquences et les patches, et ne
  retourne plus silencieusement un état partiel en cas de commit malformé.
- **190 — Invariants des ressources et compteurs** : les kits et la validation
  d'état restauré centralisent les limites numériques et les identifiants
  autorisés. Un transfert refusé ne crée plus de solde vide. Les clés héritées
  telles que `__proto__`, `constructor` et `toString` sont refusées avant mutation.
  Les tests vérifient l'absence de modification d'état, de prototype et d'émission
  lors d'un rejet. Les valeurs signées permises par le contrat restent permises.

## Corrections associées

Les projections d'événements utilisent une whitelist ; les payloads sont
validés avant clonage et copiés à l'émission. Les égalités du classement générique
sont départagées explicitement par identifiant numérique de joueur. Ces progrès
ne clôturent pas les audits transversaux 147, 148, 156, 157, 161, 199 et 200.

Le runtime ne tronque plus silencieusement son tampon à 128 événements. Le test
long de Panier Express a révélé que le simulateur gardait les événements déjà
comptés dans ce tampon. Il les consomme maintenant à chaque étape et conserve
l'historique dans le résultat ; le test vérifie plus de 128 événements et la
correspondance exacte avec les compteurs.

Le contrat SDK est passé à **6.2**, avec 109 déclarations suivies.
Voir [le contrat du journal](../architecture/game-event-contract.md).

## Vérifications

- Passe complète : 290 suites, 1 412 tests ; 289 suites et 1 411 tests réussis,
  un échec dans le simulateur Panier Express, corrigé ensuite.
- Après correction : 4 suites ciblées, **39 tests réussis**, dont Panier Express,
  les contrats de journal, les projections et les invariants numériques.
- Régression finale : 3 suites, **83 tests réussis**, couvrant le simulateur,
  le runtime et le contrat des 39 jeux.
- TypeScript et lint ciblé réussis. Build de 1 681 fichiers et chargement du
  module compilé réussis.
- Audits de structure, architecture, moteur et contrat SDK réussis ; gouvernance
  du registre validée avec 52 dettes ouvertes.

Ces ensembles se recoupent et ne doivent pas être additionnés. La suite complète
n'a pas été relancée après la correction du simulateur ; ses usages identifiés
ont été revérifiés dans les suites ciblées. Aucun déploiement effectué.

Le contrôle historique `corrections-backlog-check.cjs` utilise encore des preuves
de clôture issues d'une ancienne numérotation. Il n'est pas utilisé pour déclarer
les points actuels clos ; sa réconciliation reste à traiter. Les autres points
du snapshot restent ouverts, notamment Panier Express 100 % déclaratif.
