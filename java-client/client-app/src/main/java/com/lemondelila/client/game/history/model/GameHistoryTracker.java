package com.lemondelila.client.game.history.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Centralise l'historique d'un jeu et gère des représentations lisibles.
 */
public final class GameHistoryTracker {

    private final List<String> entries = new ArrayList<>();
    private final List<Object> structured = new ArrayList<>();
    private int maxEntries = 200;

    public void setMaxEntries(int maxEntries) {
        if (maxEntries <= 0) {
            throw new IllegalArgumentException("maxEntries doit etre positif");
        }
        this.maxEntries = maxEntries;
        trim();
    }

    public int maxEntries() {
        return maxEntries;
    }

    public void clear() {
        entries.clear();
        structured.clear();
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

    public void addStructured(Object entry) {
        if (entry == null) {
            return;
        }
        structured.add(entry);
    }

    public void addAll(List<String> newEntries) {
        if (newEntries == null) {
            return;
        }
        newEntries.forEach(this::add);
    }

    public List<String> all() {
        return Collections.unmodifiableList(entries);
    }

    public List<Object> structuredAll() {
        return Collections.unmodifiableList(structured);
    }

    public String formatAll() {
        return String.join("\n", entries);
    }

    public String formatTail(int count) {
        if (count <= 0 || entries.isEmpty()) {
            return "";
        }
        int start = Math.max(0, entries.size() - count);
        List<String> slice = entries.subList(start, entries.size());
        return String.join("\n", slice);
    }

    private void trim() {
        int excess = entries.size() - maxEntries;
        if (excess <= 0) {
            return;
        }
        entries.subList(0, excess).clear();
    }
}
