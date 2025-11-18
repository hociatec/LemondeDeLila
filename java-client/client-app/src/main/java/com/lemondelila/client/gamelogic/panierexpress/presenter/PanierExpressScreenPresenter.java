package com.lemondelila.client.gamelogic.panierexpress.presenter;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.gamelogic.panierexpress.controller.PanierExpressController;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressGameOptions;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.util.BotTurnScheduler;
import com.lemondelila.client.framework.ui.dialog.DialogService;

import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;

/**
 * Coordonne le cycle de vie de l'écran Panier Express (chargement des sessions, démarrage, etc.).
 */
public final class PanierExpressScreenPresenter {

    public interface View {
        void showSetupCard();
        void showGameCard();
        void focusSetupPanel();
        void renderSession(PanierExpressSession session);
        void resetGameView();
        void navigateToCatalog();
        void narrate(String message);
        boolean hasActiveSession();
        boolean shouldCoordinateBotTurns();
        void requestRootFocus();
    }

    private final PanierExpressController controller;
    private final PanierExpressGameInteractor gameInteractor;
    private final BotTurnScheduler botTurnScheduler;
    private final DialogService dialogService;

    private final Consumer<PanierExpressSession> sessionListener = this::handleSessionUpdate;
    private View view;
    private PanierExpressGameOptions lastUsedOptions = PanierExpressGameOptions.defaults();

    public PanierExpressScreenPresenter(PanierExpressController controller,
                                        PanierExpressGameInteractor gameInteractor,
                                        BotTurnScheduler botTurnScheduler,
                                        DialogService dialogService) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.gameInteractor = Objects.requireNonNull(gameInteractor, "gameInteractor");
        this.botTurnScheduler = Objects.requireNonNull(botTurnScheduler, "botTurnScheduler");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
    }

    public void bind(View view) {
        this.view = Objects.requireNonNull(view, "view");
    }

    public void onShow() {
        if (view == null) {
            return;
        }
        controller.addSessionListener(sessionListener);
        Optional<PanierExpressSession> current = controller.currentSession();
        if (current.isPresent()) {
            handleSessionUpdate(current.get());
        } else {
            view.showSetupCard();
            view.focusSetupPanel();
        }
        view.requestRootFocus();
    }

    public void onHide() {
        controller.removeSessionListener(sessionListener);
        botTurnScheduler.cancel();
    }

    public void startGame(PanierExpressGameOptions options, boolean fromShortcut) {
        if (view == null) {
            return;
        }
        if (gameInteractor.isBusy()) {
            view.narrate(Internationalization.text("panier.status.action.busy"));
            return;
        }
        lastUsedOptions = options == null ? PanierExpressGameOptions.defaults() : options;
        view.showGameCard();
        String message = fromShortcut
                ? Internationalization.text("panier.status.newgame.shortcut")
                : Internationalization.text("panier.status.newgame.standard");
        gameInteractor.startGame(lastUsedOptions, message);
    }

    public void attemptNewGame() {
        startGame(lastUsedOptions, true);
    }

    public void attemptRoll() {
        gameInteractor.attemptRoll();
    }

    public void attemptRefresh() {
        gameInteractor.attemptRefresh();
    }

    public void promptRestart() {
        if (view == null) {
            return;
        }
        if (gameInteractor.isBusy()) {
            view.narrate(Internationalization.text("panier.status.action.busy"));
            return;
        }
        if (!view.hasActiveSession()) {
            view.narrate(Internationalization.text("panier.status.no.active.session"));
            return;
        }
        dialogService.confirm(
                        Internationalization.text("panier.dialog.restart.title"),
                        Internationalization.text("panier.dialog.restart.body"))
                .thenAccept(accepted -> {
                    if (Boolean.TRUE.equals(accepted)) {
                        startGame(lastUsedOptions, false);
                    }
                });
    }

    public void handleCancel() {
        if (view == null) {
            return;
        }
        botTurnScheduler.cancel();
        controller.reset();
        view.resetGameView();
        view.navigateToCatalog();
    }

    private void handleSessionUpdate(PanierExpressSession session) {
        if (view == null || session == null) {
            return;
        }
        view.showGameCard();
        view.renderSession(session);
        botTurnScheduler.evaluate(session, view.shouldCoordinateBotTurns());
    }
}

