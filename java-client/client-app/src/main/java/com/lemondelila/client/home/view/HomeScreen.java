package com.lemondelila.client.home.view;

import com.lemondelila.client.home.controller.HomePresenter;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;

import javax.swing.JPanel;
import java.awt.BorderLayout;

public final class HomeScreen extends JPanel implements Screen {

    public static final ScreenId ID = ScreenId.of("home");

    private final HomeView view;
    private final HomePresenter presenter;
    private ScreenManager screenManager;

    @Inject
    public HomeScreen(HomeView view, HomePresenter presenter) {
        this.view = view;
        this.presenter = presenter;
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
        presenter.onShow(screenManager, this);
    }

    @Override
    public void onHide(ScreenContext context) {
        this.screenManager = null;
        presenter.onHide();
    }
}
