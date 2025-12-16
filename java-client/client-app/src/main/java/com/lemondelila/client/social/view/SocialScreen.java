package com.lemondelila.client.social.view;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.menu.view.MainMenuScreen;
import com.lemondelila.client.social.controller.SocialPresenter;

import javax.swing.AbstractAction;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;

public final class SocialScreen extends JPanel implements Screen {

    public static final ScreenId ID = ScreenId.of("social");

    private final SocialView view;
    private final SocialPresenter presenter;
    private ScreenManager screenManager;

    @Inject
    public SocialScreen(SocialView view, SocialPresenter presenter) {
        this.view = view;
        this.presenter = presenter;
        setLayout(new BorderLayout());
        add(view.component(), BorderLayout.CENTER);
        presenter.init();
        registerEscapeShortcut();
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
        presenter.onShow();
    }

    @Override
    public void onHide(ScreenContext context) {
        this.screenManager = null;
    }

    private void registerEscapeShortcut() {
        InputMap map = getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap actions = getActionMap();
        map.put(KeyStroke.getKeyStroke("ESCAPE"), "social.exit");
        actions.put("social.exit", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (screenManager != null) {
                    screenManager.show(MainMenuScreen.ID);
                }
            }
        });
    }
}
