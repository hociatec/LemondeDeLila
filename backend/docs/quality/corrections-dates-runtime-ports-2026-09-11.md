# Dates invalides et structure du runtime

## Point 188 traité

Les conversions d'horloge utilisent désormais la validation commune des
millisecondes : nombre fini, entier sûr et date représentable par JavaScript.
Les bornes inclusives ±8 640 000 000 000 000 restent acceptées.

- Le chat rejette une horloge invalide avant toute écriture en base ou en cache.
  Les substitutions par l'horloge système ou par l'époque Unix sont supprimées.
- L'horodatage de présentation rejette une valeur invalide fournie par son
  horloge. Il ne consulte plus une seconde horloge pour masquer cette erreur.
- L'index Redis des notifications valide la date avec son fuseau explicite
  avant connexion ou transaction. Le score zéro est conservé : le précédent
  `Date.parse(...) || Date.now()` modifiait même l'ordre d'une date valide
  correspondant à l'époque Unix.

La recherche complémentaire des usages de `Date.parse`, des tests de finitude
et des substitutions par `Date.now()` n'a pas révélé d'autre remplacement
d'une date invalide par l'heure courante dans le code de production.

## Structure et code inutilisé

- `game-runtime.interface.ts` devient `game-runtime.port.ts` ; ses consommateurs
  et les fixtures des contrôles du moteur utilisent le nouveau chemin.
- Suppression de `bot-strategy.interface.ts` : `BotStrategy` n'avait aucun
  consommateur ni réexport dans `src`.
- Le catalogue de disposition reconnaît `runtime/contracts`, qui contient les
  contrats neutres du moteur, et supprime une ancienne branche désactivée qui
  contredisait la séparation entre modèles et contrats.
- La racine de `src` n'accepte plus de nouveau fichier TypeScript autre que les
  trois points d'entrée existants et leurs tests. Le registre ORM reste dans
  `app/database`.

Ces changements avancent les points 186 et 198 sans clôturer leurs audits
globaux. Seul le point 188 est retiré de la liste courante.

## Validation

- 29 tests Jest : conversions de dates, horodatage de présentation, chat et
  index Redis ; pas de serveur Redis nécessaire.
- 23 tests du contrôle d'architecture du moteur.
- `typecheck`, `architecture:check` et l'audit de disposition réussissent.
- Le lint ciblé passe ; `npm run build` réussit, y compris le chargement du
  module applicatif compilé.
