# Verification of point 133

`UserId`, `RoomId`, `GameId`, and `MessageId` are now nominal TypeScript
types. Their constructors validate transport and persistence boundaries, and
room/presence projections use those constructors before returning typed data.
This prevents accidental interchange of user and room identifiers while
leaving primitive serialization unchanged.

Verification: identifier unit tests and TypeScript compilation.
