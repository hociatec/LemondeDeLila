package com.lemondelila.client.gamelogic.damenature.presenter;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.framework.access.game.AccessibilityService;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.gamelogic.damenature.controller.DameNatureController;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureConfig;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSession;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureState;
import com.lemondelila.client.gamelogic.damenature.view.DameNatureConfigPanel;
import com.lemondelila.client.gamelogic.damenature.view.DameNatureGameplayPanel;

import javax.swing.SwingUtilities;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

public final class DameNaturePresenter {

    public interface View {
        void showConfiguration();
        void showGameplay();
        void announce(String message);
        void requestGameplayFocus();
        void navigate(ScreenId id);
    }

    private final DameNatureController controller;
    private final AccessibilityService accessibilityService;
    private final DameNatureConfigPanel configPanel;
    private final DameNatureGameplayPanel gameplayPanel;
    private final View view;

    private DameNatureConfig activeConfig = DameNatureConfig.defaultConfig();
    private DameNatureConfig pendingConfig = DameNatureConfig.defaultConfig();
    private DameNatureSession currentSession;
    private boolean launchInProgress;

    public DameNaturePresenter(DameNatureController controller,
                               AccessibilityService accessibilityService,
                               DameNatureConfigPanel configPanel,
                               DameNatureGameplayPanel gameplayPanel,
                               View view) {
        this.controller = controller;
        this.accessibilityService = accessibilityService;
        this.configPanel = configPanel;
        this.gameplayPanel = gameplayPanel;
        this.view = view;
    }

    public void onShow() {
        pendingConfig = activeConfig;
        configPanel.setConfig(pendingConfig);
        Optional<DameNatureSession> current = controller.currentSession();
        if (current.isPresent()) {
            activeConfig = pendingConfig;
            view.showGameplay();
            applySession(current.get());
        } else {
            gameplayPanel.reset();
            view.showGameplay();
            view.announce(t("damenature.presenter.launch.start"));
            launchInProgress = true;
            handleActionFeedback(
                    controller.startNewGame(activeConfig),
                    t("damenature.presenter.launch.start"),
                    this::onLaunchCompleted,
                    throwable -> launchInProgress = false
            );
        }
        view.requestGameplayFocus();
    }

    public void onHide() {
        launchInProgress = false;
    }

    public void openConfiguration() {
        controller.reset();
        pendingConfig = activeConfig;
        configPanel.setConfig(pendingConfig);
        configPanel.setStatusMessage(t("damenature.presenter.config.adjust"));
        currentSession = null;
        launchInProgress = false;
        gameplayPanel.reset();
        view.showConfiguration();
        view.announce(gameplayPanel.currentSelectionAnnouncement());
    }

    public void startConfiguredGame(DameNatureConfig config) {
        launchInProgress = true;
        configPanel.setStatusMessage(t("damenature.presenter.launch.init"));
        handleActionFeedback(controller.startNewGame(config), t("damenature.presenter.launch.init"),
                () -> {
                    activeConfig = config;
                    configPanel.setStatusMessage(t("damenature.presenter.launch.success"));
                    launchInProgress = false;
                    view.showGameplay();
                    view.requestGameplayFocus();
                },
                throwable -> {
                    launchInProgress = false;
                    String detail = throwable.getMessage() == null || throwable.getMessage().isBlank()
                            ? t("damenature.presenter.error.unknown")
                            : throwable.getMessage();
                    configPanel.setStatusMessage(t("damenature.presenter.launch.failure", detail));
                });
    }

    public void updatePendingConfig(DameNatureConfig config) {
        pendingConfig = config;
    }

    public void restorePendingConfig() {
        pendingConfig = activeConfig;
        configPanel.setConfig(pendingConfig);
    }

    public void applySession(DameNatureSession session) {
        if (launchInProgress) {
            view.showGameplay();
            view.requestGameplayFocus();
        }
        launchInProgress = false;
        currentSession = session;
        gameplayPanel.applySession(session);
        view.announce(extractLastLogMessage(session));
    }

    public void cancelConfiguration() {
        pendingConfig = activeConfig;
        configPanel.setConfig(pendingConfig);
        view.showGameplay();
        view.announce(gameplayPanel.currentSelectionAnnouncement());
    }

    public void sendAskAction() {
        Optional<DameNatureGameplayPanel.PlayerOption> target = gameplayPanel.selectedPlayer();
        if (target.isEmpty()) {
            view.announce(t("damenature.presenter.ask.select.opponent"));
            return;
        }
        Optional<DameNatureGameplayPanel.CardOption> card = gameplayPanel.selectedCard();
        if (card.isEmpty()) {
            view.announce(t("damenature.presenter.ask.select.card"));
            return;
        }
        DameNatureGameplayPanel.PlayerOption player = target.get();
        DameNatureGameplayPanel.CardOption cardOption = card.get();
        handleActionFeedback(
                controller.askCard(player.id(), cardOption.familyId(), cardOption.memberId()),
                t("damenature.presenter.ask.inprogress", cardOption.memberName(), player.displayName()),
                null,
                null
        );
    }

    public void triggerDraw() {
        handleActionFeedback(controller.draw(), t("damenature.presenter.draw.inprogress"), null, null);
    }

    public void answerQuiz(int index) {
        List<String> choices = gameplayPanel.currentQuizChoices();
        if (choices.isEmpty()) {
            view.announce(t("damenature.presenter.quiz.none"));
            return;
        }
        if (index < 0 || index >= choices.size()) {
            view.announce(t("damenature.presenter.quiz.invalid"));
            return;
        }
        handleActionFeedback(
                controller.answerQuiz(index),
                t("damenature.presenter.quiz.sent", index + 1),
                null,
                null
        );
    }

    public void announceCurrentTurn() {
        if (currentSession == null) {
            view.announce(t("damenature.presenter.no.session"));
            return;
        }
        DameNatureState state = currentSession.state();
        List<DameNatureState.Player> players = state.players();
        if (players.isEmpty() || state.turnIndex() < 0 || state.turnIndex() >= players.size()) {
            view.announce(t("damenature.presenter.turn.unknown"));
            return;
        }
        DameNatureState.Player player = players.get(state.turnIndex());
        DameNatureState.Player self = currentSession.self();
        boolean yourTurn = self != null && self.id() == player.id();
        AccessibilityService.TurnContext context = new AccessibilityService.TurnContext(
                yourTurn,
                decorateBot(player.username(), player.isBot()),
                null
        );
        accessibilityService.announceTurn(gameplayPanel.turnLabel(), context);
    }

    public void announceTableParticipants() {
        if (currentSession == null) {
            view.announce(t("damenature.presenter.no.session"));
            return;
        }
        DameNatureState state = currentSession.state();
        List<DameNatureState.Player> players = state != null ? state.players() : null;
        if (players == null || players.isEmpty()) {
            view.announce(t("damenature.presenter.table.empty"));
            return;
        }
        DameNatureState.Player selfPlayer = currentSession.self();
        String selfUsername = selfPlayer != null ? selfPlayer.username() : null;
        StringBuilder builder = new StringBuilder();
        builder.append(t("damenature.presenter.table.header",
                players.size(),
                players.size() > 1
                        ? t("damenature.presenter.table.players")
                        : t("damenature.presenter.table.player")));
        for (int i = 0; i < players.size(); i++) {
            DameNatureState.Player player = players.get(i);
            String name = player != null ? player.username() : null;
            String display = (name == null || name.isBlank())
                    ? t("damenature.presenter.table.anon", i + 1)
                    : name;
            if (selfUsername != null && name != null && name.equalsIgnoreCase(selfUsername)) {
                display = display + t("damenature.presenter.table.self");
            }
            if (player != null && player.isBot()) {
                display = display + t("damenature.bot.suffix");
            }
            builder.append(display);
            if (i < players.size() - 1) {
                builder.append(t("damenature.presenter.table.separator"));
            }
        }
        view.announce(builder.toString());
    }

    public void exitToCatalog(ScreenId catalogId) {
        controller.reset();
        gameplayPanel.reset();
        currentSession = null;
        launchInProgress = false;
        view.showConfiguration();
        view.navigate(catalogId);
    }

    public void refreshGame() {
        handleActionFeedback(controller.refresh(), t("damenature.presenter.refresh.inprogress"), null, null);
    }

    private void handleActionFeedback(CompletableFuture<DameNatureSession> future,
                                      String pendingMessage,
                                      Runnable onSuccess,
                                      java.util.function.Consumer<Throwable> onError) {
        if (pendingMessage != null && !pendingMessage.isBlank()) {
            view.announce(pendingMessage);
        }
        future.whenComplete((session, error) -> SwingUtilities.invokeLater(() -> {
            if (error != null) {
                Throwable cause = error.getCause() != null ? error.getCause() : error;
                String message = cause.getMessage();
                view.announce(message == null || message.isBlank()
                        ? t("damenature.presenter.action.failed")
                        : message);
                if (onError != null) {
                    onError.accept(cause);
                }
            } else if (session != null) {
                view.announce(t("damenature.presenter.action.success"));
                if (onSuccess != null) {
                    onSuccess.run();
                }
            }
        }));
    }

    private void onLaunchCompleted() {
        launchInProgress = false;
    }

    private String extractLastLogMessage(DameNatureSession session) {
        List<DameNatureState.LogEntry> logs = session.state().log();
        if (logs != null && !logs.isEmpty()) {
            return logs.get(logs.size() - 1).message();
        }
        return t("damenature.presenter.action.success");
    }

    private static String decorateBot(String base, boolean isBot) {
        if (base == null || base.isBlank()) {
            return isBot ? t("damenature.bot.only") : "";
        }
        return isBot ? base + t("damenature.bot.suffix") : base;
    }

    private static String t(String key, Object... args) {
        return Internationalization.text(key, args);
    }
}
