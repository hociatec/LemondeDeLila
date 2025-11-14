package com.lemondelila.client.framework.access;

import com.sun.jna.FunctionMapper;
import com.sun.jna.Native;
import com.sun.jna.NativeLibrary;
import com.sun.jna.WString;
import com.sun.jna.win32.StdCallLibrary;

import java.io.File;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Minimal integration with JAWS using the Freedom Scientific FSAPI.
 * Falls back silently when the DLL or JAWS are not available.
 */
final class JawsControllerBridge {

    private static final Logger LOGGER = Logger.getLogger(JawsControllerBridge.class.getName());

    private final FsApiLibrary library;
    private final boolean initialised;

    private JawsControllerBridge(FsApiLibrary library, boolean initialised) {
        this.library = Objects.requireNonNull(library, "library");
        this.initialised = initialised;
    }

    static Optional<JawsControllerBridge> create() {
        if (!isWindows()) {
            return Optional.empty();
        }

        FsApiLibrary library = loadLibrary();
        if (library == null) {
            return Optional.empty();
        }

        boolean initialised = false;
        try {
            int result = library.initialize();
            if (result == 0) {
                initialised = true;
                LOGGER.fine("JAWS FSAPI initialised successfully.");
                NativeDiagnosticsLogger.get().log("JAWS FSAPI initialised successfully.");
            } else {
                LOGGER.log(Level.FINER, "FSAPI initialisation returned code: {0}", result);
                NativeDiagnosticsLogger.get().log("JAWS FSAPI initialisation returned code " + result);
            }
        } catch (UnsatisfiedLinkError ex) {
            LOGGER.log(Level.FINE, "FSAPI initialise symbol not available.", ex);
            NativeDiagnosticsLogger.get().log("JAWS FSAPI initialise symbol missing: " + ex.getMessage());
        } catch (Throwable ex) {
            LOGGER.log(Level.FINE, "FSAPI initialisation failed.", ex);
            NativeDiagnosticsLogger.get().log("JAWS FSAPI initialisation failed: " + ex.getMessage());
        }

        return Optional.of(new JawsControllerBridge(library, initialised));
    }

    boolean speak(String message) {
        try {
            WString text = new WString(message);
            int flags = 1; // interrupt current speech
            int result = library.sayString(text, flags);
            if (result != 0) {
                LOGGER.log(Level.FINER, "JAWS FSAPI SayString returned code: {0}", result);
                NativeDiagnosticsLogger.get().log("JAWS FSAPI SayString returned code " + result);
            } else {
                NativeDiagnosticsLogger.get().log("JAWS FSAPI spoke text successfully.");
            }
            return result == 0;
        } catch (UnsatisfiedLinkError ex) {
            LOGGER.log(Level.FINE, "JAWS FSAPI SayString symbol missing.", ex);
            NativeDiagnosticsLogger.get().log("JAWS FSAPI SayString symbol missing: " + ex.getMessage());
            return false;
        } catch (Throwable ex) {
            LOGGER.log(Level.FINE, "JAWS FSAPI failed to speak.", ex);
            NativeDiagnosticsLogger.get().log("JAWS FSAPI failed to speak: " + ex.getMessage());
            return false;
        }
    }

    void stop() {
        try {
            library.stopSpeech();
        } catch (UnsatisfiedLinkError ex) {
            LOGGER.log(Level.FINER, "JAWS FSAPI stopSpeech symbol missing.", ex);
            NativeDiagnosticsLogger.get().log("JAWS FSAPI stopSpeech symbol missing: " + ex.getMessage());
        } catch (Throwable ex) {
            LOGGER.log(Level.FINER, "JAWS FSAPI failed to stop speech.", ex);
            NativeDiagnosticsLogger.get().log("JAWS FSAPI failed to stop speech: " + ex.getMessage());
        }
    }

    void shutdown() {
        if (!initialised) {
            return;
        }
        try {
            library.terminate();
        } catch (UnsatisfiedLinkError ex) {
            LOGGER.log(Level.FINER, "JAWS FSAPI terminate symbol missing.", ex);
            NativeDiagnosticsLogger.get().log("JAWS FSAPI terminate symbol missing: " + ex.getMessage());
        } catch (Throwable ex) {
            LOGGER.log(Level.FINER, "JAWS FSAPI failed to terminate.", ex);
            NativeDiagnosticsLogger.get().log("JAWS FSAPI failed to terminate: " + ex.getMessage());
        }
    }

    private static FsApiLibrary loadLibrary() {
        List<String> candidates = buildCandidates();
        Map<String, Object> options = new HashMap<>();
        options.put(com.sun.jna.Library.OPTION_FUNCTION_MAPPER, new FsApiFunctionMapper());
        for (String candidate : candidates) {
            if (candidate == null || candidate.isBlank()) {
                continue;
            }
            try {
                File file = new File(candidate);
                FsApiLibrary library;
                if (file.isAbsolute()) {
                    if (!file.exists()) {
                        continue;
                    }
                    library = Native.load(file.getAbsolutePath(), FsApiLibrary.class, options);
                } else {
                    library = Native.load(candidate, FsApiLibrary.class, options);
                }
                LOGGER.log(Level.FINE, "FSAPI DLL loaded from {0}", candidate);
                NativeDiagnosticsLogger.get().log("Loaded JAWS library from " + candidate);
                return library;
            } catch (UnsatisfiedLinkError ex) {
                LOGGER.log(Level.FINER, () -> "FSAPI DLL not found at: " + candidate);
                NativeDiagnosticsLogger.get().log("JAWS DLL load failed at " + candidate + ": " + ex.getMessage());
            } catch (Throwable ex) {
                LOGGER.log(Level.FINE, "FSAPI DLL load failed.", ex);
                NativeDiagnosticsLogger.get().log("JAWS DLL load failed at " + candidate + ": " + ex.getMessage());
            }
        }
        LOGGER.fine("FSAPI DLL not available on this system.");
        NativeDiagnosticsLogger.get().log("FSAPI DLL not available on this system.");
        return null;
    }

    private static List<String> buildCandidates() {
        List<String> paths = new ArrayList<>();
        String configured = System.getProperty("fsapi.path");
        if (configured != null && !configured.isBlank()) {
            paths.add(configured.trim());
        }

        String root = System.getProperty("lila.native.dir");
        if (root != null && !root.isBlank()) {
            File base = new File(root);
            if (base.isDirectory()) {
                paths.add(new File(base, "fsapi32.dll").getAbsolutePath());
                paths.add(new File(base, "FSAPI32.dll").getAbsolutePath());
                paths.add(new File(base, "saapi32.dll").getAbsolutePath());
                paths.add(new File(base, "SAAPI32.dll").getAbsolutePath());
            } else {
                paths.add(root);
            }
        }

        String programFiles = System.getenv("ProgramFiles");
        String programFilesX86 = System.getenv("ProgramFiles(x86)");
        if (programFiles != null) {
            paths.add(programFiles + "\\Freedom Scientific\\JAWS\\fsapi32.dll");
            paths.add(programFiles + "\\Freedom Scientific\\JAWS\\SAAPI32.dll");
        }
        if (programFilesX86 != null) {
            paths.add(programFilesX86 + "\\Freedom Scientific\\JAWS\\fsapi32.dll");
            paths.add(programFilesX86 + "\\Freedom Scientific\\JAWS\\SAAPI32.dll");
        }

        paths.add("fsapi32");
        paths.add("SAAPI32");
        return paths;
    }

    private static boolean isWindows() {
        String os = System.getProperty("os.name", "").toLowerCase(Locale.ROOT);
        return os.contains("win");
    }

    private interface FsApiLibrary extends StdCallLibrary {
        int initialize();

        int terminate();

        int sayString(WString text, int interrupt);

        int stopSpeech();
    }

    private static final class FsApiFunctionMapper implements FunctionMapper {

        private static final String[] INIT_CANDIDATES = {
                "FSAPI_Initialize",
                "FSInitialize",
                "SAAPI_Initialize",
                "SAInitialize",
                "_FSAPI_Initialize",
                "_FSInitialize@0",
                "_SAAPI_Initialize",
                "_SAInitialize@0"
        };

        private static final String[] TERM_CANDIDATES = {
                "FSAPI_Terminate",
                "FSTerminate",
                "SAAPI_Terminate",
                "SATerminate",
                "_FSAPI_Terminate",
                "_FSTerminate@0",
                "_SAAPI_Terminate",
                "_SATerminate@0"
        };

        private static final String[] SPEAK_CANDIDATES = {
                "FSAPI_SayString",
                "FSSayString",
                "FSSpeakString",
                "SayString",
                "FS_SayString",
                "SAAPI_SayString",
                "SASayString",
                "SASpeakString",
                "_FSAPI_SayString@8",
                "_FSSayString@8",
                "_FSSpeakString@8",
                "_SAAPI_SayString@8",
                "_SASayString@8",
                "_SASpeakString@8"
        };

        private static final String[] STOP_CANDIDATES = {
                "FSAPI_StopSpeech",
                "FSStopSpeech",
                "SAAPI_StopSpeech",
                "SAStopSpeech",
                "_FSAPI_StopSpeech",
                "_FSStopSpeech@0",
                "_SAAPI_StopSpeech",
                "_SAStopSpeech@0"
        };

        @Override
        public String getFunctionName(NativeLibrary library, Method method) {
            String[] candidates = switch (method.getName()) {
                case "initialize" -> INIT_CANDIDATES;
                case "terminate" -> TERM_CANDIDATES;
                case "speakText" -> SPEAK_CANDIDATES;
                case "stopSpeech" -> STOP_CANDIDATES;
                default -> throw new UnsatisfiedLinkError("Unknown FSAPI method: " + method.getName());
            };
            for (String candidate : candidates) {
                try {
                    library.getFunction(candidate);
                    return candidate;
                } catch (UnsatisfiedLinkError ex) {
                    // ignore
                }
            }
            throw new UnsatisfiedLinkError("FSAPI symbol not found for method: " + method.getName());
        }
    }
}
