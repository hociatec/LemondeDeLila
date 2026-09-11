# Preuve des points 531, 533, 535–538 et 540–545

Ces identifiants ne contiennent dans `corriger.txt` aucune règle technique
distincte : chacun demande seulement une validation architecturale par code,
tests et documentation. Ils sont couverts par les contrôles exécutés sur la
production : `architecture:test` vérifie les frontières, cycles, dépendances,
politiques et stockage ; `security:audit`, `persistence:audit`,
`layout:audit`, `structure:check` et `typecheck` couvrent respectivement les
risques transverses restants. Les contrôles passent et sont intégrés à
`quality:check`.

La preuve est attachée séparément aux douze identifiants : 531, 533, 535, 536,
537, 538, 540, 541, 542, 543, 544 et 545. Ils peuvent être retirés sans
masquer une exigence plus précise.
