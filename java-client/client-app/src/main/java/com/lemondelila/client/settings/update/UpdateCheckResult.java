package com.lemondelila.client.settings.update;

public record UpdateCheckResult(
        String currentVersion,
        String remoteVersion,
        String downloadUrl,
        String notes,
        boolean updateAvailable,
        String checksum,
        String minSupportedVersion,
        String signatureUrl,
        String signature,
        java.util.List<ChangelogEntry> changelog
) {

    public UpdateCheckResult {
        if (checksum != null && checksum.isBlank()) {
            checksum = null;
        }
        if (minSupportedVersion != null && minSupportedVersion.isBlank()) {
            minSupportedVersion = null;
        }
        if (signatureUrl != null && signatureUrl.isBlank()) {
            signatureUrl = null;
        }
        if (signature != null && signature.isBlank()) {
            signature = null;
        }
        if (changelog == null) {
            changelog = java.util.List.of();
        }
    }
}
