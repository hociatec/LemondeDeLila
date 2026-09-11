# Bornes des délais et choix — 9 septembre 2026

Correction complémentaire des points 559–560. Ils restent ouverts : cette série
ne couvre pas encore toutes les opérations numériques du backend.

Les délais des timers, des phases et des choix doivent être des nombres entiers
positifs ou nuls, bornés à 8 640 000 000 000 000 ms. Les échéances sont des
timestamps entiers signés dans la plage représentable par JavaScript Date.
L'addition vérifie son résultat avant toute publication ou écriture d'état.
Les restaurations de timers vérifient la même plage. Une échéance passée reste
valide ; une durée négative, non finie ou fractionnaire est refusée.

Auparavant, Math.max(0, afterMs) transformait notamment -Infinity en zéro.
Les bornes et pas des choix numériques sont maintenant des entiers sûrs ;
l'intervalle et le nombre de valeurs calculées sont vérifiés avant allocation.
Les sélections multiples refusent les cardinalités négatives, fractionnaires,
inversées ou supérieures au nombre d'options.

Cette correction durcit les valeurs invalides acceptées auparavant. Elle ne
migre pas automatiquement des snapshots contenant de telles valeurs.

Validation ciblée : cinq suites / 50 tests réussis, typage complet et contrôle
structurel sans nouvelle dette. Tests de refus sans mutation, de préservation
d'un timer existant, d'absence d'événement sur erreur, de bornes exactes et de
restauration. Suite globale : **248 suites / 1 075 tests réussis**, lint et
build/AppModule réussis. Validation avec la série d'horloges suivante :
**251 suites / 1 096 tests réussis**, quality:check, verify:dist et contrôle du
diff réussis.

Journaux : logs/corrections-deadline-{targeted,typecheck,structural,all-tests}.log.
