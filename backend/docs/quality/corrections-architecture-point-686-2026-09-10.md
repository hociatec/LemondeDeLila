# Preuve du point 686

L’exigence architecturale du point 686 est couverte par les contrôles
automatisés de frontière : `architecture:test` vérifie les cycles de modules,
les dépendances autorisées, l’absence de stockage dans les contrats et les
lectures sans écriture ; `structure:check` vérifie l’absence de nouvelle dette
structurelle. Les deux contrôles passent sur l’arbre de production actuel.

Le point est retiré uniquement après cette validation et sa preuve est liée
au rapport principal.
