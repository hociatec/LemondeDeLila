package com.lemondelila.client.menu;

import com.lemondelila.client.config.ClientConfig;
import com.lemondelila.client.history.service.HistoryService;
import com.lemondelila.client.menu.controller.MenuController;
import com.lemondelila.client.menu.view.SwingMainMenuView;
import com.lemondelila.client.session.listener.SessionListener;
import com.lemondelila.client.session.service.SessionService;
import com.lemondelila.client.ui.SwingAuthView;

import java.net.URI;
import java.util.Objects;

/**
 * Point d'assemblage du module menu.
 */
public final class MenuModule {

    private final SessionService sessionService;
    private final SwingMainMenuView view;
    private final MenuController controller;
    private boolean attached;

    public MenuModule(ClientConfig config,
                      SessionService sessionService,
                      HistoryService historyService) {
        this.sessionService = Objects.requireNonNull(sessionService, "sessionService");
        Objects.requireNonNull(historyService, "historyService");
        this.view = new SwingMainMenuView();
        this.controller = new MenuController(view, sessionService, historyService, config);
    }

    public SwingMainMenuView view() {
        return view;
    }

    public MenuController controller() {
        return controller;
    }

    public void attachTo(SwingAuthView authView) {
        Objects.requireNonNull(authView, "authView");
        if (attached) {
            return;
        }
        authView.setConnectedView(view);
        sessionService.addListener(new SessionListener() {
            @Override
            public void onSessionOpened(String username, String token) {
                authView.showConnectedView();
            }

            @Override
            public void onSessionClosed() {
                authView.showHome();
            }
        });
        if (sessionService.isActive()) {
            authView.showConnectedView();
        }
        attached = true;
    }
}
