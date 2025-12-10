package com.lemondelila.client.admin.dto;

import java.util.List;

public record AdminUserPage(List<AdminUser> items, int total, int page, int limit) {
}
