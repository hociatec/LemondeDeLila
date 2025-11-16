package com.lemondelila.client.gamelogic.damenature.presenter;

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
            view.announce("Lancement de la partie...");
            launchInProgress = true;
            handleActionFeedback(
                    controller.startNewGame(activeConfig),
                    "Lancement de la partie...",
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
        configPanel.setStatusMessage("Ajustez les options puis appuyez sur Entrée pour relancer.");
        currentSession = null;
        launchInProgress = false;
        gameplayPanel.reset();
        view.showConfiguration();
        view.announce(gameplayPanel.currentSelectionAnnouncement());
    }

    public void startConfiguredGame(DameNatureConfig config) {
        launchInProgress = true;
        configPanel.setStatusMessage("Initialisation de la partie...");
        handleActionFeedback(controller.startNewGame(config), "Initialisation de la partie...",
                () -> {
                    activeConfig = config;
                    configPanel.setStatusMessage("Partie lancée.");
                    launchInProgress = false;
                    view.showGameplay();
                    view.requestGameplayFocus();
                },
                throwable -> {
                    launchInProgress = false;
                    configPanel.setStatusMessage("Impossible de lancer la partie : " +
                            (throwable.getMessage() == null ? "erreur inconnue" : throwable.getMessage()));
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
            view.announce("Choisissez un adversaire avec les flèches haut ou bas.");
            return;
        }
        Optional<DameNatureGameplayPanel.CardOption> card = gameplayPanel.selectedCard();
        if (card.isEmpty()) {
            view.announce("Choisissez une carte avec les flèches gauche ou droite.");
            return;
        }
        DameNatureGameplayPanel.PlayerOption player = target.get();
        DameNatureGameplayPanel.CardOption cardOption = card.get();
        handleActionFeedback(
                controller.askCard(player.id(), cardOption.familyId(), cardOption.memberId()),
                "Demande de " + cardOption.memberName() + " à " + player.displayName() + "...",
                null,
                null
        );
    }

    public void triggerDraw() {
        handleActionFeedback(controller.draw(), "Pioche en cours...", null, null);
    }

    public void answerQuiz(int index) {
        List<String> choices = gameplayPanel.currentQuizChoices();
        if (choices.isEmpty()) {
            view.announce("Aucun quiz à répondre.");
            return;
        }
        if (index < 0 || index >= choices.size()) {
            view.announce("Choix invalide.");
            return;
        }
        handleActionFeedback(
                controller.answerQuiz(index),
                "Réponse " + (index + 1) + " envoyée.",
                null,
                null
        );
    }

    public void announceCurrentTurn() {
        if (currentSession == null) {
            view.announce("Aucune partie active.");
            return;
        }
        DameNatureState state = currentSession.state();
        List<DameNatureState.Player> players = state.players();
        if (players.isEmpty() || state.turnIndex() < 0 || state.turnIndex() >= players.size()) {
            view.announce("Tour inconnu.");
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
            view.announce("Aucune partie en cours.");
            return;
        }
        DameNatureState state = currentSession.state();
        List<DameNatureState.Player> players = state != null ? state.players() : null;
        if (players == null || players.isEmpty()) {
            view.announce("Aucun joueur autour de la table.");
            return;
        }
        DameNatureState.Player selfPlayer = currentSession.self();
        String selfUsername = selfPlayer != null ? selfPlayer.username() : null;
        StringBuilder builder = new StringBuilder();
        builder.append("Table de ").append(players.size())
                .append(players.size() > 1 ? " joueurs : " : " joueur : ");
        for (int i = 0; i < players.size(); i++) {
            DameNatureState.Player player = players.get(i);
            String name = player != null ? player.username() : null;
            String display = (name == null || name.isBlank()) ? "Joueur " + (i + 1) : name;
            if (selfUsername != null && name != null && name.equalsIgnoreCase(selfUsername)) {
                display = display + " (vous)";
            }
            if (player != null && player.isBot()) {
                display = display + " (bot)";
            }
            builder.append(display);
            if (i < players.size() - 1) {
                builder.append(", ");
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
        handleActionFeedback(controller.refresh(), "Actualisation en cours...", null, null);
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
                        ? "Action impossible."
                        : message);
                if (onError != null) {
                    onError.accept(cause);
                }
            } else if (session != null) {
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
        return "Action effectuée.";
    }

    private static String decorateBot(String base, boolean isBot) {
        if (base == null || base.isBlank()) {
            return isBot ? "Bot" : "";
        }
        return isBot ? base + " (bot)" : base;
    }
}
