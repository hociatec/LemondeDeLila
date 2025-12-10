package com.lemondelila.client.admin.dto;

import java.util.List;

public record AdminUserUpdateRequest(
        String email,
        String username,
        String password,
        List<String> roles,
        Boolean emailVerified
) {
}
