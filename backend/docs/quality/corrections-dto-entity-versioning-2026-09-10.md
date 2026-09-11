# Preuve du point 534

Les DTO externes sont définis dans les dossiers de présentation et ne sont
pas les entités TypeORM. Les repositories TypeORM convertissent leurs lignes
via des mappers (`toRecord`, `toModel`) avant de franchir les ports
d’application. L’audit d’architecture interdit les dépendances de stockage
dans les contrats et services applicatifs ; le typecheck valide tous les
mappings actuels. Les DTO et entités peuvent donc évoluer indépendamment.
