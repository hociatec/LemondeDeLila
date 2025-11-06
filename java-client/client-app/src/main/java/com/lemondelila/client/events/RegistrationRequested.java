package com.lemondelila.client.events;

public record RegistrationRequested(String username, char[] password, String email) {
}
