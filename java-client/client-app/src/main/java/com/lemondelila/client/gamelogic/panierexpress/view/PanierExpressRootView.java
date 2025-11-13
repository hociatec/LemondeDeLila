package com.lemondelila.client.gamelogic.panierexpress.view;

import com.lemondelila.client.gamelogic.panierexpress.controller.PanierExpressController;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressGameOptions;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressState;
import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.catalogue.service.GameRulesService;
import com.lemondelila.client.framework.access.NarrationQueue;
import com.lemondelila.client.framework.access.game.AccessibilityService;
import com.lemondelila.client.framework.access.game.GameHistoryTracker;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.game.controller.GameInteractionController;

import javax.accessibility.AccessibleContext;
import javax.swing.AbstractAction;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
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
    private static final GameSummary GAME_SUMMARY = new GameSummary(
            "panier-express",
            "Panier Express",
            1,
            4,
            "panierexpress",
            "Remplissez votre panier plus vite que vos adversaires.",
            true,
            List.of("jeux-de-plateau")
    );

    private final PanierExpressController controller;
    private final Supplier<NarrationQueue> narrationQueueSupplier;
    private final ClientSession clientSession;
    private final PanierExpressVoiceFeedback voiceFeedback;
    private final DialogService dialogService;
    private final GameInteractionController interactionController;
    private final AccessibilityService accessibilityService;
    private final AccessibleShortcutRegistry shortcutRegistry;
    private final GameHistoryTracker historyTracker = new GameHistoryTracker();
    private final JLabel screenReaderBridge = new JLabel();
    private String lastScreenReaderMessage = "";
    private boolean screenReaderToggle;

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
                                 DialogService dialogService,
                                 GameRulesService rulesService,
                                 AccessibilityService accessibilityService,
                                 AccessibleShortcutRegistry shortcutRegistry) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.narrationQueueSupplier = Objects.requireNonNull(narrationQueueSupplier, "narrationQueueSupplier");
        this.clientSession = Objects.requireNonNull(clientSession, "clientSession");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.accessibilityService = Objects.requireNonNull(accessibilityService, "accessibilityService");
        this.shortcutRegistry = Objects.requireNonNull(shortcutRegistry, "shortcutRegistry");
        SoundEffectManager validatedSoundManager = Objects.requireNonNull(soundManager, "soundManager");
        this.voiceFeedback = new PanierExpressVoiceFeedback(
                narrationQueueSupplier,
                validatedSoundManager,
                () -> screenReaderBridge
        );
        historyTracker.setMaxEntries(400);
        this.interactionController = new GameInteractionController(
                this,
                dialogService,
                Objects.requireNonNull(rulesService, "rulesService"),
                () -> Optional.of(GAME_SUMMARY),
                this::handleCancel,
                this::handleInteractionStatus,
                this::addBotCommand,
                this::removeBotCommand
        );
        interactionController.setEnabled(false);

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
        screenReaderBridge.setFocusable(false);
        screenReaderBridge.setOpaque(false);
        screenReaderBridge.setForeground(getBackground());
        screenReaderBridge.setVisible(true);
        Dimension hiddenSize = new Dimension(1, 1);
        screenReaderBridge.setPreferredSize(hiddenSize);
        screenReaderBridge.setMinimumSize(hiddenSize);
        screenReaderBridge.setMaximumSize(hiddenSize);
        screenReaderBridge.setText(" ");
        screenReaderBridge.getAccessibleContext().setAccessibleName("Annonces Panier Express");
        add(cardPanel, BorderLayout.CENTER);
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
        this(controller,
                () -> context.get(NarrationQueue.class),
                clientSession,
                soundManager,
                dialogService,
                context.get(GameRulesService.class),
                context.get(AccessibilityService.class),
                context.get(AccessibleShortcutRegistry.class));
    }

    private void installShortcuts() {
        shortcutRegistry.clear();
        registerShortcut("ESCAPE", "panier.esc.disabled", "Échap : aucune action durant la partie.", e -> narrate("Échap est désactivé pendant la partie. Utilisez Q pour quitter."));
        registerShortcut("TAB", "panier.focus.history", "Tab : consulter l’historique de la partie.", e -> focusHistory());
        registerShortcut("shift TAB", "panier.focus.main", "Maj+Tab : revenir à la zone principale.", e -> focusMainArea());
        registerShortcut("ENTER", "panier.execute", "Entrée : action principale (lancer ou confirmer).", e -> executePrimaryAction());
        registerLetterShortcut('l', "panier.roll", "Lettre L : lancer le dé.", e -> attemptRoll());
        registerLetterShortcut('r', "panier.refresh", "Lettre R : actualiser l’état de la partie.", e -> attemptRefresh());
        registerLetterShortcut('t', "panier.turn", "Lettre T : annoncer le tour en cours.", e -> announceCurrentTurn());
        registerLetterShortcut('s', "panier.score", "Lettre S : annoncer le score courant.", e -> announceScore());
        registerLetterShortcut('p', "panier.basket", "Lettre P : annoncer le contenu de votre panier.", e -> announceBasket());
        registerLetterShortcut('x', "panier.restart", "Lettre X : proposer de redémarrer la partie.", e -> promptRestart());
        registerLetterShortcut('w', "panier.players", "Lettre W : annoncer les joueurs présents.", e -> announcePlayers());
        registerLetterShortcut('q', "panier.quit", "Lettre Q : quitter Panier Express après confirmation.", e -> {
            if (screenManager == null) {
                return;
            }
            dialogService.confirmGameExit("Panier Express", "Voulez-vous quitter la partie en cours ?")
                    .thenAccept(confirmed -> {
                        if (Boolean.TRUE.equals(confirmed)) {
                            controller.reset();
                            SwingUtilities.invokeLater(() -> screenManager.show("catalog"));
                        } else {
                            narrate("Sortie annulée.");
                        }
                    });
        });

        for (int digit = 0; digit < 4; digit++) {
            final int answerIndex = digit;
            registerShortcut((char) ('1' + digit), "panier.quiz." + digit, "Chiffre " + (digit + 1) + " : répondre au quiz.", e -> submitQuizAnswer(answerIndex));
        }
        shortcutRegistry.applyTo(this);
    }

    private void registerShortcut(char key, String actionId, String description, java.util.function.Consumer<ActionEvent> handler) {
        registerShortcut(KeyStroke.getKeyStroke(key), actionId, description, handler);
    }

    private void registerShortcut(char key, String actionId, java.util.function.Consumer<ActionEvent> handler) {
        registerShortcut(key, actionId, null, handler);
    }

    private void registerShortcut(String keyStroke, String actionId, String description, java.util.function.Consumer<ActionEvent> handler) {
        registerShortcut(KeyStroke.getKeyStroke(keyStroke), actionId, description, handler);
    }

    private void registerShortcut(String keyStroke, String actionId, java.util.function.Consumer<ActionEvent> handler) {
        registerShortcut(keyStroke, actionId, null, handler);
    }

    private void registerShortcut(KeyStroke stroke, String actionId, String description, java.util.function.Consumer<ActionEvent> handler) {
        if (stroke == null || handler == null) {
            return;
        }
        bindShortcut(this, stroke, actionId, handler);
        bindShortcut(cardPanel, stroke, actionId, handler);
        if (description != null && !description.isBlank()) {
            shortcutRegistry.register(stroke, description);
        }
    }

    private void registerLetterShortcut(char letter, String actionId, String description, java.util.function.Consumer<ActionEvent> handler) {
        char lower = Character.toLowerCase(letter);
        char upper = Character.toUpperCase(letter);
        registerShortcut(lower, actionId, description, handler);
        if (upper != lower) {
            registerShortcut(upper, actionId, description, handler);
        }
    }

    private void bindShortcut(JComponent component, KeyStroke stroke, String actionId, java.util.function.Consumer<ActionEvent> handler) {
        component.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW).put(stroke, actionId);
        component.getActionMap().put(actionId, new AbstractAction() {
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
        dialogService.attach(this);
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
        interactionController.setEnabled(true);
    }

    @Override
    public void onHide(ScreenContext context) {
        controller.removeSessionListener(sessionListener);
        interactionController.setEnabled(false);
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

        updateHistory(state.log());
        gamePanel.updateHistory(historyTracker, "Aucun évènement pour le moment.");

        voiceFeedback.handleStateUpdate(state, selfOpt);
    }

    private String buildStatusText(PanierExpressState state, Optional<PanierExpressState.Player> currentOpt) {
        if (state.isFinished()) {
            String winner = "?";
            if (state.winnerId() != null) {
                winner = state.players().stream()
                        .filter(player -> player.id() == state.winnerId())
                        .findFirst()
                        .map(this::formatPlayerName)
                        .orElse("Un joueur");
            }
            return "Partie terminée. Vainqueur : " + winner + '.';
        }
        String turnPlayer = currentOpt.map(this::formatPlayerName).orElse("?");
        if (state.lastRoll() != null) {
            return "Tour de " + turnPlayer + " — dernier dé : " + state.lastRoll();
        }
        return "Tour de " + turnPlayer;
    }

    private String buildPendingText(PanierExpressState state, boolean pendingForYou) {
        PanierExpressState.PendingQuiz pending = state.pending();
        if (pending == null) {
            return busy ? "Traitement d’une action en cours..." : " ";
        }
        String waitingPlayer = state.players().stream()
                .filter(player -> player.id() == pending.playerId())
                .findFirst()
                .map(this::formatPlayerName)
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
            String decorated = formatPlayerName(player);
            builder.append(decorated);
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
            builder.append(formatPlayerName(player))
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
                    .findFirst()
                    .map(this::formatPlayerName)
                    .orElse("Un joueur"));
        }
        return builder.toString().strip();
    }

    private String formatPlayerName(PanierExpressState.Player player) {
        if (player == null) {
            return "Joueur inconnu";
        }
        String name = player.username();
        if (name == null || name.isBlank()) {
            name = "Joueur " + player.id();
        }
        return player.isBot() ? name + " (bot)" : name;
    }

    private void updateHistory(List<PanierExpressState.LogEntry> entries) {
        historyTracker.clear();
        if (entries == null || entries.isEmpty()) {
            return;
        }
        for (PanierExpressState.LogEntry entry : entries) {
            String message = entry.message();
            if (message != null && !message.isBlank()) {
                historyTracker.add(message);
            }
        }
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
            narrate("Répondez d’abord au quiz.");
            return;
        }
        if (!lastYourTurn) {
            narrate("Ce n’est pas votre tour.");
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
            accessibilityService.announceCustom(screenReaderBridge, "Aucune partie active.");
            return;
        }
        PanierExpressState state = lastSession.state();
        if (state.isFinished()) {
            accessibilityService.announceCustom(screenReaderBridge, "La partie est terminée.");
            return;
        }
        Optional<PanierExpressState.Player> currentOpt = state.currentPlayer();
        if (currentOpt.isEmpty()) {
            accessibilityService.announceCustom(screenReaderBridge, "Tour inconnu.");
            return;
        }
        String reminder = voiceFeedback.announceTurnReminder(state, lastYourTurn);
        narrate(reminder);
        String playerName = currentOpt.map(this::formatPlayerName).orElse(null);
        AccessibilityService.TurnContext turnEvent = new AccessibilityService.TurnContext(
                lastYourTurn,
                playerName,
                state.lastRoll()
        );
        String turnMessage = accessibilityService.announceTurn(screenReaderBridge, turnEvent);
        updateTurnAnnouncement(turnMessage, true, 0);
    }

    private void announceScore() {
        String message = (cachedScoreSummary == null || cachedScoreSummary.isBlank())
                ? "Le score n’est pas disponible pour le moment."
                : cachedScoreSummary;
        gamePanel.announceScore(message);
        accessibilityService.announceCustom(screenReaderBridge, message);
    }

    private void announceBasket() {
        if (lastSession == null) {
            String message = "Aucune partie active.";
            gamePanel.announceBasket(message);
            accessibilityService.announceCustom(screenReaderBridge, message);
            return;
        }
        String username = currentUsername();
        if (username == null || username.isBlank()) {
            String message = "Connectez-vous pour consulter votre panier.";
            gamePanel.announceBasket(message);
            accessibilityService.announceCustom(screenReaderBridge, message);
            return;
        }
        Optional<PanierExpressState.Player> selfOpt = lastSession.state().findPlayerByUsername(username);
        if (selfOpt.isEmpty()) {
            String message = "Impossible de trouver votre joueur dans la partie.";
            gamePanel.announceBasket(message);
            accessibilityService.announceCustom(screenReaderBridge, message);
            return;
        }
        PanierExpressState.Player self = selfOpt.get();
        List<String> shoppingList = self.shoppingList() == null ? List.of() : self.shoppingList();
        List<String> basketItems = self.basket() == null ? List.of() : self.basket();
        List<String> missing = computeMissingItems(shoppingList, basketItems);
        AccessibilityService.BasketContext event = new AccessibilityService.BasketContext(
                true,
                basketItems.size(),
                shoppingList.size(),
                missing,
                self.inventory() == null ? List.of() : self.inventory(),
                self.readyForCheckout()
        );
        String message = accessibilityService.announceBasket(screenReaderBridge, event);
        gamePanel.announceBasket(message);
    }

    private void announcePlayers() {
        if (lastSession == null) {
            narrate("Aucune partie active.");
            return;
        }
        PanierExpressState state = lastSession.state();
        List<PanierExpressState.Player> players = state != null ? state.players() : null;
        if (players == null || players.isEmpty()) {
            narrate("Aucun joueur autour de la table.");
            return;
        }
        String currentName = currentUsername();
        StringBuilder builder = new StringBuilder();
        builder.append("Table de ").append(players.size())
                .append(players.size() > 1 ? " joueurs : " : " joueur : ");
        for (int i = 0; i < players.size(); i++) {
            PanierExpressState.Player player = players.get(i);
            String name = player != null ? player.username() : null;
            String display = (name == null || name.isBlank()) ? "Joueur " + (i + 1) : name;
            if (currentName != null && name != null && name.equalsIgnoreCase(currentName)) {
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
        narrate(builder.toString());
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

    private CompletableFuture<Void> addBotCommand() {
        return controller.addBot().thenApply(session -> null);
    }

    private CompletableFuture<Void> removeBotCommand() {
        return controller.removeBot().thenApply(session -> null);
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

    private List<String> computeMissingItems(List<String> shoppingList, List<String> basket) {
        List<String> missing = new ArrayList<>();
        for (String item : shoppingList) {
            if (item == null || item.isBlank()) {
                continue;
            }
            if (!basket.contains(item)) {
                missing.add(item);
            }
        }
        return missing;
    }

    private void narrate(String message) {
        announceForScreenReader(message);
        try {
            NarrationQueue queue = narrationQueueSupplier.get();
            if (queue != null) {
                queue.enqueue(screenReaderBridge, message);
            }
        } catch (Exception ignored) {
        }
    }

    private void handleInteractionStatus(String message) {
        if (message == null || message.isBlank()) {
            return;
        }
        narrate(message);
    }

    private void announceForScreenReader(String message) {
        if (message == null || message.isBlank()) {
            return;
        }
        String payload = message;
        if (message.equals(lastScreenReaderMessage)) {
            screenReaderToggle = !screenReaderToggle;
            payload = message + (screenReaderToggle ? " \u200B" : " \u200C");
        } else {
            screenReaderToggle = false;
        }
        lastScreenReaderMessage = payload;
        AccessibleContext context = screenReaderBridge.getAccessibleContext();
        if (context == null) {
            return;
        }
        final String textPayload = payload;
        Runnable fire = () -> {
            screenReaderBridge.setText(textPayload);
            context.setAccessibleDescription(textPayload);
            context.firePropertyChange(
                    AccessibleContext.ACCESSIBLE_TEXT_PROPERTY,
                    null,
                    textPayload
            );
            context.firePropertyChange(
                    AccessibleContext.ACCESSIBLE_NAME_PROPERTY,
                    null,
                    textPayload
            );
            context.firePropertyChange(
                    AccessibleContext.ACCESSIBLE_DESCRIPTION_PROPERTY,
                    null,
                    textPayload
            );
            context.firePropertyChange(
                    AccessibleContext.ACCESSIBLE_VISIBLE_DATA_PROPERTY,
                    null,
                    textPayload
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
