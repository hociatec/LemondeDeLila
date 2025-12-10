package com.lemondelila.client.admin.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AdminUser(
        int id,
        String email,
        String username,
        String avatar,
        List<String> roles,
        boolean emailVerified,
        String bannedUntil,
        String banReason,
        String createdAt,
        Map<String, Object> preferences
) {
}
