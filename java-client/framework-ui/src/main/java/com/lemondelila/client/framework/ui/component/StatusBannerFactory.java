package com.lemondelila.client.framework.ui.component;

import com.lemondelila.client.framework.access.NarrationQueue;

import javax.inject.Inject;
import java.awt.Component;
import java.util.Objects;

/**
 * Fournit des {@link StatusBanner} partagés au sein du framework UI.
 * Le factory centralise la queue de narration pour éviter les new multiples.
 */
public final class StatusBannerFactory {

    private final NarrationQueue narrationQueue;

    @Inject
    public StatusBannerFactory(NarrationQueue narrationQueue) {
        this.narrationQueue = Objects.requireNonNull(narrationQueue, "narrationQueue");
    }

    public StatusBanner create(String accessibleName,
                               String accessibleDescription,
                               Component alignmentReference) {
        return new StatusBanner(accessibleName, accessibleDescription, alignmentReference, narrationQueue);
    }
}
