# Preuve du point 693

Les politiques du domaine/runtime sont contrôlées par
`inspectPolicyPurity` dans `tools/policy-purity.cjs`, intégré à
`architecture-check.cjs`. Le contrôle interdit l’attente, les callbacks de
service, les dépendances techniques, l’horloge, le hasard et la configuration
ambiante dans les décisions. `architecture:test` passe sur la production.

Le point 693 est donc couvert par code, test et documentation.
