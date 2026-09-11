# Verification of point 120

WX upload completion now requires `RedisDistributedLeaseService` through the constructor. Production Redis configuration fails closed when unavailable, and completion checks the lease before and after publication. The `.complete.lock` file remains only a local same-filesystem guard and is never the distributed coordination mechanism.

Verification: `wx-update-upload.service.spec.ts`, `update.module.ts` importing `RedisModule`, and the production behavior of `RedisDistributedLeaseService`.
