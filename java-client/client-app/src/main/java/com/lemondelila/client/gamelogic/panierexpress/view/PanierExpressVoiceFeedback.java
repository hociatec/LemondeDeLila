package com.lemondelila.client.gamelogic.panierexpress.view;

import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressState;
import com.lemondelila.client.media.SoundBank;
import com.lemondelila.client.framework.access.NarrationQueue;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;

import javax.accessibility.AccessibleContext;
import javax.swing.JComponent;
import javax.swing.SwingUtilities;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * Centralise la narration et les effets sonores liés à Panier Express.
 */
public final class PanierExpressVoiceFeedback {

    private final Supplier<NarrationQueue> narrationQueueSupplier;
    private final SoundEffectManager sounds;
    private final Supplier<JComponent> componentSupplier;
    private boolean accessibleToggle;

    private Integer lastAnnouncedRoll = null;
    private int lastAnnouncedPosition = -1;
    private int lastAnnouncedCollected = -1;
    private String lastAnnouncedTileMessage = "";
    private String lastAnnouncedQuiz = "";
    private boolean logInitialised;
    private int lastLogSize;
    private int turnReminderCounter;

    public PanierExpressVoiceFeedback(Supplier<NarrationQueue> narrationQueueSupplier,
                                      SoundEffectManager sounds,
                                      Supplier<JComponent> componentSupplier) {
        this.narrationQueueSupplier = Objects.requireNonNull(narrationQueueSupplier, "narrationQueueSupplier");
        this.sounds = Objects.requireNonNull(sounds, "sounds");
        this.componentSupplier = Objects.requireNonNull(componentSupplier, "componentSupplier");
    }

    void resetForNewSession() {
        lastAnnouncedRoll = null;
        lastAnnouncedPosition = -1;
        lastAnnouncedCollected = -1;
        lastAnnouncedTileMessage = "";
        lastAnnouncedQuiz = "";
        logInitialised = false;
        lastLogSize = 0;
        turnReminderCounter = 0;
        accessibleToggle = false;
    }

    void announceStatus(String status, boolean speakNow) {
        turnReminderCounter = 0;
        if (speakNow) {
            narrate(status);
        }
    }

    void handleQuiz(PanierExpressState.PendingQuiz pending, boolean pendingForYou) {
        if (pending == null) {
            lastAnnouncedQuiz = "";
            return;
        }
        if (!pendingForYou) {
            lastAnnouncedQuiz = "";
            return;
        }
        String signature = buildQuizSignature(pending);
        if (signature.equals(lastAnnouncedQuiz)) {
            return;
        }
        if (pending.question() != null && !pending.question().isBlank()) {
            narrate(pending.question());
        }
        List<String> choices = pending.choices();
        if (choices != null) {
            for (int i = 0; i < choices.size(); i++) {
                String choice = choices.get(i);
                if (choice == null || choice.isBlank()) {
                    continue;
                }
                narrate("Touche " + (i + 1) + " : " + choice);
            }
        }
        lastAnnouncedQuiz = signature;
    }

    void handleStateUpdate(PanierExpressState state, Optional<PanierExpressState.Player> selfOpt) {
        List<PanierExpressState.LogEntry> logs = state.log() != null ? state.log() : List.of();
        if (!logInitialised) {
            lastLogSize = logs.size();
            logInitialised = true;
        }
        if (selfOpt.isPresent()) {
            PanierExpressState.Player self = selfOpt.get();
            announceRoll(state.lastRoll());
            announcePosition(self, logs);
        } else {
            lastAnnouncedRoll = null;
            lastAnnouncedPosition = -1;
            lastAnnouncedCollected = -1;
            lastAnnouncedTileMessage = "";
        }
        handleAudioFeedback(logs);
    }

    String announceTurnReminder(PanierExpressState state, boolean yourTurn) {
        StringBuilder message = new StringBuilder();
        if (yourTurn) {
            message.append("C’est votre tour.");
        } else {
            String player = state.currentPlayer()
                    .map(this::formatPlayerName)
                    .orElse("un joueur");
            message.append("C’est au tour de ").append(player).append('.');
        }
        if (state.lastRoll() != null) {
            message.append(" Dernier dé : ").append(state.lastRoll()).append('.');
        }
        turnReminderCounter++;
        return message.toString();
    }

    int turnReminderCounter() {
        return turnReminderCounter;
    }

    private void announceRoll(Integer currentRoll) {
        if (currentRoll == null) {
            return;
        }
        if (!Objects.equals(lastAnnouncedRoll, currentRoll)) {
            narrate("Résultat du dé : " + currentRoll + ".");
            lastAnnouncedRoll = currentRoll;
        }
    }

    private void announcePosition(PanierExpressState.Player self,
                                  List<PanierExpressState.LogEntry> logs) {
        int position = self.position();
        int collected = self.basket().size();
        int total = self.shoppingList().size();

        String tileNarration = extractTileNarration(logs, self.username());
        boolean tileChanged = tileNarration != null && !tileNarration.equals(lastAnnouncedTileMessage);

        if (position == lastAnnouncedPosition
                && collected == lastAnnouncedCollected
                && !tileChanged) {
            return;
        }

        StringBuilder builder = new StringBuilder();
        builder.append("Vous êtes maintenant case ")
                .append(position)
                .append(" sur 40, avec ")
                .append(collected)
                .append(" article(s) sur ")
                .append(total)
                .append('.');
        if (tileNarration != null) {
            builder.append(' ').append(tileNarration);
            lastAnnouncedTileMessage = tileNarration;
        } else {
            lastAnnouncedTileMessage = "";
        }

        narrate(builder.toString());
        lastAnnouncedPosition = position;
        lastAnnouncedCollected = collected;
    }

    private String extractTileNarration(List<PanierExpressState.LogEntry> logs,
                                        String username) {
        if (logs == null || logs.isEmpty() || username == null) {
            return null;
        }
        for (int index = logs.size() - 1; index >= Math.max(0, logs.size() - 6); index--) {
            PanierExpressState.LogEntry entry = logs.get(index);
            String message = entry.message();
            if (message == null || !message.contains(username)) {
                continue;
            }
            String normalized = normalizeMessage(message);
            if (normalized.contains("arrive sur")
                    || normalized.contains("termine un tour complet")
                    || normalized.contains("repart depuis la case")
                    || normalized.contains("atteint l'entree")) {
                return personaliseMessage(message, username);
            }
        }
        return null;
    }

    private String personaliseMessage(String message, String username) {
        if (message == null || message.isBlank()) {
            return null;
        }
        if (message.startsWith(username)) {
            return ("Vous" + message.substring(username.length())).trim();
        }
        return message.replace(username, "Vous").trim();
    }

    private String formatPlayerName(PanierExpressState.Player player) {
        if (player == null) {
            return "un joueur";
        }
        String name = player.username();
        if (name == null || name.isBlank()) {
            name = "Joueur " + player.id();
        }
        return player.isBot() ? name + " (bot)" : name;
    }

    private void handleAudioFeedback(List<PanierExpressState.LogEntry> logs) {
        if (logs == null) {
            lastLogSize = 0;
            return;
        }
        int start = Math.min(lastLogSize, logs.size());
        for (int i = start; i < logs.size(); i++) {
            String message = logs.get(i).message();
            if (message == null) {
                continue;
            }
            String normalized = normalizeMessage(message);
            if (normalized.contains("lance le de")) {
                playSound(SoundBank.DICE_ROLL);
            } else if (normalized.contains("recupere")) {
                playSound(SoundBank.ITEM_COLLECT);
            } else if (normalized.contains("carte echange")) {
                playSound(SoundBank.EXCHANGE_CARD);
            } else if (normalized.contains("quiz pour")) {
                playSound(SoundBank.QUIZ_PROMPT);
            }
        }
        lastLogSize = logs.size();
    }

    private void playSound(SoundBank clip) {
        if (clip == null) {
            return;
        }
        try {
            sounds.play(clip);
        } catch (Exception ignored) {
        }
    }

    private void narrate(String message) {
        if (message == null || message.isBlank()) {
            return;
        }
        JComponent component = null;
        try {
            component = componentSupplier.get();
        } catch (Exception ignored) {
        }
        if (component != null) {
            emitAccessibleText(component, message);
        }
        try {
            NarrationQueue queue = narrationQueueSupplier.get();
            if (queue != null && component != null) {
                queue.enqueue(component, message);
            }
        } catch (Exception ignored) {
        }
    }

    private void emitAccessibleText(JComponent target, String message) {
        AccessibleContext context = target.getAccessibleContext();
        if (context == null) {
            return;
        }
        String payload = accessibleToggle ? message + "\u200B" : message;
        accessibleToggle = !accessibleToggle;
        Runnable fire = () -> {
            context.setAccessibleDescription("");
            context.firePropertyChange(
                    AccessibleContext.ACCESSIBLE_TEXT_PROPERTY,
                    null,
                    ""
            );
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

    private static String normalizeMessage(String message) {
        if (message == null) {
            return "";
        }
        String lower = message.toLowerCase(Locale.ROOT);
        String normalized = Normalizer.normalize(lower, Normalizer.Form.NFD);
        return normalized.replaceAll("\\p{M}+", "");
    }

    private static String buildQuizSignature(PanierExpressState.PendingQuiz pending) {
        StringBuilder builder = new StringBuilder();
        if (pending.question() != null) {
            builder.append(pending.question().trim());
        }
        List<String> choices = pending.choices();
        if (choices != null) {
            for (String choice : choices) {
                builder.append('|');
                if (choice != null) {
                    builder.append(choice.trim());
                }
            }
        }
        return builder.toString();
    }
}
