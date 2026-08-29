# ADR-002 — Arborescence source historique

Statut : remplacé par ADR-003.

Cette décision conservait auparavant une capacité métier par dossier racine et
classait les composants techniques sous un conteneur commun. La croissance du
backend a rendu ces catégories implicites insuffisantes.

ADR-003 remplace intégralement cette organisation par les frontières physiques
`modules`, `game`, `platform` et `shared`. Le présent document est conservé
uniquement pour tracer la décision antérieure ; il ne définit plus aucune règle
active.
