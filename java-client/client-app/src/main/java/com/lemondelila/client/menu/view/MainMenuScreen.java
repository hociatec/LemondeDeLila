package com.lemondelila.client.menu.view;

import com.lemondelila.client.menu.controller.MainMenuPresenter;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;

import javax.swing.JPanel;
import java.awt.BorderLayout;

public final class MainMenuScreen extends JPanel implements Screen {

    public static final ScreenId ID = ScreenId.of("main-menu");

    private final MainMenuView view;
    private ScreenManager screenManager;
    private final MainMenuPresenter presenter;

    @Inject
    public MainMenuScreen(MainMenuView view, MainMenuPresenter presenter) {
        this.view = view;
        this.presenter = presenter;
        this.presenter.attachRoot(this);
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
