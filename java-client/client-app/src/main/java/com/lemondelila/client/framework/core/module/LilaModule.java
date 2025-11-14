package com.lemondelila.client.framework.core.module;

import com.lemondelila.client.framework.core.context.ApplicationContext;

/**
 * Contrat pour enregistrer et démarrer un module de l'application.
 */
public interface LilaModule {

    void configure(ApplicationContext.Builder builder);

    default void start(ApplicationContext context) throws Exception {
        // no-op
    }

    default void stop(ApplicationContext context) throws Exception {
        // no-op
    }

    /**
     * Priorité de lancement (plus petit = plus tôt).
     */
    default int order() {
        return 0;
    }
}

