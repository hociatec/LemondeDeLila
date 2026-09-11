# Ordre déterministe des lectures DB

## Point traité

Le point 712 interdit de dépendre de l'ordre de retour implicite de la base
lorsqu'une lecture renvoie plusieurs lignes.

## Implémentation

Les lectures TypeORM multi-lignes utilisées par les rôles, participants et bots
de salle, statistiques de partie, profils et relations sociales, snapshots,
notifications, messages, bugs et catégories portent désormais un `order`
explicite. Les égalités utilisent une seconde clé stable (`id` ou une clé
métier) lorsque cela est nécessaire.

## Vérification

- `npm run typecheck -- --pretty false`
- Revue automatisée des repositories TypeORM et des usages `find({ ... })`.
- Les repositories déjà ordonnés conservent leur ordre métier ; les lectures
  unitaires (`findOne`) ne sont pas concernées.
