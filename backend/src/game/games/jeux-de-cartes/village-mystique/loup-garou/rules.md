# Loup Garou (version intégrée)

- Jeu de déduction sociale en tours nuit / jour.
- Rôles présents (version de base) : Loup Garou, Voyante, Sorcière, Cupidon, Villageois.
- Minimum 6 joueurs, maximum 12.

## Déroulé

1. **Nuit**
   - Voyante : choisit un joueur et voit son rôle (info privée).
   - Cupidon (nuit 1 uniquement) : lie deux joueurs (amoureux).
   - Loups : choisissent une victime.
   - Sorcière : peut sauver la victime (potion de vie, 1 usage) et/ou empoisonner un autre joueur (1 usage).
   - Application des morts (loups + poison), puis mort éventuelle de l’amoureux survivant.
2. **Annonce** : la liste des morts de la nuit est publiée.
3. **Vote de jour** : chaque joueur vivant vote pour éliminer quelqu’un (égalité = pas d’élimination). Mort éventuelle de l’amoureux survivant.
4. **Vérification des victoires** :
   - Village gagne si aucun loup en vie.
   - Loups gagnent si leur nombre est >= aux autres joueurs vivants.
   - Amoureux gagnent si seuls eux sont en vie.
5. Boucle sur une nouvelle nuit si personne n’a gagné.

## Actions

- `seer_peek(targetId)`
- `cupid_link(a, b)` (nuit 1)
- `wolves_choose(targetId)`
- `witch_decide({ save?: boolean, killTargetId?: number })`
- `day_vote(targetId | null)` (null = abstention)

## Temps et délais

Le moteur avance automatiquement à l’étape suivante dès qu’une action valide est reçue pour l’étape courante. Un système de timeout peut être ajouté via le serveur hôte en envoyant une action par défaut (ex. vote blanc) si nécessaire.
