package com.lemondelila.client.settings.update;

public record UpdateCheckResult(
        String currentVersion,
        String remoteVersion,
        String downloadUrl,
        String notes,
        boolean updateAvailable
) {
}
