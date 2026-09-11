# Graphe des phases

Chaque définition compilée contient un graphe explicite de phases. `transitions`
énumère les sorties manuelles ; `next` déclare aussi une sortie, utilisable par
la transition automatique. Le compilateur refuse les destinations inconnues,
les phases inaccessibles depuis `initialPhase`, les phases sans sortie et les
phases terminales possédant une sortie. Une boucle sur soi-même ne constitue
pas une sortie.

```ts
const phases = defineGamePhases<State>()({
  initialPhase: 'setup',
  phases: {
    setup: { transitions: ['playing'] },
    playing: { terminal: true },
  },
});
```

`terminal: true` signifie dernière phase du graphe de phases. Cela n'arrête pas
automatiquement la partie et n'interdit pas les actions de cette phase. Le cycle
de vie de la partie reste distinct : victoire, abandon ou `ctx.match.finish()`
terminent la partie. Les jeux sans phases particulières reçoivent la phase
terminale `playing` du compilateur. `setupPlayingPhases()` déclare le graphe de
l'exemple. Un jeu à manches peut posséder un graphe cyclique sans phase terminale.

Le runtime contrôle également chaque appel à `ctx.transitionTo()` : seule une
sortie déclarée est autorisée, avant les hooks de sortie, l'annulation de timer,
la modification de l'état et l'émission d'événement. Demander la phase courante
reste une opération sans effet.

Les graphes spécifiques sont déclarés auprès des règles de LAMA, Foulées
fantastiques, Les Absurdissimes, Zig et Zag et Gérard président. Taxi express et
Ça dérape déclarent leur phase unique terminale. Les autres jeux utilisent la
composition générique ou le défaut du compilateur.

Ces métadonnées ne changent ni les identifiants de phases persistés, ni le format
des sessions. Le contrôle vise les transitions non déclarées ; les parcours
existants sont couverts par les tests des 38 jeux. Une sortie ajoutée par une
nouvelle règle doit être déclarée dans son graphe lors de la même modification.
