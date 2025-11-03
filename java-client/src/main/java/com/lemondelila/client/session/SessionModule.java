package com.lemondelila.client.session;

import com.lemondelila.client.session.controller.SessionController;
import com.lemondelila.client.session.model.SessionModel;
import com.lemondelila.client.session.service.SessionService;

/**
 * Point d'assemblage du module de session.
 */
public final class SessionModule {

    private final SessionModel model;
    private final SessionController controller;
    private final SessionService service;

    public SessionModule() {
        this.model = new SessionModel();
        this.controller = new SessionController(model);
        this.service = new SessionService(controller);
    }

    public SessionService service() {
        return service;
    }
}
