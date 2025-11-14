package com.lemondelila.client.framework.access.game;

import com.lemondelila.client.framework.access.NarrationQueue;
import com.lemondelila.client.framework.access.ScreenReaderAnnouncer;

import javax.swing.JComponent;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Service d’accessibilité partagé pour formater et annoncer les évènements de jeu
 * (tours, scores, paniers, messages libres).
 */
public final class AccessibilityService {

    private final ScreenReaderAnnouncer announcer;
    private final NarrationQueue queue;

    public record TurnContext(boolean yourTurn, String playerName, Integer lastRoll) {}

    public record BasketContext(
            boolean forSelf,
            int collected,
            int total,
            List<String> missingItems,
            List<String> inventoryItems,
            boolean readyForCheckout
    ) {}

    public AccessibilityService(ScreenReaderAnnouncer announcer,
                                NarrationQueue queue) {
        this.announcer = Objects.requireNonNull(announcer, "announcer");
        this.queue = Objects.requireNonNull(queue, "queue");
    }

    public String announceTurn(JComponent component, TurnContext context) {
        String message = formatTurnMessage(context);
        speak(component, message);
        return message;
    }

    public static String formatTurnMessage(TurnContext context) {
        Objects.requireNonNull(context, "context");
        StringBuilder builder = new StringBuilder();
        if (context.yourTurn()) {
            builder.append("C'est votre tour !");
        } else {
            String player = Optional.ofNullable(context.playerName())
                    .map(String::trim)
                    .filter(name -> !name.isEmpty())
                    .orElse("un joueur");
            builder.append("C'est au tour de ").append(player).append('.');
        }
        if (context.lastRoll() != null) {
            builder.append(' ')
                    .append("Dernier d\u00E9 : ")
                    .append(context.lastRoll())
                    .append('.');
        }
        return builder.toString();
    }

    public String announceBasket(JComponent component, BasketContext context) {
        String message = formatBasketMessage(context);
        speak(component, message);
        return message;
    }

    public static String formatBasketMessage(BasketContext context) {
        Objects.requireNonNull(context, "context");
        StringBuilder builder = new StringBuilder();
        String sujet = context.forSelf() ? "Votre" : "Le";
        builder.append(sujet)
                .append(" panier contient ")
                .append(context.collected())
                .append(' ')
                .append(context.collected() == 1 ? "article" : "articles")
                .append(" sur ")
                .append(context.total())
                .append('.');

        List<String> missing = Optional.ofNullable(context.missingItems()).orElse(List.of());
        if (!missing.isEmpty()) {
            builder.append(' ')
                    .append("\u00C0 trouver encore : ")
                    .append(joinList(missing))
                    .append('.');
        } else if (context.total() > 0) {
            builder.append(' ')
                    .append(context.forSelf()
                            ? "Votre liste est compl\u00E8te."
                            : "La liste est compl\u00E8te.");
        }

        List<String> inventory = Optional.ofNullable(context.inventoryItems()).orElse(List.of());
        if (!inventory.isEmpty()) {
            builder.append(' ')
                    .append("Inventaire pour \u00E9change : ")
                    .append(joinList(inventory))
                    .append('.');
        }

        if (context.readyForCheckout()) {
            builder.append(' ')
                    .append(context.forSelf()
                            ? "Vous \u00EAtes pr\u00EAt pour la caisse."
                            : "Pr\u00EAt pour la caisse.");
        }
        return builder.toString();
    }

    public void announceCustom(JComponent component, String message) {
        if (message == null || message.isBlank()) {
            return;
        }
        speak(component, message);
    }

    private void speak(JComponent component, String message) {
        if (component != null) {
            queue.enqueue(component, message);
            return;
        }
        announcer.announce(component, message);
    }

    private static String joinList(List<String> items) {
        if (items.isEmpty()) {
            return "";
        }
        if (items.size() == 1) {
            return items.get(0);
        }
        String last = items.get(items.size() - 1);
        return String.join(", ", items.subList(0, items.size() - 1)) + " et " + last;
    }
}
