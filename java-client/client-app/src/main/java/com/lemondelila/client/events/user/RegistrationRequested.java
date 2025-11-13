package com.lemondelila.client.events.user;

public record RegistrationRequested(String username, char[] password, String email) {
}


