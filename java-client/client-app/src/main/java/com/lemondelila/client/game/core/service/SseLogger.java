package com.lemondelila.client.game.core.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Écriture séquentielle de journaux spécifiques au flux temps réel (bots, SSE/WS).
 */
public final class SseLogger {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    private final Path file;

    public SseLogger(Path file) {
        this.file = file;
        try {
            Path parent = file.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            writeLine("SseLogger initialisé (" + file.toAbsolutePath() + ")");
        } catch (IOException ignored) {
        }
    }

    public void trace(String category, String message) {
        trace(category, message, null);
    }

    public void trace(String category, String message, Throwable error) {
        StringBuilder line = new StringBuilder();
        line.append(FORMATTER.format(LocalDateTime.now()))
                .append(" [").append(category).append("] ")
                .append(message);
        if (error != null) {
            line.append(" -> ").append(error.getClass().getSimpleName())
                    .append(": ").append(error.getMessage());
        }
        writeLine(line.toString());
    }

    private void writeLine(String text) {
        try {
            Files.writeString(file, text + System.lineSeparator(),
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException e) {
            System.err.println("Impossible d'écrire dans " + file + ": " + e.getMessage());
        }
    }
}
