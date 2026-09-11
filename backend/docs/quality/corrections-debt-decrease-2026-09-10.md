# Correction du point 726 — diminution des exceptions

Le contrôle structurel compare les dettes explicites à sa baseline : une
nouvelle dette ou une augmentation est refusée, tandis qu’une réduction est
autorisée. Le passage courant rapporte zéro dette structurelle et
`structural-quality-check.spec.cjs` teste séparément le refus d’une hausse et
l’acceptation d’une baisse.

Cette règle est exécutée par `quality:check`, ce qui empêche une étape de
migration d’augmenter silencieusement le stock d’exceptions.
