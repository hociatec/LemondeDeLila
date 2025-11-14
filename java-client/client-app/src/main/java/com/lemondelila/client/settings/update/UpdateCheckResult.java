package com.lemondelila.client.settings.update;

public record UpdateCheckResult(
        String currentVersion,
        String remoteVersion,
        String downloadUrl,
        String notes,
        boolean updateAvailable,
        String checksum
) {

    public UpdateCheckResult {
        if (checksum != null && checksum.isBlank()) {
            checksum = null;
        }
    }
}
