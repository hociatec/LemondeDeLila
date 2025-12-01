package com.lemondelila.client.game.session.event;

public record LoginRequested(String username, char[] password) {
}
