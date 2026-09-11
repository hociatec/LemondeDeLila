# Verification of point 152

`SocialInteractionsService` was a pass-through facade with no policy of its
own. The WebSocket handlers now depend directly on the two services that own
the relationship and profile responsibilities, and the redundant provider,
export, and class were removed.

Verification: TypeScript build and the social/stats presentation tests.
