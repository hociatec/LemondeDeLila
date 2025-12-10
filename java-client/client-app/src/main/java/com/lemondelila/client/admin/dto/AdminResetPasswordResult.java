package com.lemondelila.client.admin.dto;

public record AdminResetPasswordResult(AdminUser user, String temporaryPassword) {
}
