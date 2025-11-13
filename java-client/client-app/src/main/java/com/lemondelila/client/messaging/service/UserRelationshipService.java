package com.lemondelila.client.messaging.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.locks.ReentrantReadWriteLock;

public final class UserRelationshipService {

    private static final Path STORAGE = Path.of("config", "relationships.json");

    private final ObjectMapper mapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    private final Map<Integer, Relationship> friends = new LinkedHashMap<>();
    private final Map<Integer, Relationship> blocked = new LinkedHashMap<>();

    public UserRelationshipService() {
        load();
    }

    public boolean isFriend(int userId) {
        lock.readLock().lock();
        try {
            return friends.containsKey(userId);
        } finally {
            lock.readLock().unlock();
        }
    }

    public boolean isBlocked(int userId) {
        lock.readLock().lock();
        try {
            return blocked.containsKey(userId);
        } finally {
            lock.readLock().unlock();
        }
    }

    public List<Relationship> friends() {
        lock.readLock().lock();
        try {
            return List.copyOf(friends.values());
        } finally {
            lock.readLock().unlock();
        }
    }

    public List<Relationship> blocked() {
        lock.readLock().lock();
        try {
            return List.copyOf(blocked.values());
        } finally {
            lock.readLock().unlock();
        }
    }

    public void toggleFriend(int userId) {
        toggleFriend(userId, null);
    }

    public void toggleFriend(int userId, String username) {
        lock.writeLock().lock();
        try {
            if (friends.containsKey(userId)) {
                friends.remove(userId);
            } else {
                friends.put(userId, createEntry(userId, username));
                blocked.remove(userId);
            }
            save();
        } finally {
            lock.writeLock().unlock();
        }
    }

    public void toggleBlock(int userId) {
        toggleBlock(userId, null);
    }

    public void toggleBlock(int userId, String username) {
        lock.writeLock().lock();
        try {
            if (blocked.containsKey(userId)) {
                blocked.remove(userId);
            } else {
                blocked.put(userId, createEntry(userId, username));
                friends.remove(userId);
            }
            save();
        } finally {
            lock.writeLock().unlock();
        }
    }

    public void removeFriend(int userId) {
        lock.writeLock().lock();
        try {
            if (friends.remove(userId) != null) {
                save();
            }
        } finally {
            lock.writeLock().unlock();
        }
    }

    public void unblock(int userId) {
        lock.writeLock().lock();
        try {
            if (blocked.remove(userId) != null) {
                save();
            }
        } finally {
            lock.writeLock().unlock();
        }
    }

    private void load() {
        if (!Files.exists(STORAGE)) {
            return;
        }
        lock.writeLock().lock();
        try {
            JsonNode node = mapper.readTree(STORAGE.toFile());
            friends.clear();
            blocked.clear();
            readEntries(node.path("friends"), friends);
            readEntries(node.path("blocked"), blocked);
        } catch (IOException ignored) {
            friends.clear();
            blocked.clear();
        } finally {
            lock.writeLock().unlock();
        }
    }

    private void save() {
        try {
            Files.createDirectories(Objects.requireNonNull(STORAGE.getParent()));
            ObjectNode root = mapper.createObjectNode();
            root.set("friends", serializeEntries(friends));
            root.set("blocked", serializeEntries(blocked));
            mapper.writeValue(STORAGE.toFile(), root);
        } catch (IOException ignored) {
        }
    }

    private void readEntries(JsonNode node, Map<Integer, Relationship> target) {
        if (!node.isArray()) {
            return;
        }
        node.forEach(item -> {
            if (item.canConvertToInt()) {
                int id = item.asInt();
                target.put(id, new Relationship(id, null));
            } else if (item.isObject()) {
                int id = item.path("id").asInt(-1);
                if (id > 0) {
                    String username = sanitizeUsername(item.path("username").asText(null));
                    target.put(id, new Relationship(id, username));
                }
            }
        });
    }

    private ArrayNode serializeEntries(Map<Integer, Relationship> source) {
        ArrayNode array = mapper.createArrayNode();
        source.values().forEach(entry -> {
            ObjectNode node = mapper.createObjectNode()
                    .put("id", entry.id());
            if (entry.username() != null && !entry.username().isBlank()) {
                node.put("username", entry.username());
            }
            array.add(node);
        });
        return array;
    }

    private Relationship createEntry(int userId, String username) {
        return new Relationship(userId, sanitizeUsername(username));
    }

    private String sanitizeUsername(String username) {
        if (username == null) {
            return null;
        }
        String trimmed = username.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public record Relationship(int id, String username) {
    }
}
