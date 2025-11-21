package com.lemondelila.client.game.catalog.view;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.game.catalog.controller.GameCatalogController;
import com.lemondelila.client.game.catalog.event.CatalogLoaded;
import com.lemondelila.client.game.catalog.event.CatalogFailed;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;

import javax.swing.JPanel;
import java.awt.BorderLayout;

public final class GameCatalogScreen extends JPanel implements Screen, AutoCloseable {

    public static final ScreenId ID = ScreenId.of("catalog");

    private final GameCatalogView view;
    private final GameCatalogController controller;
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    @Inject
    public GameCatalogScreen(GameCatalogView view,
                             GameCatalogController controller,
                             DomainEventBus eventBus) {
        this.view = view;
        this.controller = controller;
        setLayout(new BorderLayout());
        add(view.component(), BorderLayout.CENTER);

        subscriptions.subscribe(eventBus, CatalogLoaded.class, ev -> {
            view.setStatus("Catalogue chargé");
            view.setBody("Jeux disponibles : " + ev.payload().games().size());
        });
        subscriptions.subscribe(eventBus, CatalogFailed.class, ev -> {
            view.setStatus("Erreur de chargement");
            view.setBody(ev.reason());
        });
    }

    @Override
    public ScreenId id() {
        return ID;
    }

    @Override
    public JPanel getComponent() {
        return this;
    }

    @Override
    public void onShow(ScreenContext context) {
        controller.fetchAll();
    }

    @Override
    public void close() {
        subscriptions.close();
    }
}
