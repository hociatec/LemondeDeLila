package com.lemondelila.client.social.controller;

import com.lemondelila.client.social.view.SocialView;

import javax.swing.SwingUtilities;
import java.awt.Window;
import java.util.Objects;

public final class SocialPresenter {

    private final SocialView view;
    private final SocialController controller;

    public SocialPresenter(SocialView view, SocialController controller) {
        this.view = Objects.requireNonNull(view, "view");
        this.controller = Objects.requireNonNull(controller, "controller");
    }

    public void init() {
        view.onOpenMessaging(() -> {
            Window window = SwingUtilities.getWindowAncestor(view.component());
            controller.openMessaging(window);
        });
        view.onOpenFriends(() -> {
            Window window = SwingUtilities.getWindowAncestor(view.component());
            controller.openFriends(window);
        });
    }

    public void onShow() {
        SwingUtilities.invokeLater(view::focusMenu);
    }
}
