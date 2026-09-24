J’ai réanalysé la version corrigée. Il y a **une amélioration architecturale importante** par rapport à la version précédente : les anciens packs spécialisés ont été déplacés vers `game/rules/game-specific/`, ils sont maintenant explicitement marqués `scope: 'game-specific'`, le registre est généré, et le contrat `JsonEffectPackScope` distingue désormais `game-specific`, `reusable` et `engine-primitive`. C’est exactement la direction qu’il fallait prendre.

Je ne considère cependant pas encore l’audit comme « 100 % fermé ». Voici les points restants, sous la forme demandée.

### Architecture et généricité

**1. Séparation des règles spécifiques :**
**Problème :** ce problème majeur de l’audit précédent est maintenant largement corrigé. Les 38 mécanismes spécialisés ne prétendent plus être génériques et sont rangés dans `game/rules/game-specific/`.
**À corriger :** rien de structurel immédiatement. Conserver strictement cette règle pour les prochains jeux et empêcher qu’un développeur remette arbitrairement `scope: 'reusable'`.
**Pourquoi :** c’était la principale source de « fausse généricité » de la première version.
**Priorité : CORRIGÉ / À PROTÉGER.**

**2. Promotion `game-specific → reusable` :**
**Problème :** le type prévoit correctement `reusable`, mais cette promotion devient maintenant un acte architectural sensible.
**À corriger :** automatiser le contrôle suivant : un pack `reusable` doit fournir une preuve de réutilisation par plusieurs jeux mécaniquement différents ou une ADR explicitement acceptée. Le test doit échouer si quelqu’un change simplement `scope: 'game-specific'` en `scope: 'reusable'`.
**Pourquoi :** sinon la dette de la première version peut revenir progressivement.
**Priorité : P0.**

**3. Promotion `reusable → engine-primitive` :**
**Problème :** `engine-primitive` existe dans `JsonEffectPackScope`, mais le seuil permettant à quelque chose de devenir une primitive moteur doit rester extrêmement strict.
**À corriger :** exiger qu’une primitive ne dépende d’aucun vocabulaire métier d’un jeu, qu’elle soit utilisable indépendamment et qu’elle possède des tests de composition orthogonale.
**Pourquoi :** le runtime doit rester plus petit et plus stable que le catalogue de jeux.
**Priorité : P0.**

**4. Dépendance des recipes génériques vers `game-specific` :**
**Problème :** j’ai encore trouvé `game/rules/recipes/board-landings.ts`, `board-choices.ts` et `board-effect-bindings.ts` qui importent des types depuis `../game-specific/board-movement-landings/program`. La couche supposée plus générique dépend donc encore d’une couche spécifique.
**À corriger :** extraire les contrats nécessaires (`BoardLanding`, bindings, choices, etc.) dans une couche contractuelle neutre, puis faire dépendre les deux côtés de ce contrat.
**Pourquoi :** une dépendance `recipes → game-specific` inverse la direction architecturale souhaitée.
**Priorité : P0.**

**5. Contrats spécifiques importés directement depuis `engine/runtime` :**
**Problème :** les modules `game-specific` importent beaucoup de fichiers internes comme `effects-core`, `action-builders`, `component-kit`, `json-author-schema`, etc.
**À corriger :** déterminer lesquels constituent une API d’extension officielle et les exposer via une façade dédiée, par exemple `engine/sdk/extension-api`, au lieu de laisser les packs connaître l’arborescence interne du runtime.
**Pourquoi :** sinon un refactoring interne du runtime peut casser simultanément les 38 packs.
**Priorité : P1.**

**6. API d’extension distincte de l’API auteur :**
**Problème :** `engine/sdk/public-api.ts` représente correctement l’API auteur, mais les développeurs de packs ont besoin de beaucoup plus de capacités internes. Les deux usages sont différents.
**À corriger :** créer explicitement deux contrats : `author-api` pour composer un jeu et `extension-api` pour développer une extension revue du moteur.
**Pourquoi :** cela permet de modifier les internals sans casser le catalogue.
**Priorité : P1.**

**7. Registre des effect-packs :**
**Problème :** le problème précédent du registre manuel est corrigé : `json-effect-pack-registry.ts` indique maintenant qu’il est généré. Cependant le générateur n’est pas présent dans l’archive fournie.
**À corriger :** vérifier dans le dépôt complet que `commands/generate-effect-pack-registry.cjs` est versionné, testé et exécuté par CI avec un test « generated file is up-to-date ».
**Pourquoi :** un fichier généré sans vérification CI peut diverger de sa source.
**Priorité : P1.**

**8. Catalogue des 38 règles spécifiques :**
**Problème :** avoir 38 règles spécifiques n’est maintenant plus un défaut architectural en soi. Le risque restant est de créer systématiquement une 39e, 40e, 41e règle pour chaque nouveau jeu.
**À corriger :** mesurer en CI le ratio `nouveaux jeux / nouveaux game-specific packs` et signaler une dérive.
**Pourquoi :** le vrai test de généricité commence maintenant avec les prochains jeux.
**Priorité : P1.**

### DSL JSON

**9. `extensions` est maintenant une bonne frontière :**
**Problème :** l’ancienne pollution potentielle du document racine a été corrigée : les jeux utilisent maintenant une propriété `extensions`.
**À corriger :** interdire définitivement l’introduction de nouvelles clés métier directement à la racine de `game.json`.
**Pourquoi :** le schéma central doit rester stable lorsque le nombre de jeux augmente.
**Priorité : CORRIGÉ / À PROTÉGER.**

**10. Namespacing des extensions :**
**Problème :** chaque pack possède encore un `documentKey` simple comme `propertyEconomy`. Cela fonctionne avec 38 packs, mais les collisions deviennent possibles lorsque le catalogue grandit.
**À corriger :** envisager des IDs stables/namespacés pour les extensions ou au minimum garantir globalement l’unicité de `documentKey`, `outputKey` et `victoryKind`.
**Pourquoi :** le registre devient une plateforme d’extensions. Les identifiants deviennent donc une API.
**Priorité : P1.**

**11. Version des extensions :**
**Problème :** les jeux ont `schemaVersion`, `contentVersion` et `definitionVersion`, mais un pack spécifique peut lui-même évoluer sémantiquement.
**À corriger :** introduire si nécessaire une stratégie de version/migration des extensions, ou documenter explicitement que leur version est obligatoirement liée à `definitionVersion`.
**Pourquoi :** modifier `propertyEconomy` ne doit pas silencieusement modifier la sémantique d’une ancienne sauvegarde/définition.
**Priorité : P1.**

**12. Taille du langage central :**
**Problème :** le core JSON reste assez riche : `patterns`, `components`, `setup`, `resourceIds`, `shortcuts`, `phases`, `actions`, `victory`, `extensions`, migrations, etc.
**À corriger :** continuer à refuser les synonymes et les concepts qui peuvent être exprimés par composition des primitives existantes.
**Pourquoi :** un DSL accumule facilement de la dette syntaxique irréversible.
**Priorité : P2.**

### Effect-pack contract

**13. `defineJsonEffectPack()` a été nettement amélioré :**
**Problème :** l’ancien problème `unknown → cast TypeScript` est largement corrigé grâce à `createAuthorCodec<Program>()` et `codec.parse()`.
**À corriger :** conserver ce principe partout : toute valeur `unknown` doit franchir un codec avant d’atteindre la logique métier.
**Pourquoi :** c’est une vraie amélioration de la sûreté de la frontière JSON.
**Priorité : CORRIGÉ / À PROTÉGER.**

**14. `JsonState = Record<string, never>` :**
**Problème :** le contrat générique des effect-packs gomme volontairement l’état spécifique avec `Record<string, never>`. Cela simplifie la composition mais peut également masquerquer certaines incompatibilités de types.
**À corriger :** vérifier si les contributions peuvent être paramétrées par un état minimal structurel plutôt que neutralisées systématiquement. Ne le changer que si cela permet réellement de supprimer des casts ailleurs.
**Pourquoi :** le système de types doit vérifier les compositions, pas seulement accepter leur assemblage.
**Priorité : P2.**

**15. Contrat `handlers` très large :**
**Problème :** un pack peut contribuer simultanément `setup`, `choices`, `effects`, `automatic`, `lifecycle`, `victory`, `viewExtension`, `config`, `initialization`, `resourceIds`, visibilité et bot.
**À corriger :** envisager des capacités déclarées (`capabilities`) et vérifier qu’un pack n’implémente que celles annoncées.
**Pourquoi :** cela facilite l’analyse des interactions entre extensions et évite les packs omnipotents.
**Priorité : P2.**

**16. Ownership du setup :**
**Problème :** `ownsSetup?: boolean` montre qu’il existe potentiellement des conflits de responsabilité entre extensions.
**À corriger :** remplacer autant que possible les booléens d’ownership implicites par un système de contributions composables ou une validation stricte d’unicité.
**Pourquoi :** deux extensions revendiquant la même étape du lifecycle peuvent produire des interactions difficiles à raisonner.
**Priorité : P1.**

**17. Ownership de la victoire :**
**Problème :** `victoryKind`, `victoryRequired` et `victoryLabel` restent attachés directement au pack.
**À corriger :** vérifier que plusieurs extensions peuvent coexister sans compétition implicite pour la condition de victoire. La composition des conditions de victoire devrait être explicite.
**Pourquoi :** les futurs jeux hybrides seront précisément ceux qui testeront la généricité.
**Priorité : P1.**

### Taille et complexité

**18. Gros fichiers du runtime :**
**Problème :** plusieurs fichiers de production restent volumineux : `game-ws-state-messages.presenter.ts` ~14,5 KB, `quiz-kit.ts` ~14 KB, `cards-hands-controller.ts` ~14 KB, `pawn-kit.ts` ~14 KB, `declarative-game-queries.ts` ~14 KB, `game-rule-context.ts` ~13 KB, etc. Ce n’est pas automatiquement mauvais, mais ce sont les principaux candidats à la concentration de responsabilités.
**À corriger :** examiner leur complexité cyclomatique et leur nombre de responsabilités avant de les découper. Ne pas découper uniquement pour réduire le nombre de lignes.
**Pourquoi :** la dette importante est la complexité logique, pas la longueur brute.
**Priorité : P2.**

**19. Gros fichiers game-specific :**
**Problème :** certaines recipes spécialisées restent conséquentes, notamment `discard-penalty-cards.recipes.ts`, `directional-hazard-effects.ts`, `simultaneous-quiz.recipes.ts`, `battle-ties.recipes.ts`, `property-economy.recipes.ts`.
**À corriger :** découper seulement les sous-comportements possédant des invariants indépendants et réutiliser les primitives génériques quand elles existent.
**Pourquoi :** un pack spécifique peut être complexe ; il ne doit simplement pas devenir un second runtime.
**Priorité : P2.**

**20. Nombre de casts TypeScript :**
**Problème :** l’analyse statique trouve encore un nombre non négligeable d’utilisations liées à `unknown` dans le projet. Toutes ne sont pas mauvaises, particulièrement aux frontières JSON.
**À corriger :** classifier les casts restants : frontière validée = acceptable ; cast servant à contourner le compilateur dans le domaine/runtime = à supprimer. Ajouter éventuellement une règle ESLint ciblée.
**Pourquoi :** `unknown` est utile à l’entrée du système mais ne doit pas contaminer le cœur métier.
**Priorité : P2.**

**21. `throw new Error()` encore présent :**
**Problème :** l'analyse brute retrouve de nombreux `throw new Error`. Une partie est certainement dans les tests ou les invariants internes, mais les erreurs d'authoring ne doivent pas en dépendre.
**À corriger :** auditer uniquement les chemins atteignables par `game.json` et imposer `authoringFailure`/erreur typée avec chemin sémantique. Garder `Error` pour les invariants véritablement internes si approprié.
**Pourquoi :** un auteur de jeu doit savoir exactement quelle propriété corriger.
**Priorité : P1.**

### Tests

**22. Volume de tests :**
**Problème :** la version contient environ **471 fichiers de tests**, contre environ 440 précédemment. La couverture architecturale visible est franchement importante. Le problème devient désormais la qualité des invariants plutôt que la quantité de tests.
**À corriger :** éviter d’augmenter le nombre de tests uniquement pour augmenter la couverture ; privilégier les invariants, property tests, replay et tests de frontières.
**Pourquoi :** une énorme suite de tests trop couplée à l’implémentation devient elle-même une dette.
**Priorité : P2.**

**23. Tests de second jeu :**
**Problème :** la présence de `second-game-catalogue.spec.ts` est une excellente correction, mais un seul scénario artificiel ne peut pas définitivement prouver la généricité.
**À corriger :** chaque fois qu’une capacité passe `game-specific → reusable`, ajouter au minimum deux consommateurs réellement différents et un test démontrant leur indépendance.
**Pourquoi :** c’est la meilleure protection contre les abstractions artificiellement génériques.
**Priorité : P0.**

**24. Tests de capacités orthogonales :**
**Problème :** `orthogonal-capabilities.spec.ts` et `independent-capabilities.spec.ts` montrent que ce travail a commencé.
**À corriger :** généraliser cette approche aux primitives critiques : mouvement + coût, protection + collision, cartes + inventaire, choix + scoring, ownership + échange, etc.
**Pourquoi :** la généricité se démontre surtout en recombinant les capacités de façons imprévues.
**Priorité : P1.**

**25. Property-based testing :**
**Problème :** j’ai identifié `generated-actions.property.spec.ts`, donc cette dette a commencé à être traitée. Elle n’est cependant pas encore visiblement généralisée aux invariants les plus critiques.
**À corriger :** appliquer cette stratégie au mouvement, inventaire, cartes, ownership, grid, replay et transitions de phase.
**Pourquoi :** ce sont précisément les systèmes où les combinaisons d’états explosent.
**Priorité : P1.**

**26. Replay déterministe :**
**Problème :** les tests `replay-*`, `serialized-key-order`, stabilité et migrations montrent une très bonne direction.
**À corriger :** conserver en CI un corpus de parties déterministes de référence couvrant chaque grande famille de jeu.
**Pourquoi :** une modification du runtime pourra alors être détectée même lorsque tous les tests unitaires continuent de passer.
**Priorité : P1.**

### API et compatibilité

**27. SDK explicitement exporté :**
**Problème :** `engine/sdk/public-api.ts` utilise maintenant une liste explicite d’exports et porte même la mention de contrat V8. C’est une bonne pratique.
**À corriger :** ajouter ou conserver un snapshot exact des symboles publics et traiter leur suppression/renommage comme un breaking change.
**Pourquoi :** une façade stable est indispensable à un moteur réutilisable.
**Priorité : P1.**

**28. SDK dépend du `core` pour les erreurs :**
**Problème :** le SDK réexporte `rejectContent` et `rejectRule` depuis `../../core/domain/errors/game-domain.errors`. Cela crée une dépendance conceptuelle `engine/sdk → core`, alors que `MODULES.md` présente plutôt le moteur comme une couche indépendante.
**À corriger :** déplacer les erreurs appartenant véritablement au contrat moteur dans `engine/runtime/contracts` ou un package contractuel neutre. Le `core` applicatif pourra ensuite les consommer.
**Pourquoi :** le moteur ne devrait pas dépendre de l’application qui l’héberge.
**Priorité : P0.**

**29. Tests du runtime dépendant de `rules/public-api` :**
**Problème :** de nombreux tests situés sous `engine/runtime/definitions` importent `compileJsonGame` depuis `rules/public-api`. Le code de production runtime ne semble pas faire cette dépendance, mais les tests du runtime connaissent la couche supérieure.
**À corriger :** déplacer les tests d’intégration JSON+rules dans `engine/testing` ou `game/testing`, et conserver dans `runtime` uniquement les tests pouvant fonctionner avec le runtime seul.
**Pourquoi :** la localisation des tests doit refléter la frontière architecturale ; sinon les dépendances inversées deviennent progressivement acceptables.
**Priorité : P1.**

**30. Indépendance réelle du moteur :**
**Problème :** la structure indique maintenant beaucoup plus clairement que `engine/runtime` est le moteur et que `rules/game-specific`
