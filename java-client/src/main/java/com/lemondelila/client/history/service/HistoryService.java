package com.lemondelila.client.history.service;

import com.lemondelila.client.history.controller.HistoryController;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Objects;

/**
 * Service applicatif pour publier des messages dans l'historique.
 */
public final class HistoryService {

    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm:ss");

    private final HistoryController controller;

    public HistoryService(HistoryController controller) {
        this.controller = Objects.requireNonNull(controller, "controller");
    }

    public void append(String message) {
        String formatted = formatMessage(message);
        if (!formatted.isEmpty()) {
            controller.appendRawMessage(formatted);
        }
    }

    public void append(String section, String message) {
        Objects.requireNonNull(section, "section");
        String formatted = formatMessage("[" + section + "] " + message);
        if (!formatted.isEmpty()) {
            controller.appendRawMessage(formatted);
        }
    }

    public void clear() {
        controller.clear();
    }

    private static String formatMessage(String message) {
        String trimmed = message == null ? "" : message.trim();
        if (trimmed.isEmpty()) {
            return "";
        }
        String timestamp = TIME_FORMAT.format(LocalTime.now());
        return "[" + timestamp + "] " + trimmed;
    }
}
