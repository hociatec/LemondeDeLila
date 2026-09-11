# Verification of point 153

The module conventions now make the creation criteria explicit: a facade must
stabilize an API, apply policy, or coordinate capabilities; a service must own
cohesive behavior; and generic folders or layers are rejected by the layout
audit. The pass-through facade removed in this lot also demonstrates the rule
in code.

Verification: `npm run layout:audit`, `npm run backlog:governance`, and the
pass-through service review.
