# Verification of points 10 to 13

All 32 model/record definitions previously mixed into module
`application/contracts` now live canonically in responsibility-oriented
`application/models` or `application/read-models` directories. Inputs live in
`application/inputs`; old contract paths are compatibility re-exports only.

Verification: `npm run application:contracts:audit`, TypeScript build, layout
audit, and messaging tests.
