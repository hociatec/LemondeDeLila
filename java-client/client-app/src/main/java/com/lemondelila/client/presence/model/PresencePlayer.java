package com.lemondelila.client.presence.model;

import java.util.List;

public record PresencePlayer(int id, String username, List<PresenceChat> rooms) {
}


