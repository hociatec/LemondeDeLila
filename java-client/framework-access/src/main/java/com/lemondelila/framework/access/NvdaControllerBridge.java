package com.lemondelila.framework.access;

import com.sun.jna.Library;
import com.sun.jna.Native;
import com.sun.jna.WString;

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
    private final Mode mode;

    private NvdaControllerBridge(NvdaLibrary library, Mode mode) {
        this.library = Objects.requireNonNull(library, "library");
        this.mode = Objects.requireNonNull(mode, "mode");
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

        Mode mode = detectMode(library);
        if (mode == null) {
            NativeDiagnosticsLogger.get().log("NVDA controller bridge detection failed; required symbols missing.");
            return Optional.empty();
        }

        LOGGER.fine("NVDA controller bridge initialised successfully (" + mode + ").");
        NativeDiagnosticsLogger.get().log("NVDA controller bridge initialised successfully (" + mode + ").");
        return Optional.of(new NvdaControllerBridge(library, mode));
    }

    boolean speak(String message) {
        try {
            WString wMessage = new WString(message);
            boolean ok = switch (mode) {
                case CLIENT -> library.nvdaControllerClient_speakText(wMessage) == 0;
                case CONTROLLER -> library.nvdaController_speakText(wMessage) == 0;
            };
            NativeDiagnosticsLogger.get().log(ok
                    ? "NVDA spoke text successfully."
                    : "NVDA failed to speak text.");
            return ok;
        } catch (Throwable ex) {
            LOGGER.log(Level.FINE, "NVDA controller failed to speak.", ex);
            NativeDiagnosticsLogger.get().log("NVDA controller failed to speak: " + ex.getMessage());
            return false;
        }
    }

    void cancel() {
        try {
            switch (mode) {
                case CLIENT -> library.nvdaControllerClient_cancelSpeech();
                case CONTROLLER -> library.nvdaController_cancelSpeech();
            }
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
                final String pathToLoad;
                if (file.isAbsolute()) {
                    if (!file.exists()) {
                        continue;
                    }
                    pathToLoad = file.getAbsolutePath();
                } else {
                    pathToLoad = candidate;
                }
                NativeDiagnosticsLogger.get().log("Attempting to load NVDA library from " + pathToLoad);
                return Native.load(pathToLoad, NvdaLibrary.class);
            } catch (UnsatisfiedLinkError ex) {
                LOGGER.log(Level.FINER, () -> "NVDA controller DLL not found at: " + candidate);
                NativeDiagnosticsLogger.get().log("NVDA DLL load failed at " + candidate + ": " + ex.getMessage());
            }
        }
        LOGGER.fine("NVDA controller DLL not found on this system.");
        NativeDiagnosticsLogger.get().log("NVDA controller DLL not found on this system.");
        return null;
    }

    private static List<String> buildCandidates() {
        List<String> paths = new ArrayList<>();
        String configured = System.getProperty("nvda.controller.path");
        if (configured != null && !configured.isBlank()) {
            paths.add(configured.trim());
        }

        boolean is64 = System.getProperty("os.arch", "").contains("64");
        String nativeRoot = System.getProperty("lila.native.dir");
        if (nativeRoot != null && !nativeRoot.isBlank()) {
            File root = new File(nativeRoot);
            if (root.isDirectory()) {
                paths.add(new File(root, "nvdaHelperRemote.dll").getAbsolutePath());
                paths.add(new File(root, "nvdaHelperRemote" + (is64 ? "" : "32") + ".dll").getAbsolutePath());
                paths.add(new File(root, "nvdaControllerClient" + (is64 ? "64" : "32") + ".dll").getAbsolutePath());
                paths.add(new File(root, "nvdaControllerClient.dll").getAbsolutePath());
            } else {
                paths.add(nativeRoot);
            }
        }
        String programFiles = System.getenv("ProgramFiles");
        String programFilesX86 = System.getenv("ProgramFiles(x86)");
        String localAppData = System.getenv("LOCALAPPDATA");

        if (programFiles != null) {
            paths.add(programFiles + "\\NVDA\\nvdaHelperRemote.dll");
            paths.add(programFiles + "\\NVDA\\nvdaControllerClient" + (is64 ? "64" : "32") + ".dll");
            paths.add(programFiles + "\\NVDA\\nvdaControllerClient.dll");
        }
        if (programFilesX86 != null) {
            paths.add(programFilesX86 + "\\NVDA\\nvdaHelperRemote.dll");
            paths.add(programFilesX86 + "\\NVDA\\nvdaControllerClient32.dll");
            paths.add(programFilesX86 + "\\NVDA\\nvdaControllerClient.dll");
        }
        if (localAppData != null) {
            paths.add(localAppData + "\\Programs\\NVDA\\nvdaHelperRemote.dll");
            paths.add(localAppData + "\\Programs\\NVDA\\nvdaControllerClient" + (is64 ? "64" : "32") + ".dll");
            paths.add(localAppData + "\\Programs\\NVDA\\nvdaControllerClient.dll");
        }

        // Allow loading by name in case DLL is already on the PATH.
        paths.add("nvdaHelperRemote");
        paths.add(is64 ? "nvdaControllerClient64" : "nvdaControllerClient32");
        paths.add("nvdaControllerClient");
        return paths;
    }

    private static boolean isWindows() {
        String os = System.getProperty("os.name", "").toLowerCase(Locale.ROOT);
        return os.contains("win");
    }

    private interface NvdaLibrary extends Library {
        int nvdaControllerClient_speakText(WString text);

        int nvdaControllerClient_cancelSpeech();

        int nvdaControllerClient_testIfRunning();

        int nvdaController_speakText(WString text);

        int nvdaController_cancelSpeech();

        int nvdaController_testIfRunning();
    }

    private enum Mode {
        CLIENT,
        CONTROLLER
    }

    private static Mode detectMode(NvdaLibrary library) {
        // First try the legacy *Client* API
        try {
            int status = library.nvdaControllerClient_testIfRunning();
            if (status == 0) {
                NativeDiagnosticsLogger.get().log("Detected NVDA controller client API.");
                return Mode.CLIENT;
            }
            NativeDiagnosticsLogger.get().log("NVDA controller client API reports status " + status + ", assuming NVDA not running.");
            return null;
        } catch (UnsatisfiedLinkError | NoSuchMethodError ex) {
            LOGGER.log(Level.FINER, "NVDA controller client API not available, trying controller API.", ex);
            NativeDiagnosticsLogger.get().log("NVDA controller client API not available, trying controller API: " + ex.getMessage());
        } catch (Throwable ex) {
            LOGGER.log(Level.FINE, "NVDA controller client test call failed.", ex);
            NativeDiagnosticsLogger.get().log("NVDA controller client test call failed: " + ex.getMessage());
            return null;
        }

        try {
            int status = library.nvdaController_testIfRunning();
            if (status == 0) {
                NativeDiagnosticsLogger.get().log("Detected NVDA controller API.");
                return Mode.CONTROLLER;
            }
            NativeDiagnosticsLogger.get().log("NVDA controller API reports status " + status + ", assuming NVDA not running.");
            return null;
        } catch (UnsatisfiedLinkError | NoSuchMethodError ex) {
            LOGGER.log(Level.FINE, "NVDA controller API not available.", ex);
            NativeDiagnosticsLogger.get().log("NVDA controller API not available: " + ex.getMessage());
        } catch (Throwable ex) {
            LOGGER.log(Level.FINE, "NVDA controller API test call failed.", ex);
            NativeDiagnosticsLogger.get().log("NVDA controller API test call failed: " + ex.getMessage());
        }
        return null;
    }
}
