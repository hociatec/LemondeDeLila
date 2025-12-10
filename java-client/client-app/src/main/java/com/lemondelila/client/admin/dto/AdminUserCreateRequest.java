package com.lemondelila.client.admin.dto;

import java.util.List;

public record AdminUserCreateRequest(
        String email,
        String username,
        String password,
        List<String> roles,
        boolean emailVerified
) {
}
