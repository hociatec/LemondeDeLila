package com.lemondelila.client.gamelogic.damenature.presenter;

import com.lemondelila.client.gamelogic.damenature.controller.DameNatureController;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSession;
import java.util.Objects;
import java.util.function.Consumer;

/**
 * Ordonne le cycle de vie de {@link DameNatureScreen} sans exposer la logique métier aux composants Swing.
 */
public final class DameNatureScreenPresenter {

    private final DameNatureController controller;
    private final DameNaturePresenter presenter;

    private final Consumer<DameNatureSession> sessionListener = this::handleSession;
    private DameNaturePresenter.View view;
    private boolean running;

    public DameNatureScreenPresenter(DameNatureController controller,
                                     DameNaturePresenter presenter) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.presenter = Objects.requireNonNull(presenter, "presenter");
    }

    public void bind(DameNaturePresenter.View view) {
        this.view = Objects.requireNonNull(view, "view");
    }

    public void onShow() {
        if (view == null || running) {
            return;
        }
        controller.addListener(sessionListener);
        presenter.onShow();
        running = true;
    }

    public void onHide() {
        if (!running) {
            return;
        }
        controller.removeListener(sessionListener);
        presenter.onHide();
        running = false;
    }

    private void handleSession(DameNatureSession session) {
        if (session == null) {
            return;
        }
        presenter.applySession(session);
        if (view != null) {
            view.requestGameplayFocus();
        }
    }
}
