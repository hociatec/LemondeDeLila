package com.lemondelila.client.user.events;

public record LoginRequested(String username, char[] password, boolean rememberMe) {
}

