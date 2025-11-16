package com.lemondelila.client.gamelogic.panierexpress.presenter;

import com.lemondelila.client.framework.access.game.AccessibilityService;
import com.lemondelila.client.framework.access.game.GameHistoryTracker;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressState;
import com.lemondelila.client.gamelogic.panierexpress.view.PanierExpressGamePanel;
import com.lemondelila.client.gamelogic.panierexpress.view.PanierExpressVoiceFeedback;

import javax.accessibility.AccessibleContext;
import javax.swing.JLabel;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Supplier;

public final class PanierExpressPresenter {

    private final PanierExpressGamePanel gamePanel;
    private final PanierExpressVoiceFeedback voiceFeedback;
    private final AccessibilityService accessibilityService;
    private final JLabel screenReaderBridge;
    private final Supplier<String> usernameSupplier;
    private final Consumer<String> narrator;
    private final GameHistoryTracker historyTracker = new GameHistoryTracker();

    private PanierExpressSession lastSession;
    private boolean lastFinished;
    private boolean lastYourTurn;
    private boolean lastPendingForYou;
    private String cachedScoreSummary = "";
    private String lastTurnAnnouncement = "";

    public PanierExpressPresenter(PanierExpressGamePanel gamePanel,
                                  PanierExpressVoiceFeedback voiceFeedback,
                                  AccessibilityService accessibilityService,
                                  JLabel screenReaderBridge,
                                  Supplier<String> usernameSupplier,
                                  Consumer<String> narrator) {
        this.gamePanel = gamePanel;
        this.voiceFeedback = voiceFeedback;
        this.accessibilityService = accessibilityService;
        this.screenReaderBridge = screenReaderBridge;
        this.usernameSupplier = usernameSupplier;
        this.narrator = narrator;
        historyTracker.setMaxEntries(400);
    }

    public void applySession(PanierExpressSession session) {
        PanierExpressSession previousSession = this.lastSession;
        this.lastSession = session;
        if (previousSession == null || previousSession.roomId() != session.roomId()) {
            voiceFeedback.resetForNewSession();
        }

        PanierExpressState state = session.state();
        String username = usernameSupplier.get();

        Optional<PanierExpressState.Player> selfOpt = username == null
                ? Optional.empty()
                : state.findPlayerByUsername(username);
        Optional<PanierExpressState.Player> currentOpt = state.currentPlayer();

        lastFinished = state.isFinished();
        lastYourTurn = currentOpt.map(player -> username != null && username.equalsIgnoreCase(player.username()))
                .orElse(false);
        lastPendingForYou = state.pending() != null && selfOpt.map(player -> player.id() == state.pending().playerId())
                .orElse(false);

        String statusText = buildStatusText(state, currentOpt);
        gamePanel.updateStatus(statusText, statusText);

        boolean shouldNarrateStatus = !lastYourTurn || lastFinished
                || (state.pending() != null && !lastPendingForYou);
        voiceFeedback.announceStatus(statusText, shouldNarrateStatus);
        updateTurnAnnouncement(statusText, false, 0);

        String pendingText = buildPendingText(state, lastPendingForYou);
        gamePanel.updatePending(pendingText);

        if (state.pending() != null) {
            PanierExpressState.PendingQuiz pending = state.pending();
            gamePanel.showQuiz(pending.question(), pending.choices());
            voiceFeedback.handleQuiz(pending, lastPendingForYou);
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

    public void announcePlayers() {
        if (lastSession == null) {
            narrator.accept("Aucune partie active.");
            return;
        }
        PanierExpressState state = lastSession.state();
        List<PanierExpressState.Player> players = state != null ? state.players() : null;
        if (players == null || players.isEmpty()) {
            narrator.accept("Aucun joueur autour de la table.");
            return;
        }
        String currentName = usernameSupplier.get();
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
        narrator.accept(builder.toString());
    }

    public void announceScore() {
        String message = (cachedScoreSummary == null || cachedScoreSummary.isBlank())
                ? "Le score n’est pas disponible pour le moment."
                : cachedScoreSummary;
        gamePanel.announceScore(message);
        accessibilityService.announceCustom(screenReaderBridge, message);
    }

    public void announceBasket() {
        if (lastSession == null) {
            String message = "Aucune partie active.";
            gamePanel.announceBasket(message);
            accessibilityService.announceCustom(screenReaderBridge, message);
            return;
        }
        String username = usernameSupplier.get();
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

    public void announceCurrentTurn() {
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
        narrator.accept(reminder);
        String playerName = currentOpt.map(this::formatPlayerName).orElse(null);
        AccessibilityService.TurnContext turnEvent = new AccessibilityService.TurnContext(
                lastYourTurn,
                playerName,
                state.lastRoll()
        );
        String turnMessage = accessibilityService.announceTurn(screenReaderBridge, turnEvent);
        updateTurnAnnouncement(turnMessage, true, 0);
    }

    public Optional<PanierExpressSession> currentSession() {
        return Optional.ofNullable(lastSession);
    }

    public boolean hasActiveSession() {
        return lastSession != null;
    }

    public boolean isFinished() {
        return lastFinished;
    }

    public boolean isYourTurn() {
        return lastYourTurn;
    }

    public boolean hasPendingActionForYou() {
        return lastPendingForYou;
    }

    public boolean shouldCoordinateBotTurns() {
        if (lastSession == null) {
            return false;
        }
        PanierExpressState state = lastSession.state();
        if (state == null || state.isFinished()) {
            return false;
        }
        String username = usernameSupplier.get();
        if (username == null || username.isBlank()) {
            return false;
        }
        String coordinator = determineCoordinatorName(state);
        return coordinator != null && coordinator.equalsIgnoreCase(username);
    }

    public void reset() {
        historyTracker.clear();
        cachedScoreSummary = "";
        lastSession = null;
        lastFinished = false;
        lastYourTurn = false;
        lastPendingForYou = false;
        lastTurnAnnouncement = "";
        voiceFeedback.resetForNewSession();
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
            return " ";
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
            if (item == null || item.isBlank()) {
                continue;
            }
            boolean collected = self.basket().contains(item);
            builder.append(collected ? "[X] " : "[ ] ").append(item).append('\n');
        }
        return builder.toString();
    }

    private String buildPlayersProgress(PanierExpressState state, String username) {
        StringBuilder builder = new StringBuilder();
        for (PanierExpressState.Player player : state.players()) {
            if (player == null) {
                continue;
            }
            String name = formatPlayerName(player);
            if (username != null && player.username() != null && player.username().equalsIgnoreCase(username)) {
                name = name + " (vous)";
            }
            builder.append(name)
                    .append(" — panier : ")
                    .append(player.basket().size())
                    .append('/')
                    .append(player.shoppingList().size());
            if (player.readyForCheckout()) {
                builder.append(" — prêt pour la caisse");
            }
            builder.append('\n');
        }
        return builder.toString().strip();
    }

    private String buildScoreSummary(PanierExpressState state) {
        StringBuilder builder = new StringBuilder();
        builder.append("Score actuel :\n");
        if (state.players() == null || state.players().isEmpty()) {
            builder.append("Aucun joueur.");
            return builder.toString();
        }
        for (PanierExpressState.Player player : state.players()) {
            if (player == null) {
                continue;
            }
            builder.append(formatPlayerName(player))
                    .append(" — points : ")
                    .append(player.score())
                    .append('\n');
        }
        if (state.isFinished()) {
            builder.append('\n').append("Partie terminée.");
            if (state.winnerId() != null) {
                builder.append(" Vainqueur : ");
                builder.append(state.players().stream()
                        .filter(p -> p.id() == state.winnerId())
                        .findFirst()
                        .map(this::formatPlayerName)
                        .orElse("Un joueur"));
            }
        }
        return builder.toString().strip();
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

    private String determineCoordinatorName(PanierExpressState state) {
        return state.players().stream()
                .filter(player -> player != null && !player.isBot())
                .map(PanierExpressState.Player::username)
                .filter(name -> name != null && !name.isBlank())
                .min(String::compareToIgnoreCase)
                .orElse(null);
    }
}
