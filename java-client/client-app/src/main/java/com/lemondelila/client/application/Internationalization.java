package com.lemondelila.client.application;

import java.text.MessageFormat;
import java.util.Locale;
import java.util.ResourceBundle;

public final class Internationalization {

    private static final ResourceBundle BUNDLE =
            ResourceBundle.getBundle("messages", Locale.getDefault());

    private Internationalization() {
    }

    public static String text(String key, Object... args) {
        String pattern = BUNDLE.containsKey(key) ? BUNDLE.getString(key) : key;
        return (args == null || args.length == 0) ? pattern : MessageFormat.format(pattern, args);
    }
}
