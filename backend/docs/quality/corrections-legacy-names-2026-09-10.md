# Correction du point 730 — noms hérités inutiles

Les trois services admin concernés ne déclarent plus les paramètres variadiques
`_legacyDependencies`, qui n’étaient ni lus ni injectés et conservaient un
chemin d’API hérité sans utilité. Les constructeurs portent désormais seulement
leur port applicatif réel.

Les répertoires `dto`, `entities`, `services` et `ws` restent des frontières
techniques actuelles et ne sont pas renommés artificiellement.

Validation : tests admin ciblés, typecheck, audit structurel et backlog.
