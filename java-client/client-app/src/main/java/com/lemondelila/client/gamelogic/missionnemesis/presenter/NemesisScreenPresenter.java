package com.lemondelila.client.gamelogic.missionnemesis.presenter;

import com.lemondelila.client.gamelogic.missionnemesis.controller.NemesisController;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;

import java.util.Objects;
import java.util.concurrent.Executor;
import java.util.function.Consumer;

/**
 * Presenter dédié à l'écran Mission Nemesis : il branche la session et délègue à {@link NemesisGamePresenter}.
 */
public final class NemesisScreenPresenter {

    public interface View {
        void requestGameplayFocus();
    }

    private final NemesisController controller;
    private final NemesisSessionPresenter sessionPresenter;
    private final NemesisGamePresenter gamePresenter;
    private final Consumer<NemesisSession> sessionListener = this::handleSession;
    private View view;
    private boolean running;

    public NemesisScreenPresenter(NemesisController controller,
                                  NemesisSessionPresenter sessionPresenter,
                                  NemesisGamePresenter gamePresenter) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.sessionPresenter = Objects.requireNonNull(sessionPresenter, "sessionPresenter");
        this.gamePresenter = Objects.requireNonNull(gamePresenter, "gamePresenter");
    }

    public void bind(View view) {
        this.view = Objects.requireNonNull(view, "view");
    }

    public void onShow() {
        if (running || view == null) {
            return;
        }
        controller.addListener(sessionListener);
        sessionPresenter.onShow();
        gamePresenter.onShow();
        running = true;
    }

    public void onHide() {
        if (!running) {
            return;
        }
        controller.removeListener(sessionListener);
        sessionPresenter.onHide();
        gamePresenter.onHide();
        running = false;
    }

    private void handleSession(NemesisSession session) {
        if (session == null) {
            return;
        }
        sessionPresenter.applySession(session);
        gamePresenter.handleSessionUpdate(session);
        if (view != null) {
            view.requestGameplayFocus();
        }
    }
}
