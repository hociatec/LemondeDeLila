# Correction du point 700 — références persistantes entre parties

Le contrat de chaque jeu vérifie maintenant l’état initial et chaque état
produit par commande avec `assertSerializableState`. Cette validation rejette
les cycles, prototypes techniques, accesseurs, clés symboliques et valeurs
non persistables qui pourraient faire traverser une référence d’objet entre
parties ou snapshots.

Le contrôle de contenu continue en parallèle d’interdire les catalogues et
questions hydratés dans l’état persistant. La suite contractuelle exécute ce
contrat pour tous les jeux enregistrés, avec plusieurs graines et commandes.
