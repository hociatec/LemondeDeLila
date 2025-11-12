package com.lemondelila.framework.access;

import com.sun.jna.Library;
import com.sun.jna.Native;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Lightweight integration with NVDA via the controller client DLL.
 * Falls back silently when the DLL or NVDA are not available.
 */
final class NvdaControllerBridge {

    private static final Logger LOGGER = Logger.getLogger(NvdaControllerBridge.class.getName());

    private final NvdaLibrary library;

    private NvdaControllerBridge(NvdaLibrary library) {
        this.library = Objects.requireNonNull(library, "library");
    }

    /**
     * Attempts to initialise the bridge when running on Windows.
     */
    static Optional<NvdaControllerBridge> create() {
        if (!isWindows()) {
            return Optional.empty();
        }

        NvdaLibrary library = loadLibrary();
        if (library == null) {
            return Optional.empty();
        }

        try {
            if (library.nvdaControllerClient_testIfRunning() != 0) {
                LOGGER.fine("NVDA controller client initialised but NVDA is not running.");
                return Optional.empty();
            }
        } catch (UnsatisfiedLinkError | NoClassDefFoundError ex) {
            LOGGER.log(Level.FINE, "NVDA controller test call failed.", ex);
            return Optional.empty();
        }

        LOGGER.fine("NVDA controller bridge initialised successfully.");
        return Optional.of(new NvdaControllerBridge(library));
    }

    boolean speak(String message) {
        try {
            return library.nvdaControllerClient_speakText(message) == 0;
        } catch (Throwable ex) {
            LOGGER.log(Level.FINE, "NVDA controller failed to speak.", ex);
            return false;
        }
    }

    void cancel() {
        try {
            library.nvdaControllerClient_cancelSpeech();
        } catch (Throwable ex) {
            LOGGER.log(Level.FINER, "NVDA controller failed to cancel speech.", ex);
        }
    }

    private static NvdaLibrary loadLibrary() {
        List<String> candidates = buildCandidates();
        for (String candidate : candidates) {
            if (candidate == null || candidate.isBlank()) {
                continue;
            }
            try {
                File file = new File(candidate);
                if (file.isAbsolute()) {
                    if (!file.exists()) {
                        continue;
                    }
                    return Native.load(file.getAbsolutePath(), NvdaLibrary.class);
                }
                return Native.load(candidate, NvdaLibrary.class);
            } catch (UnsatisfiedLinkError ex) {
                LOGGER.log(Level.FINER, () -> "NVDA controller DLL not found at: " + candidate);
            }
        }
        LOGGER.fine("NVDA controller DLL not found on this system.");
        return null;
    }

    private static List<String> buildCandidates() {
        List<String> paths = new ArrayList<>();
        String configured = System.getProperty("nvda.controller.path");
        if (configured != null && !configured.isBlank()) {
            paths.add(configured.trim());
        }

        boolean is64 = System.getProperty("os.arch", "").contains("64");
        String programFiles = System.getenv("ProgramFiles");
        String programFilesX86 = System.getenv("ProgramFiles(x86)");
        String localAppData = System.getenv("LOCALAPPDATA");

        if (programFiles != null) {
            paths.add(programFiles + "\\NVDA\\nvdaControllerClient" + (is64 ? "64" : "32") + ".dll");
        }
        if (programFilesX86 != null) {
            paths.add(programFilesX86 + "\\NVDA\\nvdaControllerClient32.dll");
        }
        if (localAppData != null) {
            paths.add(localAppData + "\\Programs\\NVDA\\nvdaControllerClient" + (is64 ? "64" : "32") + ".dll");
        }

        // Allow loading by name in case DLL is already on the PATH.
        paths.add(is64 ? "nvdaControllerClient64" : "nvdaControllerClient32");
        return paths;
    }

    private static boolean isWindows() {
        String os = System.getProperty("os.name", "").toLowerCase(Locale.ROOT);
        return os.contains("win");
    }

    private interface NvdaLibrary extends Library {
        int nvdaControllerClient_speakText(String text);

        int nvdaControllerClient_cancelSpeech();

        int nvdaControllerClient_testIfRunning();
    }
}
