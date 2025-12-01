package com.lemondelila.client.application;

import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.text.MessageFormat;
import java.util.Locale;
import java.util.ResourceBundle;

public final class Internationalization {

    private static final ResourceBundle BUNDLE =
            ResourceBundle.getBundle("messages", Locale.getDefault(), new Utf8Control());

    private Internationalization() {
    }

    public static String text(String key, Object... args) {
        String pattern = BUNDLE.containsKey(key) ? BUNDLE.getString(key) : key;
        return (args == null || args.length == 0) ? pattern : MessageFormat.format(pattern, args);
    }

    /**
     * Ensure properties files are read as UTF-8 to support accented strings.
     */
    private static final class Utf8Control extends ResourceBundle.Control {
        @Override
        public ResourceBundle newBundle(String baseName, Locale locale, String format, ClassLoader loader, boolean reload)
                throws IllegalAccessException, InstantiationException, IOException {
            String bundleName = toBundleName(baseName, locale);
            String resourceName = toResourceName(bundleName, "properties");
            try (var stream = loader.getResourceAsStream(resourceName)) {
                if (stream == null) {
                    return null;
                }
                try (var reader = new InputStreamReader(stream, StandardCharsets.UTF_8)) {
                    return new java.util.PropertyResourceBundle(reader);
                }
            }
        }
    }
}
