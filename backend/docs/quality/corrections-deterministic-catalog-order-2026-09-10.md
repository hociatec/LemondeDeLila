# Ordre déterministe des projections catalogue

Les jeux, catégories et sous-catégories sont maintenant triés par identifiant
avec une comparaison Unicode indépendante de la locale. Les projections
catalogue ne dépendent donc plus de l’ordre d’arrivée d’un registre, d’un
cache ou d’une lecture DB.

Preuves :

- `src/modules/catalog/application/services/catalog-mapper.service.ts`
- `src/modules/catalog/application/services/catalog-services.spec.ts`
- test avec entrée inversée et caractères accentués
- `npm run typecheck`
