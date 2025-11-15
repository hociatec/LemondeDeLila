package com.lemondelila.client.framework.access;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Objects;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

final class NativeDiagnosticsLogger {

    private static final NativeDiagnosticsLogger INSTANCE = new NativeDiagnosticsLogger();
    private static final DateTimeFormatter TIMESTAMP = DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mm:ss");

    private final Lock lock = new ReentrantLock();
    private final Path logFile;

    private NativeDiagnosticsLogger() {
        String baseDir = System.getProperty("lila.native.log.dir", System.getProperty("user.dir"));
        this.logFile = Paths.get(baseDir, "log.txt");
    }

    static NativeDiagnosticsLogger get() {
        return INSTANCE;
    }

    void log(String message) {
        Objects.requireNonNull(message, "message");
        String line = "[" + LocalDateTime.now().format(TIMESTAMP) + "] " + message;
        lock.lock();
        try {
            Path parent = logFile.getParent();
            if (parent != null && !Files.exists(parent)) {
                Files.createDirectories(parent);
            }
        } catch (IOException ignored) {
        }
        try (BufferedWriter writer = Files.newBufferedWriter(logFile, StandardCharsets.UTF_8,
                java.nio.file.StandardOpenOption.CREATE, java.nio.file.StandardOpenOption.APPEND)) {
            writer.write(line);
            writer.newLine();
        } catch (IOException ignored) {
        } finally {
            lock.unlock();
        }
    }
}
