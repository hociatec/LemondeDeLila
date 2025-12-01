package com.lemondelila.client.framework.access;

import java.util.Objects;
import java.util.Optional;

public final class AccessibleSpec {

    private final String name;
    private final String description;
    private final String shortcutDescription;

    private AccessibleSpec(Builder builder) {
        this.name = builder.name;
        this.description = builder.description;
        this.shortcutDescription = builder.shortcutDescription;
    }

    public Optional<String> name() {
        return Optional.ofNullable(name);
    }

    public Optional<String> description() {
        return Optional.ofNullable(description);
    }

    public Optional<String> shortcut() {
        return Optional.ofNullable(shortcutDescription);
    }

    public static Builder builder() {
        return new Builder();
    }

    public static final class Builder {
        private String name;
        private String description;
        private String shortcutDescription;

        private Builder() {
        }

        public Builder name(String name) {
            this.name = Objects.requireNonNull(name, "name");
            return this;
        }

        public Builder description(String description) {
            this.description = Objects.requireNonNull(description, "description");
            return this;
        }

        public Builder shortcut(String shortcut) {
            this.shortcutDescription = Objects.requireNonNull(shortcut, "shortcut");
            return this;
        }

        public AccessibleSpec build() {
            return new AccessibleSpec(this);
        }
    }
}
