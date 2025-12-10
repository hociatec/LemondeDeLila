package com.lemondelila.client.admin.dto;

public record AdminBanRequest(
        String reason,
        int durationDays,
        String bannedUntil // ISO-8601 ou null
) {
}
