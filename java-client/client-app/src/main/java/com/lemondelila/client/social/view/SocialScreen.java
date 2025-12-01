package com.lemondelila.client.social.view;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.social.controller.SocialPresenter;

import javax.swing.JPanel;
import java.awt.BorderLayout;

public final class SocialScreen extends JPanel implements Screen {

    public static final ScreenId ID = ScreenId.of("social");

    private final SocialView view;
    private final SocialPresenter presenter;

    @Inject
    public SocialScreen(SocialView view, SocialPresenter presenter) {
        this.view = view;
        this.presenter = presenter;
        setLayout(new BorderLayout());
        add(view.component(), BorderLayout.CENTER);
        presenter.init();
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
        presenter.onShow();
    }

    @Override
    public void onHide(ScreenContext context) {
        // Aucune action spécifique pour l'instant
    }
}
