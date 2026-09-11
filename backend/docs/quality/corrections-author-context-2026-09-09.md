# Contrat du contexte auteur — points 63, 64 et 131

Le SDK expose maintenant un contrat structurel `GameContext`, distinct de la
classe de construction interne. Les callbacks auteur utilisent ce contrat ;
les orchestrateurs du runtime conservent leurs capacités internes.

Les contrôleurs exposent leurs membres publics sans leurs champs privés ni
leur identité nominale de classe. Les ressources et compteurs spécialisés
conservent les identifiants littéraux de la définition. Le contrat des effets
limite explicitement les méthodes accessibles aux règles. La reprise des
choix, le drainage des événements, l'entrée du lifecycle, les diagnostics et
les structures sérialisées du moteur restent internes.

`game-author-context.spec.ts` contient des vérifications négatives de compilation
sur les exports de stockage, le constructeur, les méthodes d'orchestration et
les accès directs ou indexés au stockage des contrôleurs. Un contrôle positif
vérifie la compatibilité structurelle sans dépendre des champs privés des kits.
Les imports profonds et les contournements de typage restent soumis aux gardes
d'architecture existantes. Il s'agit d'une frontière du SDK TypeScript, pas
d'une isolation de sécurité de JavaScript hostile à l'exécution.

Validation : 5 suites / 59 tests ciblés, typage, lint, quality:check, build,
chargement AppModule et verify:dist réussis. Journaux sous
`logs/corrections-author-context-*.log`. Les 38 manifestes et 39 catalogues
compilés ont été vérifiés. La série générale précédente comptait 260 suites /
1 152 tests réussis ; elle précède cette modification des contrats de types.

Le verrouillage des signatures du SDK (65) et la réduction du nombre de
capacités visibles selon chaque règle (133, 135) restent à traiter.
