# App boundary layout

Application-level wiring modules and adapters live under
`src/app/boundaries`. The `src` root now keeps only actual entry points and
shared composition files; domain code remains under `modules`, `game`,
`platform`, or `shared`.
