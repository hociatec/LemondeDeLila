# Module audio

Le module sépare volontairement les responsabilités :

- `domain` définit les identifiants et familles de sons, sans chemin de fichier ni texte d’interface ;
- `application` contient les contrats, la résolution des volumes et l’orchestration ;
- `infrastructure` contient le worker asynchrone, BASS, les caches et les ressources locales ;
- `presentation` contient uniquement les libellés affichés dans les options.

Les appels venant de l’interface ne chargent jamais un fichier directement. Les commandes prioritaires
(`Play`, changement d’ambiance, arrêt) passent avant le préchargement. Les samples et streams sont
conservés jusqu’à l’arrêt du moteur, et un fichier invalide n’est pas retenté à chaque événement.

Les fichiers locaux partagés entre plusieurs événements correspondent aux sons de repli du client WPF.
Ils restent déclarés dans `LocalSoundManifest` jusqu’à ce que des ressources dédiées soient disponibles.

Règle de maintenance : ne pas regrouper catalogue, paramètres, ordonnancement et appels BASS dans un
service unique. Toute nouvelle responsabilité doit rejoindre le composant spécialisé correspondant.
