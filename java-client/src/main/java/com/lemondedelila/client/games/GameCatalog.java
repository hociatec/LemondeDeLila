package com.lemondedelila.client.games;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondedelila.client.mvc.model.GameMetadata;

import java.io.IOException;
import java.io.InputStream;
import java.util.Collection;
import java.util.Collections;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

public class GameCatalog {
    private final Map<String, GameFactory> registry = new ConcurrentHashMap<>();
    private final ObjectMapper mapper = new ObjectMapper();

    public GameCatalog() {
        loadFromResources();
    }

    public void register(GameFactory factory) { registry.put(factory.getId(), factory); }

    public Collection<GameMetadata> list() {
        return registry.values().stream().map(GameFactory::getMetadata).collect(Collectors.toList());
    }

    public Optional<GameFactory> getFactory(String id) { return Optional.ofNullable(registry.get(id)); }

    private void loadFromResources() {
        try (InputStream in = getClass().getResourceAsStream("/games.json")) {
            if (in == null) return;
            var list = mapper.readValue(in, new TypeReference<java.util.List<java.util.Map<String,String>>>(){});
            for (var m : list) {
                String id = m.get("id");
                String name = m.getOrDefault("name", id);
                String description = m.getOrDefault("description", "");
                // Register a simple factory placeholder so that metadata shows up; real game should register programmatically
                register(new GameFactory() {
                    @Override public String getId() { return id; }
                    @Override public GameMetadata getMetadata() { return new GameMetadata(id, name, description); }
                    @Override public com.lemondedelila.client.mvc.controller.GameController create(com.lemondedelila.client.GameContext ctx) { throw new UnsupportedOperationException("Factory placeholder for " + id); }
                });
            }
        } catch (IOException e) {
            // ignore
        }
    }
}
