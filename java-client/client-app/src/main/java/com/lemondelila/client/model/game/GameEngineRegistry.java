package com.lemondelila.client.model.game;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Registre simple des moteurs de jeu clients pour centraliser la logique locale.
 */
public final class GameEngineRegistry {

    private final Map<String, GameEngine<?, ?, ?>> engines = new HashMap<>();

    public void register(GameEngine<?, ?, ?> engine) {
        engines.put(engine.type(), engine);
    }

    public Optional<GameEngine<?, ?, ?>> find(String type) {
        return Optional.ofNullable(engines.get(type));
    }

    public Map<String, GameEngine<?, ?, ?>> all() {
        return Collections.unmodifiableMap(engines);
    }
}
