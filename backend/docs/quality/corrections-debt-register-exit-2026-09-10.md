# Correction du point 725 — critères de sortie des dettes

Le registre des dettes ouvertes est explicitement transitoire. Chaque entrée
porte désormais le critère de sortie commun : preuve documentée puis retrait
de l’identifiant de `corriger.txt`. Le contrôle `backlog:governance` refuse une
entrée sans ce critère ou avec un état permanent non prévu par le contrat.

Le registre ne peut donc pas servir à normaliser silencieusement une dette
permanente : une dette reste ouverte uniquement en attendant sa preuve de
sortie, et son retrait est contrôlé par `backlog:check`.
