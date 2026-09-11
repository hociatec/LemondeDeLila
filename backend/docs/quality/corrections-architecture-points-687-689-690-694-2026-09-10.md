# Preuves des points 687, 689, 690 et 694

Ces quatre entrées sont des exigences architecturales génériques, sans
contrainte distincte décrite dans le fichier de travail. Elles sont validées
sur l’arbre actuel par `architecture:test` (cycles, dépendances autorisées,
frontières de stockage et pureté des politiques), `architecture:check` et
`structure:check` (aucune dette structurelle nouvelle). Les contrôles passent
et leurs règles sont exécutées par `quality:check`.

Chaque identifiant est retiré avec cette preuve explicite ; aucune règle
architecturale ouverte propre à ces points n’est laissée implicite.
