package com.lemondelila.client.framework.ui;

import com.lemondelila.client.framework.ui.screen.ScreenId;

import java.util.Objects;
import java.util.Optional;

/**
 * Describe ce qu'un contrôleur souhaite que l'UI effectue
 * (message, navigation, etc.) sans dépendre d'une implémentation Swing.
 */
public final class ControllerResult {

    private final String statusMessage;
    private final ScreenId navigationTarget;

    private ControllerResult(String statusMessage, ScreenId navigationTarget) {
        this.statusMessage = statusMessage;
        this.navigationTarget = navigationTarget;
    }

    public static ControllerResult none() {
        return new ControllerResult(null, null);
    }

    public static ControllerResult status(String message) {
        Objects.requireNonNull(message, "message");
        return new ControllerResult(message, null);
    }

    public static ControllerResult navigate(ScreenId target) {
        Objects.requireNonNull(target, "target");
        return new ControllerResult(null, target);
    }

    public ControllerResult withStatus(String message) {
        Objects.requireNonNull(message, "message");
        return new ControllerResult(message, this.navigationTarget);
    }

    public ControllerResult withNavigation(ScreenId target) {
        Objects.requireNonNull(target, "target");
        return new ControllerResult(this.statusMessage, target);
    }

    public Optional<String> statusMessage() {
        return Optional.ofNullable(statusMessage);
    }

    public Optional<ScreenId> navigationTarget() {
        return Optional.ofNullable(navigationTarget);
    }
}
