# Workflows Room — points 222 et 227 clôturés

La coordination du gateway Room conserve le cycle de vie et délègue les
scénarios de création et de jonction à des workflows dédiés. Ces workflows
utilisent les façades applicatives et les contrats de capacité Room ; aucun
service WS ne dépend directement d'un autre service WS pour exécuter son métier.

Preuves : `room-gateway-lifecycle.service.ts`,
`room-gateway-creation.workflow.ts`, `room-gateway-join.workflow.ts`,
`tools/layout-architecture-audit.cjs` et `tools/architecture-check.cjs`.
