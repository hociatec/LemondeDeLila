package com.lemondelila.framework.access.game;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Utilitaire pour centraliser l'historique d'un jeu et générer des
 * représentations lisibles (texte complet ou derniers évènements).
 */
public final class GameHistoryTracker {

    private final List<String> entries = new ArrayList<>();
    private int maxEntries = 200;

    public void setMaxEntries(int maxEntries) {
        if (maxEntries <= 0) {
            throw new IllegalArgumentException("maxEntries doit être positif");
        }
        this.maxEntries = maxEntries;
        trim();
    }

    public int maxEntries() {
        return maxEntries;
    }

    public void clear() {
        entries.clear();
    }

    public int size() {
        return entries.size();
    }

    public void add(String entry) {
        if (entry == null) {
            return;
        }
        String trimmed = entry.trim();
        if (trimmed.isEmpty()) {
            return;
        }
        entries.add(trimmed);
        trim();
    }

    public void addAll(List<String> newEntries) {
        if (newEntries == null) {
            return;
        }
        newEntries.forEach(this::add);
    }

    public void setEntries(List<String> newEntries) {
        clear();
        addAll(newEntries);
    }

    public List<String> latest(int limit) {
        if (limit <= 0 || entries.isEmpty()) {
            return List.of();
        }
        int start = Math.max(entries.size() - limit, 0);
        return Collections.unmodifiableList(entries.subList(start, entries.size()));
    }

    public String formatLatest(int limit) {
        if (limit <= 0) {
            return "";
        }
        return formatEntries(latest(limit));
    }

    public String formatAll() {
        return formatEntries(entries);
    }

    private static String formatEntries(List<String> values) {
        if (values.isEmpty()) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        for (String value : values) {
            builder.append("• ").append(value).append(System.lineSeparator());
        }
        return builder.toString().strip();
    }

    private void trim() {
        int excess = entries.size() - maxEntries;
        if (excess <= 0) {
            return;
        }
        entries.subList(0, excess).clear();
    }
}
