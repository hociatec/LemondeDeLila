# Masquage PII dans les textes libres

Le sanitizer d’observabilité masque désormais aussi les adresses e-mail et
les numéros de téléphone lorsqu’ils apparaissent directement dans un texte,
en complément du masquage par clé des objets structurés. Le texte source n’est
pas muté et la longueur reste bornée.

Preuves :

- `src/platform/observability/application/log-sanitizer.ts`
- `src/platform/observability/application/log-sanitizer.spec.ts`
- test e-mail/téléphone en texte libre
- `npm run typecheck`
