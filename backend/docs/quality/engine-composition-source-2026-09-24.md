1. **Extraire les primitives communes restantes des `game-specific` :**
   **Problème :** les 38 domaines spécifiques sont maintenant correctement isolés, mais certains contiennent encore probablement des comportements réutilisables. Les laisser tels quels ferait grossir le code spécifique à chaque nouveau jeu.
   **À corriger :** comparer les comportements des 38 packs et extraire uniquement ce qui apparaît réellement dans plusieurs jeux vers des primitives génériques paramétrables.
   **Validation :** deux jeux différents peuvent utiliser la primitive sans référence à leur univers ou à leur mécanique métier particulière.
   **Priorité : P0.**

2. **Créer une matrice des mécaniques des 39 jeux :**
   **Problème :** sans cartographie globale, on risque soit de manquer des abstractions communes, soit de généraliser des comportements qui ne devraient pas l’être.
   **À corriger :** inventorier par jeu les usages de movement, ownership, collision, resources, payment, cards, zones, choices, status, collections, scoring, victory, targeting, triggers, etc.
   **Validation :** chaque abstraction extraite peut être reliée à plusieurs besoins concrets.
   **Priorité : P0.**

3. **Rendre les conditions paramétrables :**
   **Problème :** trop de logique spécifique peut provenir de simples `if` métier.
   **À corriger :** fournir des conditions composables telles que `all`, `any`, `not`, `equals`, comparaisons numériques, `hasResource`, `hasStatus`, `owns`, `atPosition`, `phaseIs`, etc.
   **Validation :** ajouter une condition de gameplay courante ne demande généralement aucun TypeScript.
   **Priorité : P0.**

4. **Rendre le ciblage paramétrable :**
   **Problème :** déterminer la cible d'une action peut nécessiter du code spécifique.
   **À corriger :** fournir des selectors génériques : joueur courant, soi-même, adversaires, propriétaire, joueur suivant/précédent, occupants d'une position, entités satisfaisant une condition, etc.
   **Validation :** les effect-packs n'implémentent plus leurs propres variantes des mêmes algorithmes de sélection.
   **Priorité : P0.**

5. **Créer un système limité d'expressions/calculs :**
   **Problème :** des calculs simples peuvent forcer l'ajout de code TypeScript.
   **À corriger :** supporter constantes, références à l'état, addition, soustraction, multiplication, division contrôlée, min/max, count et éventuellement clamp.
   **Validation :** loyers, bonus, pénalités et scores simples sont calculables déclarativement.
   **Priorité : P0.**

6. **Éviter de transformer le système d'expressions en langage de programmation :**
   **Problème :** trop généraliser produirait un mauvais JavaScript écrit en JSON, beaucoup plus difficile à maintenir.
   **À corriger :** interdire boucles arbitraires, fonctions utilisateur, mutation directe et comportements non déterministes dans le DSL.
   **Validation :** le DSL reste petit, typé, déterministe et facilement validable statiquement.
   **Priorité : P0.**

7. **Unifier complètement les ressources :**
   **Problème :** argent, énergie, points, jetons ou autres valeurs peuvent conduire à des implémentations parallèles.
   **À corriger :** disposer d'un modèle générique avec type de ressource, valeur, min/max et opérations communes.
   **Validation :** créer une nouvelle ressource ne nécessite aucune modification du moteur.
   **Priorité : P0.**

8. **Unifier coûts, paiements et transferts :**
   **Problème :** achat, taxe, pénalité et coût d'action peuvent être des variantes du même mécanisme.
   **À corriger :** converger vers `cost → affordability → settlement → insufficient-resource-policy`.
   **Validation :** les différents jeux utilisent les mêmes primitives de règlement.
   **Priorité : P0.**

9. **Rendre la politique de ressources insuffisantes paramétrable :**
   **Problème :** différents jeux peuvent annuler l'action, autoriser une dette, payer partiellement, déclencher une élimination, etc.
   **À corriger :** représenter ces comportements comme politiques explicitement configurables.
   **Validation :** aucune variante courante ne nécessite de modifier `resource-settlement`.
   **Priorité : P1.**

10. **Généraliser les statuts :**
    **Problème :** protection, poison, immobilisation, bonus et malus sont des variations d'un même concept.
    **À corriger :** introduire status/modifier avec source, cible, durée, stacks, expiration et paramètres.
    **Validation :** ajouter un nouveau statut ordinaire ne nécessite pas un nouveau subsystem.
    **Priorité : P1.**

11. **Généraliser les protections :**
    **Problème :** plusieurs mécaniques peuvent vouloir bloquer un effet selon une condition.
    **À corriger :** permettre à un statut/modifier d'intercepter des catégories d'effets ou événements déterminées.
    **Validation :** immunité, bouclier, protection de position ou protection temporaire utilisent la même infrastructure.
    **Priorité : P1.**

12. **Séparer mouvement et conséquence du mouvement :**
    **Problème :** coupler déplacement et effet d'arrivée réduit fortement la composabilité.
    **À corriger :** le mouvement modifie la position puis émet un événement ; d'autres règles traitent arrivée, passage ou sortie.
    **Validation :** on peut changer les effets des cases sans modifier le moteur de déplacement.
    **Priorité : P0.**

13. **Rendre les règles de mouvement paramétrables :**
    **Problème :** plusieurs `race-*` suggèrent des variantes proches.
    **À corriger :** isoler distance, direction, wrap, blocage, mouvement forcé, téléportation et topologie.
    **Validation :** plusieurs familles de jeux de déplacement utilisent le même moteur.
    **Priorité : P0.**

14. **Généraliser les collisions :**
    **Problème :** capture, échange de positions, blocage ou retour au départ sont des politiques de résolution différentes.
    **À corriger :** séparer détection de collision et résolution.
    **Validation :** changer la politique de collision se fait par configuration/composition.
    **Priorité : P1.**

15. **Généraliser les zones de cartes :**
    **Problème :** deck, main, défausse, marché et cartes retirées du jeu ne devraient pas être des systèmes indépendants.
    **À corriger :** modéliser des zones génériques contenant des entités/cartes.
    **Validation :** une nouvelle zone peut être déclarée sans modification du runtime.
    **Priorité : P0.**

16. **Généraliser les opérations sur cartes/zones :**
    **Problème :** pioche, défausse, révélation, recherche et déplacement peuvent être réimplémentés.
    **À corriger :** fournir `draw`, `move`, `reveal`, `hide`, `shuffle`, `discard`, `search`, `choose`.
    **Validation :** les packs `cards-*` utilisent majoritairement ces primitives.
    **Priorité : P0.**

17. **Unifier le système de choix :**
    **Problème :** plusieurs domaines `choice-*` représentent probablement des variantes d'un même cycle.
    **À corriger :** modéliser `participants → options → visibility → validation → responses → resolution`.
    **Validation :** choix narratif, vote, quiz et choix simultané partagent la même infrastructure.
    **Priorité : P0.**

18. **Généraliser les collections :**
    **Problème :** plusieurs domaines `collection-*` indiquent une abstraction commune possible.
    **À corriger :** fournir collection, membership, transfer, request et completion.
    **Validation :** les règles spécifiques décrivent le contenu et les politiques, pas le stockage des collections.
    **Priorité : P1.**

19. **Généraliser ownership :**
    **Problème :** propriété d'une case, carte, objet ou autre entité ne doit pas produire des systèmes séparés.
    **À corriger :** conserver un modèle unique de possession lorsque la sémantique est équivalente.
    **Validation :** les mécanismes économiques et de collection peuvent utiliser le même concept d'ownership.
    **Priorité : P1.**

20. **Généraliser les triggers :**
    **Problème :** beaucoup de règles spécifiques sont probablement « quand X arrive, faire Y ».
    **À corriger :** standardiser `onAction`, `onEvent`, `onEnter`, `onLeave`, `onTurnStart`, `onTurnEnd`, `onResourceChanged`, `onCardPlayed`, etc.
    **Validation :** une règle événementielle ordinaire est définissable sans handler spécifique.
    **Priorité : P0.**

21. **Faire de `Trigger → Selector → Condition → Expression → Effect` le modèle commun :**
    **Problème :** sans modèle de composition uniforme, chaque domaine peut créer sa propre mini-architecture.
    **À corriger :** permettre aux recipes et jeux de composer ces cinq familles de primitives.
    **Validation :** une proportion importante des règles actuellement spécifiques peut être exprimée par cette chaîne.
    **Priorité : P0.**

22. **Généraliser les conditions de victoire :**
    **Problème :** multiplier les `victoryKind` spécifiques ferait grossir le moteur avec chaque jeu.
    **À corriger :** composer victoire/défaite à partir de conditions génériques : score, ressource, position, collection, élimination, objectifs, `all/any`.
    **Validation :** une nouvelle condition composée ne nécessite généralement aucun code moteur.
    **Priorité : P0.**

23. **Conserver des recipes paramétrables au-dessus des primitives :**
    **Problème :** utiliser uniquement des primitives rendrait les `game.json` beaucoup trop longs.
    **À corriger :** créer des recipes pour les compositions récurrentes sans les intégrer au core.
    **Validation :** un auteur peut choisir une recipe simple ou descendre aux primitives lorsque nécessaire.
    **Priorité : P1.**

24. **Ne pas essayer de supprimer artificiellement tous les `game-specific` :**
    **Problème :** vouloir atteindre zéro code spécifique produirait des abstractions énormes et difficiles à comprendre.
    **À corriger :** conserver dans `game-specific` ce qui est réellement unique.
    **Validation :** ce code dépend du moteur ; le moteur ne dépend jamais de ce code.
    **Priorité : P0.**

25. **Réduire les gros `game-specific` :**
    **Problème :** certains dépassent largement le millier de lignes, ce qui suggère qu'ils contiennent probablement plusieurs responsabilités.
    **À corriger :** après extraction des primitives, découper le reste par responsabilité cohérente.
    **Validation :** un pack spécifique orchestre principalement des primitives et contient peu d'infrastructure générique.
    **Priorité : P1.**

26. **Empêcher les abstractions génériques mono-jeu injustifiées :**
    **Problème :** une mécanique spécifique pourrait progressivement revenir dans la couche générique.
    **À corriger :** faire appliquer automatiquement la gouvernance `scope: generic`.
    **Validation :** CI bloque une abstraction générique ne respectant pas les critères définis.
    **Priorité : P0.**

27. **Verrouiller les dépendances architecturales :**
    **Problème :** une future contribution peut casser la séparation actuelle.
    **À corriger :** tester automatiquement les directions d'import entre core/runtime/SDK/rules/game-specific/games.
    **Validation :** une dépendance interdite fait échouer CI.
    **Priorité : P0.**

28. **Interdire les imports profonds du runtime depuis les jeux/extensions :**
    **Problème :** cela rendrait les jeux dépendants des détails d'implémentation.
    **À corriger :** imposer `public-api`/`extension-api`.
    **Validation :** aucun jeu ne dépend directement d'un module interne non public.
    **Priorité : P0.**

29. **Geler contractuellement `public-api.ts` :**
    **Problème :** un changement involontaire pourrait casser plusieurs jeux.
    **À corriger :** snapshot ou API-extractor équivalent des exports publics.
    **Validation :** tout breaking change nécessite une modification explicitement approuvée.
    **Priorité : P1.**

30. **Geler contractuellement `extension-api.ts` :**
    **Problème :** même risque pour les extensions.
    **À corriger :** même protection que l'API principale.
    **Validation :** changement accidentel détecté automatiquement.
    **Priorité : P1.**

31. **Garantir la parité JSON/API :**
    **Problème :** deux chemins d'authoring ne doivent pas avoir des comportements subtilement différents.
    **À corriger :** compléter les tests de parité pour chaque primitive accessible depuis JSON.
    **Validation :** même scénario logique = mêmes transitions et événements.
    **Priorité : P1.**

32. **Maintenir un core JSON fermé :**
    **Problème :** chaque nouveau jeu ne doit pas ajouter son propre mot-clé au langage central.
    **À corriger :** conserver le test architectural déjà introduit.
    **Validation :** aucun champ métier spécifique n'apparaît dans le core schema.
    **Priorité : P0.**

33. **Limiter la taille conceptuelle du DSL :**
    **Problème :** même avec un schema généré automatiquement, le langage peut devenir énorme.
    **À corriger :** privilégier composition et recipes avant l'introduction d'un nouveau concept syntaxique.
    **Validation :** le vocabulaire fondamental reste stable lorsque de nouveaux jeux sont ajoutés.
    **Priorité : P1.**

34. **Uniformiser toutes les erreurs d'authoring :**
    **Problème :** un `throw new Error()` générique réduit fortement l'expérience de développement.
    **À corriger :** utiliser systématiquement les erreurs structurées d'authoring pour les erreurs de configuration.
    **Validation :** erreur = code + chemin + explication + contexte utile.
    **Priorité : P1.**

35. **Supprimer les casts `unknown` non justifiés aux frontières critiques :**
    **Problème :** ils peuvent masquer une divergence entre schema runtime et type TypeScript.
    **À corriger :** réduire les casts et ajouter des contrats/tests lorsqu'ils sont indispensables.
    **Validation :** toute conversion `unknown → type métier` possède une validation préalable identifiable.
    **Priorité : P1.**

36. **Tester automatiquement schema runtime ↔ types attendus :**
    **Problème :** TypeScript ne protège pas les fichiers JSON à l'exécution.
    **À corriger :** tests contractuels des schemas et types des extensions.
    **Validation :** une divergence est détectée par CI.
    **Priorité : P1.**

37. **Terminer l'ownership explicite de l'état :**
    **Problème :** certaines protections architecturales peuvent encore être heuristiques.
    **À corriger :** chaque composant déclare formellement l'état qu'il possède.
    **Validation :** l'auditeur n'a plus besoin de deviner l'ownership à partir du nom des propriétés.
    **Priorité : P1.**

38. **Interdire la duplication de l'état canonique :**
    **Problème :** deux sources de vérité entraînent rapidement des désynchronisations.
    **À corriger :** conserver/étendre `auditGameStateOwnership`.
    **Validation :** position, inventory, hand, score, etc. n'ont qu'un propriétaire canonique.
    **Priorité : P0.**

39. **Maintenir l'immutabilité appropriée du contenu statique :**
    **Problème :** le contenu d'une définition ne doit pas devenir accidentellement de l'état de session.
    **À corriger :** conserver la séparation content/session et le freezing lorsque pertinent.
    **Validation :** aucune partie ne modifie une définition partagée.
    **Priorité : P1.**

40. **Verrouiller le déterminisme :**
    **Problème :** toute source nondéterministe casse replay et reproductibilité.
    **À corriger :** continuer à interdire `Math.random`, horloge système, réseau et I/O incontrôlée dans les règles.
    **Validation :** même seed + mêmes commandes + même version = même résultat.
    **Priorité : P0.**

41. **Centraliser entièrement le RNG :**
    **Problème :** une seule source aléatoire secondaire suffit à casser le déterminisme.
    **À corriger :** toutes les opérations aléatoires passent par le RNG injecté du moteur.
    **Validation :** recherche statique + tests démontrent l'absence d'autre source.
    **Priorité : P0.**

42. **Tester le replay des 39 jeux :**
    **Problème :** une modification générique peut provoquer une régression lointaine.
    **À corriger :** campagne déterministe automatique sur tout le catalogue.
    **Validation :** les scénarios de référence des 39 jeux passent en CI.
    **Priorité : P0.**

43. **Tester plusieurs seeds par famille de jeu :**
    **Problème :** un unique replay couvre mal les branches aléatoires.
    **À corriger :** sélectionner un ensemble raisonnable de seeds reproductibles.
    **Validation :** les principales branches de gameplay sont traversées.
    **Priorité : P1.**

44. **Ajouter des property-based tests aux primitives critiques :**
    **Problème :** les tests écrits manuellement ne couvrent pas toutes les combinaisons.
    **À corriger :** générer états et séquences pour movement, resources, cards, inventory, ownership, effects et RNG.
    **Validation :** les invariants restent vrais pour un grand
