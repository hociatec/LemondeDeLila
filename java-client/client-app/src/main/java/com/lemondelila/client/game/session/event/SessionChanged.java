package com.lemondelila.client.game.session.event;

import java.util.Optional;

public record SessionChanged(Optional<String> username, String status) {
}
