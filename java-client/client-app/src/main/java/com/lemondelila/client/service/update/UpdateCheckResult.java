package com.lemondelila.client.service.update;

public record UpdateCheckResult(
        String currentVersion,
        String remoteVersion,
        String downloadUrl,
        String notes,
        boolean updateAvailable
) {
}
