# Preuve du point 539

Le tri textuel est centralisé dans `compareCanonicalText`, qui normalise en
`NFKC` et compare les chaînes sans dépendre de la locale de l’hôte. Les
projections catalogues, statistiques et lobby l’utilisent désormais ; les
statistiques ajoutent `gameType` comme clé secondaire pour éviter les égalités
instables. Un test vérifie l’ordre et l’égalité des formes Unicode normalisées.
