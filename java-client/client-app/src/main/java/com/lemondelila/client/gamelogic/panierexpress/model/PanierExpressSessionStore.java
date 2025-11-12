package com.lemondelila.client.gamelogic.panierexpress.model;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

public final class PanierExpressSessionStore {

    private final AtomicReference<PanierExpressSession> session = new AtomicReference<>();

    public Optional<PanierExpressSession> current() {
        return Optional.ofNullable(session.get());
    }

    public void save(PanierExpressSession value) {
        session.set(value);
    }

    public void clear() {
        session.set(null);
    }
}
