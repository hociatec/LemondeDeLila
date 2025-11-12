package com.lemondelila.client.gamelogic.panierexpress.view;

import com.lemondelila.client.gamelogic.panierexpress.controller.PanierExpressController;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressGameOptions;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressState;
import com.lemondelila.client.model.user.ClientSession;
import com.lemondelila.framework.access.NarrationQueue;
import com.lemondelila.framework.core.context.ApplicationContext;
import com.lemondelila.framework.core.di.Inject;
import com.lemondelila.framework.media.sound.SoundEffectManager;
import com.lemondelila.framework.ui.dialog.DialogService;
import com.lemondelila.framework.ui.screen.Screen;
import com.lemondelila.framework.ui.screen.ScreenContext;
import com.lemondelila.framework.ui.screen.ScreenManager;

import javax.accessibility.AccessibleContext;
import javax.swing.AbstractAction;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.event.ActionEvent;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;

/**
 * Orchestrateur principal de l'interface Panier Express.
 */
public final class PanierExpressRootView extends JPanel implements Screen {

    private static final String CARD_SETUP = "setup";
    private static final String CARD_GAME = "game";
    private static final int LOG_HISTORY_LIMIT = 12;

    private final PanierExpressController controller;
    private final Supplier<NarrationQueue> narrationQueueSupplier;
    private final ClientSession clientSession;
    private final PanierExpressVoiceFeedback voiceFeedback;
    private final DialogService dialogService;
    private final JLabel screenReaderBridge = new JLabel();
    private String lastScreenReaderMessage = "";

    private final CardLayout cardLayout = new CardLayout();
    private final JPanel cardPanel = new JPanel(cardLayout);
    private final PanierExpressSetupPanel setupPanel;
    private final PanierExpressGamePanel gamePanel;

    private ScreenManager screenManager;

    private PanierExpressSession lastSession;
    private boolean busy;
    private boolean lastFinished;
    private boolean lastYourTurn;
    private boolean lastPendingForYou;
    private PanierExpressGameOptions lastUsedOptions = PanierExpressGameOptions.defaults();

    private String lastTurnAnnouncement = "";
    private String cachedScoreSummary = "";

    private final java.util.function.Consumer<PanierExpressSession> sessionListener = this::applySession;

    public PanierExpressRootView(PanierExpressController controller,
                                 Supplier<NarrationQueue> narrationQueueSupplier,
                                 ClientSession clientSession,
                                 SoundEffectManager soundManager,
                                 DialogService dialogService) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.narrationQueueSupplier = Objects.requireNonNull(narrationQueueSupplier, "narrationQueueSupplier");
        this.clientSession = Objects.requireNonNull(clientSession, "clientSession");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        SoundEffectManager validatedSoundManager = Objects.requireNonNull(soundManager, "soundManager");
        this.voiceFeedback = new PanierExpressVoiceFeedback(
                narrationQueueSupplier,
                validatedSoundManager,
                () -> PanierExpressRootView.this
        );

        this.setupPanel = new PanierExpressSetupPanel(new PanierExpressSetupPanel.Listener() {
            @Override
            public void onStart(PanierExpressGameOptions options) {
                startGameWithOptions(options, false);
            }

            @Override
            public void onCancel() {
                handleCancel();
            }
        });
        this.gamePanel = new PanierExpressGamePanel();

        cardPanel.setLayout(cardLayout);
        cardPanel.add(setupPanel, CARD_SETUP);
        cardPanel.add(gamePanel, CARD_GAME);

        setLayout(new BorderLayout());
        add(cardPanel, BorderLayout.CENTER);
        screenReaderBridge.setVisible(false);
        screenReaderBridge.getAccessibleContext().setAccessibleName("Annonces Panier Express");
        add(screenReaderBridge, BorderLayout.SOUTH);

        setFocusable(true);
        setRequestFocusEnabled(true);

        installShortcuts();
    }

    @Inject
    public PanierExpressRootView(PanierExpressController controller,
                                 ApplicationContext context,
                                 ClientSession clientSession,
                                 SoundEffectManager soundManager,
                                 DialogService dialogService) {
        this(controller, () -> context.get(NarrationQueue.class), clientSession, soundManager, dialogService);
    }

    private void installShortcuts() {
        registerShortcut("ESCAPE", "panier.back", e -> handleCancel());
        registerShortcut("TAB", "panier.focus.history", e -> focusHistory());
        registerShortcut("shift TAB", "panier.focus.main", e -> focusMainArea());
        registerShortcut("ENTER", "panier.execute", e -> executePrimaryAction());
        registerShortcut("SPACE", "panier.roll", e -> attemptRoll());
        registerShortcut('L', "panier.roll", e -> attemptRoll());
        registerShortcut('l', "panier.roll", e -> attemptRoll());
        registerShortcut('R', "panier.refresh", e -> attemptRefresh());
        registerShortcut('r', "panier.refresh", e -> attemptRefresh());
        registerShortcut('T', "panier.turn", e -> announceCurrentTurn());
        registerShortcut('t', "panier.turn", e -> announceCurrentTurn());
        registerShortcut('S', "panier.score", e -> announceScore());
        registerShortcut('s', "panier.score", e -> announceScore());
        registerShortcut('P', "panier.basket", e -> announceBasket());
        registerShortcut('p', "panier.basket", e -> announceBasket());
        registerShortcut('X', "panier.restart", e -> promptRestart());
        registerShortcut('x', "panier.restart", e -> promptRestart());

        for (int digit = 0; digit < 4; digit++) {
            final int answerIndex = digit;
            registerShortcut((char) ('1' + digit), "panier.quiz." + digit, e -> submitQuizAnswer(answerIndex));
        }
    }

    private void registerShortcut(char key, String actionId, java.util.function.Consumer<ActionEvent> handler) {
        registerShortcut(KeyStroke.getKeyStroke(key), actionId, handler);
    }

    private void registerShortcut(String keyStroke, String actionId, java.util.function.Consumer<ActionEvent> handler) {
        registerShortcut(KeyStroke.getKeyStroke(keyStroke), actionId, handler);
    }

    private void registerShortcut(KeyStroke stroke, String actionId, java.util.function.Consumer<ActionEvent> handler) {
        if (stroke == null || handler == null) {
            return;
        }
        getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW).put(stroke, actionId);
        getActionMap().put(actionId, new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                handler.accept(e);
            }
        });
    }

    @Override
    public String id() {
        return "panier-express";
    }

    @Override
    public JPanel getComponent() {
        return this;
    }

    @Override
    public void onShow(ScreenContext context) {
        this.screenManager = context.screenManager();
        controller.addSessionListener(sessionListener);
        Optional<PanierExpressSession> current = controller.currentSession();
        if (current.isPresent()) {
            showGameCard();
            applySession(current.get());
        } else {
            showSetupCard();
            SwingUtilities.invokeLater(setupPanel::focusFirstComponent);
        }
        requestFocusInWindow();
    }

    @Override
    public void onHide(ScreenContext context) {
        controller.removeSessionListener(sessionListener);
    }

    private void applySession(PanierExpressSession session) {
        PanierExpressSession previousSession = this.lastSession;
        this.lastSession = session;
        if (previousSession == null || previousSession.roomId() != session.roomId()) {
            voiceFeedback.resetForNewSession();
        }

        PanierExpressState state = session.state();
        String username = currentUsername();

        Optional<PanierExpressState.Player> selfOpt = username == null
                ? Optional.empty()
                : state.findPlayerByUsername(username);
        Optional<PanierExpressState.Player> currentOpt = state.currentPlayer();

        boolean isFinished = state.isFinished();
        boolean isYourTurn = currentOpt.map(player -> username != null && username.equalsIgnoreCase(player.username())).orElse(false);
        boolean pendingForYou = state.pending() != null && selfOpt.map(player -> player.id() == state.pending().playerId()).orElse(false);

        lastFinished = isFinished;
        lastYourTurn = isYourTurn;
        lastPendingForYou = pendingForYou;

        showGameCard();

        String statusText = buildStatusText(state, currentOpt);
        gamePanel.updateStatus(statusText, statusText);

        boolean shouldNarrateStatus = !isYourTurn || isFinished || (state.pending() != null && !pendingForYou);
        voiceFeedback.announceStatus(statusText, shouldNarrateStatus);
        updateTurnAnnouncement(statusText, false, 0);

        String pendingText = buildPendingText(state, pendingForYou);
        gamePanel.updatePending(pendingText);

        if (state.pending() != null) {
            PanierExpressState.PendingQuiz pending = state.pending();
            gamePanel.showQuiz(pending.question(), pending.choices());
            voiceFeedback.handleQuiz(pending, pendingForYou);
        } else {
            gamePanel.hideQuiz();
            voiceFeedback.handleQuiz(null, false);
        }

        gamePanel.updateYourProgress(buildYourProgress(selfOpt.orElse(null)));
        gamePanel.updatePlayers(buildPlayersProgress(state, username));

        cachedScoreSummary = buildScoreSummary(state);
        gamePanel.updateScore(cachedScoreSummary);

        String historyText = buildHistory(state.log());
        gamePanel.setHistory(historyText, historyText);

        voiceFeedback.handleStateUpdate(state, selfOpt);
    }

    private String buildStatusText(PanierExpressState state, Optional<PanierExpressState.Player> currentOpt) {
        if (state.isFinished()) {
            String winner = "?";
            if (state.winnerId() != null) {
                winner = state.players().stream()
                        .filter(player -> player.id() == state.winnerId())
                        .map(PanierExpressState.Player::username)
                        .findFirst()
                        .orElse("Un joueur");
            }
            return "Partie terminée. Vainqueur : " + winner + '.';
        }
        String turnPlayer = currentOpt.map(PanierExpressState.Player::username).orElse("?");
        if (state.lastRoll() != null) {
            return "Tour de " + turnPlayer + " — dernier dé : " + state.lastRoll();
        }
        return "Tour de " + turnPlayer;
    }

    private String buildPendingText(PanierExpressState state, boolean pendingForYou) {
        PanierExpressState.PendingQuiz pending = state.pending();
        if (pending == null) {
            return busy ? "Traitement d'une action en cours..." : " ";
        }
        String waitingPlayer = state.players().stream()
                .filter(player -> player.id() == pending.playerId())
                .map(PanierExpressState.Player::username)
                .findFirst()
                .orElse("Un joueur");
        if (pendingForYou) {
            return "Un quiz vous attend. Sélectionnez une proposition avec les touches 1 à 4 puis validez avec Entrée.";
        }
        return waitingPlayer + " répond à un quiz...";
    }

    private String buildYourProgress(PanierExpressState.Player self) {
        if (self == null) {
            return "Connectez-vous pour suivre votre progression personnelle.";
        }
        StringBuilder builder = new StringBuilder();
        builder.append("Position : ").append(self.position()).append(" / 40\n");
        builder.append("Articles validés : ").append(self.basket().size()).append(" / ").append(self.shoppingList().size()).append('\n');
        if (self.readyForCheckout()) {
            builder.append("Vous êtes prêt pour la caisse.\n");
        }
        builder.append('\n').append("Liste de courses :\n");
        for (String item : self.shoppingList()) {
            boolean hasItem = self.basket().contains(item);
            builder.append(hasItem ? "✔ " : "- ").append(item).append('\n');
        }
        if (!self.inventory().isEmpty()) {
            builder.append("\nRéserve pour échanges :\n");
            for (String item : self.inventory()) {
                builder.append("• ").append(item).append('\n');
            }
        }
        if (self.skipTurns() > 0) {
            builder.append("\nTours à passer : ").append(self.skipTurns());
        }
        return builder.toString().strip();
    }

    private String buildPlayersProgress(PanierExpressState state, String username) {
        StringBuilder builder = new StringBuilder();
        for (PanierExpressState.Player player : state.players()) {
            builder.append(player.username());
            if (username != null && username.equalsIgnoreCase(player.username())) {
                builder.append(" (vous)");
            }
            builder.append(" — case ").append(player.position());
            builder.append(" — panier ").append(player.basket().size()).append('/').append(player.shoppingList().size());
            if (player.readyForCheckout()) {
                builder.append(" — prêt pour la caisse");
            }
            if (player.skipTurns() > 0) {
                builder.append(" — saute ").append(player.skipTurns()).append(" tour(s)");
            }
            builder.append('\n');
        }
        return builder.toString().strip();
    }

    private String buildScoreSummary(PanierExpressState state) {
        StringBuilder builder = new StringBuilder();
        for (PanierExpressState.Player player : state.players()) {
            builder.append(player.username())
                    .append(" : ")
                    .append(player.basket().size())
                    .append('/')
                    .append(player.shoppingList().size())
                    .append(" articles — position ")
                    .append(player.position());
            if (player.readyForCheckout()) {
                builder.append(" — prêt pour la caisse");
            }
            builder.append('\n');
        }
        if (state.isFinished() && state.winnerId() != null) {
            builder.append("\nVainqueur : ");
            builder.append(state.players().stream()
                    .filter(p -> p.id() == state.winnerId())
                    .map(PanierExpressState.Player::username)
                    .findFirst()
                    .orElse("Un joueur"));
        }
        return builder.toString().strip();
    }

    private String buildHistory(List<PanierExpressState.LogEntry> entries) {
        if (entries == null || entries.isEmpty()) {
            return "Aucun évènement pour le moment.";
        }
        int start = Math.max(0, entries.size() - LOG_HISTORY_LIMIT);
        StringBuilder builder = new StringBuilder();
        for (int i = start; i < entries.size(); i++) {
            PanierExpressState.LogEntry entry = entries.get(i);
            builder.append("• ").append(entry.message()).append('\n');
        }
        return builder.toString().strip();
    }

    private void startGameWithOptions(PanierExpressGameOptions options, boolean fromShortcut) {
        if (busy) {
            narrate("Action déjà en cours. Patientez.");
            return;
        }
        PanierExpressGameOptions effective = options == null ? PanierExpressGameOptions.defaults() : options;
        lastUsedOptions = effective;
        showGameCard();
        String message = fromShortcut ? "Nouvelle partie en préparation..." : "Initialisation de la partie Panier Express...";
        performAsync(controller.startGame(true, effective), message);
    }

    private void attemptRoll() {
        if (busy) {
            narrate("Action déjà en cours. Patientez.");
            return;
        }
        if (lastSession == null) {
            narrate("Aucune partie active.");
            return;
        }
        if (lastFinished) {
            narrate("La partie est terminée.");
            return;
        }
        if (lastPendingForYou) {
            narrate("Répondez d'abord au quiz.");
            return;
        }
        if (!lastYourTurn) {
            narrate("Ce n'est pas votre tour.");
            return;
        }
        performAsync(controller.roll(), "Lancer du dé...");
    }

    private void attemptRefresh() {
        if (busy) {
            narrate("Action déjà en cours. Patientez.");
            return;
        }
        if (lastSession == null) {
            narrate("Aucune partie active.");
            return;
        }
        performAsync(controller.refreshGame(), "Actualisation de la partie...");
    }

    private void attemptNewGame() {
        startGameWithOptions(lastUsedOptions, true);
    }

    private void promptRestart() {
        if (busy) {
            String message = "Action déjà en cours. Patientez.";
            narrate(message);
            return;
        }
        if (lastSession == null) {
            String message = "Aucune partie active à relancer.";
            narrate(message);
            return;
        }
        dialogService.confirm("Relancer Panier Express", "Souhaitez-vous relancer la partie en cours ?")
                .thenAccept(accepted -> {
                    if (Boolean.TRUE.equals(accepted)) {
                        SwingUtilities.invokeLater(() -> startGameWithOptions(lastUsedOptions, true));
                    } else {
                        String message = "Relance annulée.";
                        SwingUtilities.invokeLater(() -> {
                            narrate(message);
                        });
                    }
                });
    }

    private void submitQuizAnswer(int index) {
        if (busy) {
            narrate("Action déjà en cours. Patientez.");
            return;
        }
        if (lastSession == null) {
            narrate("Aucune partie active.");
            return;
        }
        PanierExpressState state = lastSession.state();
        PanierExpressState.PendingQuiz pending = state.pending();
        if (pending == null) {
            narrate("Aucun quiz à répondre.");
            return;
        }
        if (!lastPendingForYou) {
            narrate("Le quiz en cours concerne un autre joueur.");
            return;
        }
        List<String> choices = pending.choices();
        if (index < 0 || index >= choices.size()) {
            narrate("Choix invalide.");
            return;
        }
        performAsync(controller.answerQuiz(index), "Réponse " + (index + 1) + " envoyée...");
    }

    private void announceCurrentTurn() {
        if (lastSession == null) {
            narrate("Aucune partie active.");
            return;
        }
        PanierExpressState state = lastSession.state();
        if (state.isFinished()) {
            narrate("La partie est terminée.");
            return;
        }
        Optional<PanierExpressState.Player> currentOpt = state.currentPlayer();
        if (currentOpt.isEmpty()) {
            narrate("Tour inconnu.");
            return;
        }
        String message = voiceFeedback.announceTurnReminder(state, lastYourTurn);
        updateTurnAnnouncement(message, true, 0);
        announceForScreenReader(message);
    }

    private void announceScore() {
        String message = (cachedScoreSummary == null || cachedScoreSummary.isBlank())
                ? "Le score n'est pas disponible pour le moment."
                : cachedScoreSummary;
        gamePanel.announceScore(message);
        narrate(message);
    }

    private void announceBasket() {
        if (lastSession == null) {
            String message = "Aucune partie active.";
            narrate(message);
            gamePanel.announceBasket(message);
            return;
        }
        String username = currentUsername();
        if (username == null || username.isBlank()) {
            String message = "Connectez-vous pour consulter votre panier.";
            narrate(message);
            gamePanel.announceBasket(message);
            return;
        }
        Optional<PanierExpressState.Player> selfOpt = lastSession.state().findPlayerByUsername(username);
        if (selfOpt.isEmpty()) {
            String message = "Impossible de trouver votre joueur dans la partie.";
            narrate(message);
            gamePanel.announceBasket(message);
            return;
        }
        String message = voiceFeedback.announceBasket(selfOpt.get());
        if (message != null && !message.isBlank()) {
            gamePanel.announceBasket(message);
        }
    }

    private void executePrimaryAction() {
        attemptRoll();
    }

    private void performAsync(CompletableFuture<PanierExpressSession> future, String pendingMessage) {
        if (future == null) {
            return;
        }
        if (pendingMessage != null && !pendingMessage.isBlank()) {
            narrate(pendingMessage);
        }
        setGameBusy(true);
        future.whenComplete((session, error) -> SwingUtilities.invokeLater(() -> {
            setGameBusy(false);
            if (error != null) {
                narrate(resolveErrorMessage(error));
            }
        }));
    }

    private void setGameBusy(boolean value) {
        this.busy = value;
    }

    private void focusHistory() {
        showGameCard();
        gamePanel.focusHistory();
    }

    private void focusMainArea() {
        showGameCard();
        gamePanel.focusMain();
    }

    private void showSetupCard() {
        cardLayout.show(cardPanel, CARD_SETUP);
    }

    private void showGameCard() {
        cardLayout.show(cardPanel, CARD_GAME);
    }

    private void handleCancel() {
        if (screenManager != null) {
            SwingUtilities.invokeLater(() -> screenManager.show("catalog"));
        }
    }

    private void updateTurnAnnouncement(String message, boolean force, int reminderIndex) {
        if (message == null || message.isBlank()) {
            return;
        }
        if (force) {
            lastTurnAnnouncement = "";
        }
        if (force || !message.equals(lastTurnAnnouncement)) {
            lastTurnAnnouncement = message;
            AccessibleContext context = gamePanel.statusAccessibleContext();
            if (context != null) {
                String accessibleName = reminderIndex > 0
                        ? "Statut de la partie, rappel " + reminderIndex
                        : "Statut de la partie";
                String accessibleDescription = reminderIndex > 0
                        ? message + " (rappel " + reminderIndex + ')'
                        : message;
                context.setAccessibleName(accessibleName);
                context.setAccessibleDescription(accessibleDescription);
            }
            SwingUtilities.invokeLater(gamePanel::focusStatusLabel);
        }
    }

    private String resolveErrorMessage(Throwable error) {
        if (error == null) {
            return "Action impossible.";
        }
        Throwable cause = error;
        while (cause.getCause() != null && cause.getCause() != cause) {
            cause = cause.getCause();
        }
        String message = cause.getMessage();
        if (message == null || message.isBlank()) {
            return "Action impossible.";
        }
        return "Erreur : " + message;
    }

    private void narrate(String message) {
        announceForScreenReader(message);
        try {
            NarrationQueue queue = narrationQueueSupplier.get();
            if (queue != null) {
                queue.enqueue(this, message);
            }
        } catch (Exception ignored) {
        }
    }

    private void announceForScreenReader(String message) {
        if (message == null || message.isBlank()) {
            return;
        }
        String payload = message.equals(lastScreenReaderMessage) ? message + " " : message;
        lastScreenReaderMessage = payload;
        AccessibleContext context = screenReaderBridge.getAccessibleContext();
        if (context == null) {
            return;
        }
        Runnable fire = () -> {
            context.setAccessibleDescription(payload);
            context.firePropertyChange(
                    AccessibleContext.ACCESSIBLE_TEXT_PROPERTY,
                    null,
                    payload
            );
        };
        if (SwingUtilities.isEventDispatchThread()) {
            fire.run();
        } else {
            SwingUtilities.invokeLater(fire);
        }
    }

    private String currentUsername() {
        return clientSession.authenticated().map(ClientSession.AuthState::username).orElse(null);
    }
}
