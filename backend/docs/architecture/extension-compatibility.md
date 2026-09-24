# Extension compatibility

An extension has no independently negotiated semantic version. Its behavior is
part of every consuming game's `definitionVersion` (runtime `rulesVersion`).
A semantic change to a codec, compiler, action, handler, setup or victory must
increment that version for **all** affected definitions. Cosmetic text changes
only require the content release policy; changed JSON also changes its digest.
An unchanged JSON digest does not prove an unchanged TypeScript implementation.

Old sessions must keep the matching deployed implementation, or be explicitly
migrated with a reviewed deterministic snapshot migration and replay evidence.
Updating a version label does not migrate a session. Never remove the runtime's
rules/content/algorithm compatibility checks to make an old session load.
Regression coverage: `json-version-policy.spec.ts`, snapshot migration tests and
the immutable historical content-release checks.

Extension identifiers (`documentKey`, `outputKey`, `victoryKind`) are stable API.
Renaming one is a breaking change and requires the same consumer/version review.
New business configuration belongs under `extensions`, never in the root DSL.
Before adding grammar, document why existing components, effects, conditions or
patterns cannot express it; aliases and cosmetic synonyms do not justify a new
primitive. Grammar and public declaration snapshots require an explicit review.

JSON extensions use `Record<string, never>` for authored state deliberately:
their persistent data lives in the engine's typed capability controllers. A
generic custom-state parameter would require existential state erasure when
combining independently parsed packs; it would introduce assertions rather
than remove them. Keep this constraint until a concrete consumer demonstrates
a sound composition with fewer casts. TypeScript and the real hybrid compiler
test verify the existing state-neutral composition.

The author facade is API 9.0.0 with the same explicit exported symbols.
`ctx.turn.flags.get<T>(key)` is replaced by `get(key): unknown`: the former
signature asserted any caller-selected type over unvalidated persisted data.
Consumers must narrow scalar flags or parse structured flags with `gameInput`
before using them. The board, event-race and story-challenge consumers now parse
their respective player/deck and draw-queue shapes. Existing valid saves keep
the same representation; malformed structured flags fail before use.
Moving generic errors into runtime contracts preserves their single class
identity and their public exports. The extension API and its type-only contract
facade are new 1.0.0 surfaces, including declared capabilities. Exact declaration
snapshots cover all four entry points. Any removal, rename or incompatible
signature change requires a major version and documented migration before
refreshing those snapshots.

Multiple extensions may contribute disjoint handlers. Duplicate handler owners
and action recipe identifiers are authoring errors, independent of catalogue
order. Setup has at most one owner. `victory.kind` explicitly selects the sole
winning extension; other victory providers must opt out of coupled victory with
`victoryRequired: false`. Implicit composition of lifecycle hooks or victory
conditions is intentionally rejected; authors must express it in one reviewed
composite provider. Optional view fields reflect the enabled subset of packs.
