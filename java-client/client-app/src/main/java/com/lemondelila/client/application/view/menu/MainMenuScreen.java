
package com.lemondelila.client.application.view.menu;

import com.lemondelila.client.framework.access.NarrationQueue;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.game.controller.CatalogController;
import com.lemondelila.client.game.controller.ChatController;
import com.lemondelila.client.game.controller.OptionsController;
import com.lemondelila.client.game.controller.PresenceController;
import com.lemondelila.client.game.controller.SocialController;
import com.lemondelila.client.user.model.ClientSession;

import javax.swing.JPanel;
import java.awt.BorderLayout;

public final class MainMenuScreen extends JPanel implements Screen {

    public static final ScreenId ID = ScreenId.of("main-menu");

    private final MainMenuView view;
    private ScreenManager screenManager;
    private final MainMenuPresenter presenter;

    @Inject
    public MainMenuScreen(DialogService dialogService,
                          ChatController chatController,
                          PresenceController presenceController,
                          SocialController socialController,
                          OptionsController optionsController,
                          CatalogController catalogController,
                          ClientSession session,
                          DomainEventBus eventBus,
                          SoundEffectManager sounds,
                          NarrationQueue narrationQueue) {
        this.view = new MainMenuView(narrationQueue);
        this.presenter = new MainMenuPresenter(
                dialogService,
                chatController,
                presenceController,
                socialController,
                optionsController,
                catalogController,
                session,
                eventBus,
                new MainMenuAudio(sounds),
                view,
                this
        );
        setLayout(new BorderLayout());
        add(view.component(), BorderLayout.CENTER);
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
        this.screenManager = context.screenManager();
        presenter.onShow(screenManager);
    }

    @Override
    public void onHide(ScreenContext context) {
        this.screenManager = null;
        presenter.onHide();
    }
}
