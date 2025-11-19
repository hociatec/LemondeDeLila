package com.lemondelila.client.gamelogic.panierexpress.view;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.catalogue.service.GameRulesService;
import com.lemondelila.client.catalogue.view.CatalogScreen;
import com.lemondelila.client.framework.access.NarrationQueue;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.access.shortcut.ShortcutBinder;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.component.NarrationPanel;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.game.service.GameCommandCenter;
import com.lemondelila.client.game.view.AbstractGameRootView;
import com.lemondelila.client.game.view.AbstractGameRootView.LobbyTexts;
import com.lemondelila.client.game.view.AbstractGameRootView.PlayerDisplayStrings;
import com.lemondelila.client.game.view.GameScreenScaffold;
import com.lemondelila.client.gamelogic.panierexpress.controller.PanierExpressController;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressState;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressState.Player;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.framework.access.game.GameHistoryTracker;

import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JLabel;
import javax.swing.JPanel;
import java.awt.Dimension;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Supplier;

public final class PanierExpressRootView extends AbstractGameRootView<PanierExpressSession> {

    public static final ScreenId ID = ScreenId.of("panier-express");

    private static final GameSummary GAME_SUMMARY = new GameSummary(
            "panier-express",
            Internationalization.text("panierexpress.name"),
            1,
            4,
            "panierexpress",
            Internationalization.text("panierexpress.summary"),
            true,
            List.of("jeux-de-plateau")
    );

    private final PanierExpressController controller;
    private final PanierExpressGamePanel gamePanel;
    private final JPanel setupHeader = new JPanel();
    private final JLabel setupStatusLabel = new JLabel();
    private final JLabel setupHintLabel = new JLabel();
    private final GameHistoryTracker historyTracker = new GameHistoryTracker();
    private boolean launching;

    public PanierExpressRootView(PanierExpressController controller,
                                 Supplier<NarrationQueue> narrationQueueSupplier,
                                 ClientSession clientSession,
                                 DialogService dialogService,
                                 GameRulesService rulesService,
                                 AccessibleShortcutRegistry shortcutRegistry,
                                 GameCommandCenter commandCenter,
                                 NarrationPanel narrationPanel,
                                 PanierExpressGamePanel gamePanel) {
        super(ID,
                GAME_SUMMARY,
                controller,
                narrationQueueSupplier,
                dialogService,
                new GameRulesBridge(
                        rulesService,
                        Internationalization.text("game.shortcut.tab.desc"),
                        Internationalization.text("game.shortcut.shift.tab.desc"),
                        Internationalization.text("game.shortcut.enter.desc")),
                shortcutRegistry,
                commandCenter,
                narrationPanel,
                gamePanel,
                () -> clientSession.authenticated().map(ClientSession.AuthState::username),
                CatalogScreen.ID);
        this.controller = controller;
        this.gamePanel = gamePanel;
        historyTracker.setMaxEntries(200);
        configureSetupHeader();
        setHeaderContent(setupHeader);
        showLobby();
    }

    @Inject
    public PanierExpressRootView(PanierExpressController controller,
                                 ApplicationContext context,
                                 ClientSession clientSession,
                                 DialogService dialogService) {
        this(controller,
                () -> context.get(NarrationQueue.class),
                clientSession,
                dialogService,
                context.get(GameRulesService.class),
                context.get(AccessibleShortcutRegistry.class),
                context.get(GameCommandCenter.class),
                context.get(NarrationPanel.class),
                context.get(PanierExpressGamePanel.class));
    }

    private void configureSetupHeader() {
        setupHeader.setOpaque(false);
        setupHeader.setLayout(new BoxLayout(setupHeader, BoxLayout.Y_AXIS));
        setupStatusLabel.setAlignmentX(JPanel.LEFT_ALIGNMENT);
        setupHintLabel.setAlignmentX(JPanel.LEFT_ALIGNMENT);
        setupHeader.add(setupStatusLabel);
        setupHeader.add(Box.createRigidArea(new Dimension(0, 4)));
        setupHeader.add(setupHintLabel);
    }

    @Override
    protected void configureScaffold(GameScreenScaffold.Builder builder) {
        builder.withTableInfoActions(this::announcePlayers, this::announceCurrentTurn);
    }

    @Override
    protected void configureShortcuts(ShortcutBinder binder) {
        registerChoiceShortcuts(binder,
                4,
                this::submitQuizAnswer,
                this::canAnswerQuiz,
                order -> Internationalization.text("panier.shortcut.quiz.desc", order));
        binder.registerLetter('s',
                "panier.score",
                Internationalization.text("panier.shortcut.s.desc"),
                e -> announceScore(),
                this::hasSessionState);
        binder.registerLetter('p',
                "panier.basket",
                Internationalization.text("panier.shortcut.p.desc"),
                e -> announceBasket(),
                this::hasSessionState);
    }

    @Override
    public JPanel getComponent() {
        return this;
    }

    @Override
    protected void renderSession(PanierExpressSession session) {
        PanierExpressState state = session.state();
        launching = false;
        if (state == null) {
            showLobby();
            return;
        }
        setupStatusLabel.setText(buildStatus(state));
        setupHintLabel.setText(state.isFinished()
                ? Internationalization.text("panier.setup.finished.hint")
                : Internationalization.text("panier.setup.running.hint"));
        gamePanel.updateStatus(buildStatus(state), buildStatus(state));
        gamePanel.updatePending(buildPending(state));
        updateHistory(state);
        gamePanel.updatePlayers(formatPlayers(state));
        gamePanel.updateScore(formatScore(state));
        gamePanel.updateYourProgress(formatSelfProgress(state));
        updateQuiz(state);
    }

    @Override
    protected void onPrimaryAction() {
        if (isSetupPhase()) {
            launchGame(false);
            return;
        }
        if (hasPendingQuizForCurrentPlayer()) {
            narrate(Internationalization.text("panier.quiz.pending"));
            return;
        }
        attemptRoll();
    }

    @Override
    protected void focusHistoryArea() {
        gamePanel.focusHistory();
    }

    @Override
    protected void focusMainArea() {
        gamePanel.focusMain();
    }

    @Override
    protected void onSessionSwitched(PanierExpressSession previous, PanierExpressSession current) {
        historyTracker.clear();
    }

    @Override
    protected void showLobby() {
        launching = false;
        LobbyTexts texts = lobbyTexts();
        resetInfoPanels(gamePanel, texts);
        setupStatusLabel.setText(texts.status());
        setupHintLabel.setText(texts.hint());
        gamePanel.hideQuiz();
        historyTracker.clear();
        gamePanel.updateHistory(historyTracker, texts.emptyHistoryText());
    }

    protected LobbyTexts lobbyTexts() {
        return new LobbyTexts(
                Internationalization.text("panier.setup.status"),
                Internationalization.text("panier.setup.status.desc"),
                Internationalization.text("panier.setup.hint"),
                Internationalization.text("panier.setup.pending"),
                Internationalization.text("panier.history.empty"));
    }

    private void launchGame(boolean forceNew) {
        if (launching) {
            narrate(Internationalization.text("panier.setup.launching"));
            return;
        }
        launching = true;
        controller.startGame(forceNew)
                .whenComplete((session, error) -> launching = false);
    }

    private void attemptRoll() {
        if (!hasActiveSession()) {
            narrate(Internationalization.text("panier.setup.no.session"));
            return;
        }
        controller.roll();
    }

    private void submitQuizAnswer(int choice) {
        if (!canAnswerQuiz()) {
            narrate(Internationalization.text("panier.quiz.none"));
            return;
        }
        controller.answerQuiz(choice);
    }

    private void updateQuiz(PanierExpressState state) {
        PanierExpressState.PendingQuiz pending = state.pending();
        if (pending == null) {
            gamePanel.hideQuiz();
            return;
        }
        gamePanel.showQuiz(pending.question(), pending.choices());
    }

    private void updateHistory(PanierExpressState state) {
        List<String> logs = state.log().stream()
                .map(entry -> entry == null ? "" : entry.message())
                .toList();
        refreshHistory(historyTracker, logs);
        gamePanel.updateHistory(historyTracker, lobbyTexts().emptyHistoryText());
    }

    private String buildStatus(PanierExpressState state) {
        if (state.isFinished()) {
            return state.winnerId() == null
                    ? Internationalization.text("panier.status.finished")
                    : Internationalization.text("panier.status.finished.winner", state.winnerId());
        }
        return state.currentPlayer()
                .map(player -> String.format(Locale.FRENCH,
                        "%s – %s",
                        Internationalization.text("panier.status.round", Math.max(1, state.round())),
                        displayName(player)))
                .orElse(Internationalization.text("panier.status.waiting"));
    }

    private String buildPending(PanierExpressState state) {
        if (state.pending() != null && state.pending().question() != null) {
            return Internationalization.text("panier.pending.quiz");
        }
        if (state.lastRoll() != null) {
            return Internationalization.text("panier.pending.lastRoll", state.lastRoll());
        }
        return Internationalization.text("panier.pending.none");
    }

    private String formatPlayers(PanierExpressState state) {
        if (state.players().isEmpty()) {
            return Internationalization.text("panier.players.none");
        }
        StringBuilder builder = new StringBuilder();
        int index = 1;
        for (Player player : state.players()) {
            if (player == null) {
                continue;
            }
            builder.append(index++).append(". ")
                    .append(displayName(player));
            builder.append(" – ")
                    .append(Internationalization.text("panier.players.position", player.position()))
                    .append(", ")
                    .append(Internationalization.text("panier.players.progress",
                            player.basket().size(),
                            Math.max(1, player.shoppingList().size())));
            if (player.readyForCheckout()) {
                builder.append(", ").append(Internationalization.text("panier.players.checkout"));
            }
            builder.append('\n');
        }
        return builder.toString().strip();
    }

    private String formatScore(PanierExpressState state) {
        if (state.players().isEmpty()) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        state.players().forEach(player -> {
            if (player == null) {
                return;
            }
            builder.append(displayName(player))
                    .append(" : ")
                    .append(player.basket().size())
                    .append(" ")
                    .append(Internationalization.text("panier.score.items"))
                    .append('\n');
        });
        return builder.toString().strip();
    }

    private String formatSelfProgress(PanierExpressState state) {
        Optional<Player> self = findCurrentPlayer(state.players(), Player::username);
        if (self.isEmpty()) {
            return Internationalization.text("panier.players.notjoined");
        }
        Player player = self.get();
        return Internationalization.text("panier.progress.self",
                player.position(),
                player.basket().size(),
                Math.max(1, player.shoppingList().size()),
                player.inventory().size());
    }

    private String displayName(Player player) {
        return formatPlayerLabel(
                player.username(),
                player.isBot(),
                playerLabels());
    }

    private PanierExpressState currentState() {
        return currentSession()
                .map(PanierExpressSession::state)
                .orElse(null);
    }

    private boolean hasActiveSession() {
        return currentState() != null && !currentState().isFinished();
    }

    private boolean hasSessionState() {
        return currentState() != null;
    }

    private boolean isSetupPhase() {
        PanierExpressState state = currentState();
        return state == null || state.isFinished();
    }

    private boolean canAnswerQuiz() {
        PanierExpressState state = currentState();
        if (state == null) {
            return false;
        }
        PanierExpressState.PendingQuiz pending = state.pending();
        if (pending == null) {
            return false;
        }
        return isPendingForCurrentPlayer(state.players(), Player::id, Player::username, pending.playerId());
    }

    private boolean hasPendingQuizForCurrentPlayer() {
        PanierExpressState state = currentState();
        if (state == null || state.pending() == null) {
            return false;
        }
        return isPendingForCurrentPlayer(state.players(), Player::id, Player::username, state.pending().playerId());
    }

    private PlayerDisplayStrings playerLabels() {
        return new PlayerDisplayStrings(
                Internationalization.text("panier.players.you"),
                " (bot)",
                Internationalization.text("panier.players.default"));
    }

    private void announcePlayers() {
        PanierExpressState state = currentState();
        if (state == null) {
            narrate(Internationalization.text("panier.players.none"));
            return;
        }
        narrate(formatPlayers(state));
    }

    private void announceCurrentTurn() {
        PanierExpressState state = currentState();
        if (state == null) {
            narrate(Internationalization.text("panier.status.waiting"));
            return;
        }
        narrate(buildStatus(state));
    }

    private void announceScore() {
        PanierExpressState state = currentState();
        if (state == null) {
            narrate(Internationalization.text("panier.players.none"));
            return;
        }
        String score = formatScore(state);
        if (score.isBlank()) {
            narrate(Internationalization.text("panier.players.none"));
            return;
        }
        gamePanel.announceScore(score);
    }

    private void announceBasket() {
        PanierExpressState state = currentState();
        if (state == null) {
            narrate(Internationalization.text("panier.players.notjoined"));
            return;
        }
        String progress = formatSelfProgress(state);
        gamePanel.announceBasket(progress);
    }
}
