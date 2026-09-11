# Redeploiement et parties en cours

## Point traité

Le point 632 interdit qu'un simple redémarrage du serveur change silencieusement
le comportement d'une partie en cours.

## Garantie

L'état persisté porte les versions de schéma, contenu, règles et algorithme.
`loadDeclarativeState` les compare avant la reprise et refuse toute combinaison
incompatible ; le redémarrage ne remplace donc pas une version de règles par la
version courante en cours d'exécution. Une évolution incompatible doit passer
par la politique de migration documentée et les migrations testées.

## Vérification

`game-state-loader.spec.ts` couvre les refus de versions incompatibles et
`npm run typecheck -- --pretty false` valide le contrat propagé.
