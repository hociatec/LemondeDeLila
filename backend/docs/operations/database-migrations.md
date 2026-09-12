# Migrations de base de données

Les migrations MySQL s'exécutent sans transaction englobante. MySQL valide de
toute façon les changements DDL implicitement ; une transaction autour d'une
reprise de données prolongerait les verrous et ne garantirait pas son rollback.

Toute nouvelle migration qui parcourt une table existante doit respecter ces
règles :

- parcourir les lignes par lots bornés et dans un ordre stable fondé sur la clé
  primaire ;
- rendre chaque lot rejouable, sans supposer que le lot précédent appartient à
  la même transaction ;
- borner également les collections JSON ou enfants traitées pour une ligne ;
- créer les index et modifier les colonnes dans une étape séparée de la reprise
  de données ;
- vérifier les doublons et les préconditions avant d'ajouter une contrainte ;
- mesurer la durée et les verrous sur une copie représentative avant le
  déploiement ;
- arrêter le déploiement si une opération ne peut pas être rejouée après une
  interruption.

Les migrations publiées sont couvertes par le registre de sommes SHA-256 et ne
doivent pas être réécrites. Une correction ultérieure se fait dans une nouvelle
migration compensatoire. La migration de timeline existante borne ses lectures à
250 sessions et chaque timeline à 100 000 éléments.
