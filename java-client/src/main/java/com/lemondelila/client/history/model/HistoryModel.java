package com.lemondelila.client.history.model;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * Modele memoire de l'historique de l'application.
 */
public final class HistoryModel {

    private final Deque<String> messages;
    private final int capacity;

    public HistoryModel() {
        this(200);
    }

    public HistoryModel(int capacity) {
        if (capacity <= 0) {
            throw new IllegalArgumentException("capacity must be positive");
        }
        this.capacity = capacity;
        this.messages = new ArrayDeque<>(capacity);
    }

    public synchronized void addMessage(String message) {
        if (messages.size() == capacity) {
            messages.removeFirst();
        }
        messages.addLast(message);
    }

    public synchronized void clear() {
        messages.clear();
    }

    public synchronized List<String> snapshot() {
        return new ArrayList<>(messages);
    }
}
