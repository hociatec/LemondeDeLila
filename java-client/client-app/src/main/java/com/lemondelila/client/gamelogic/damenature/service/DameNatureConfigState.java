package com.lemondelila.client.gamelogic.damenature.service;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public final class DameNatureConfigState {

    public enum Variant {
        CLASSIC("classic"),
        DAME_NATURE("dame-nature");

        private final String code;

        Variant(String code) {
            this.code = code;
        }

        public String code() {
            return code;
        }

        public String label() {
            return this == CLASSIC ? "Classique" : "Dame Nature";
        }
    }

    private boolean dangerEnabled = true;
    private boolean quizEnabled = true;

    public boolean dangerEnabled() {
        return dangerEnabled;
    }

    public void setDangerEnabled(boolean value) {
        this.dangerEnabled = value;
    }

    public boolean quizEnabled() {
        return quizEnabled;
    }

    public void setQuizEnabled(boolean value) {
        this.quizEnabled = value;
    }

    public Variant variant() {
        if (!dangerEnabled && !quizEnabled) {
            return Variant.CLASSIC;
        }
        return Variant.DAME_NATURE;
    }

    public Map<String, Object> toOptionsPayload() {
        Map<String, Object> options = new HashMap<>();
        options.put("variant", variant().code());
        options.put("dangerCards", dangerEnabled);
        options.put("quizCards", quizEnabled);
        return options;
    }

    public String describeVariant() {
        Variant variant = variant();
        if (variant == Variant.CLASSIC) {
            return "Mode classique (sans pollution)";
        }
        StringBuilder builder = new StringBuilder("Variante Dame Nature");
        if (!dangerEnabled || !quizEnabled) {
            builder.append(" (");
            boolean appended = false;
            if (dangerEnabled) {
                builder.append("dangers activés");
                appended = true;
            }
            if (quizEnabled) {
                if (appended) {
                    builder.append(", ");
                }
                builder.append("quiz activés");
            }
            builder.append(")");
        }
        return builder.toString();
    }
}
