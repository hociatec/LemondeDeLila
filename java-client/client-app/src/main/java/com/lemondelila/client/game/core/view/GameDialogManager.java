package com.lemondelila.client.game.core.view;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.core.viewmodel.GameActionUtils;
import com.lemondelila.client.game.core.viewmodel.GameInfoLabelFormatter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Predicate;

/**
 * Gère les dialogues d'interaction (ask_card, discard).
 * Extrait de GenericGameInteractionComponent pour simplifier la maintenance.
 */
public final class GameDialogManager {

    private static final Logger LOGGER = LoggerFactory.getLogger(GameDialogManager.class);

    // Records pour les données des dialogues
    public record PlayerOption(int id, String name) {}
    public record AskCardOption(String familyId, String memberId, String label) {}

    private Integer localPlayerId;
    private final GameInfoLabelFormatter infoLabelFormatter;

    // Callbacks vers le composant parent
    private final Consumer<String> updateInfoLabel;
    private final BiConsumer<String, Map<String, Object>> submitAction;
    private final Predicate<Predicate<GenericGameState.GenericAction>> hasActionMatching;

    private GenericGameState lastAskState;

    // État du dialogue Ask
    private boolean askDialogOpen = false;
    private String lastAskBlockReason = "";
    private int askTargetIndex = 0;
    private int askCardIndex = 0;
    private int askGiveIndex = 0;
    private int askFocusIndex = 0;
    private List<PlayerOption> askTargets = List.of();
    private List<AskCardOption> askCards = List.of();
    private List<AskCardOption> giveCards = List.of();

    // État du dialogue Discard
    private boolean discardDialogOpen = false;
    private int discardIndex = 0;
    private List<AskCardOption> discardOptions = List.of();

    public GameDialogManager(Integer localPlayerId,
                             GameInfoLabelFormatter infoLabelFormatter,
                             Consumer<String> updateInfoLabel,
                             BiConsumer<String, Map<String, Object>> submitAction,
                             Predicate<Predicate<GenericGameState.GenericAction>> hasActionMatching) {
        this.localPlayerId = localPlayerId;
        this.infoLabelFormatter = infoLabelFormatter;
        this.updateInfoLabel = updateInfoLabel;
        this.submitAction = submitAction;
        this.hasActionMatching = hasActionMatching;
    }

    // ===== ASK DIALOG =====

    public boolean isAskDialogOpen() {
        return askDialogOpen;
    }

    public String getLastAskBlockReason() {
        return lastAskBlockReason == null ? "" : lastAskBlockReason;
    }

    public void openAskDialog(GenericGameState state) {
        openAskDialog(state, List.of());
    }

    public void openAskDialog(GenericGameState state, List<PlayerOption> fallbackTargets) {
        this.lastAskState = state;
        refreshAskDialogData(state);
        if (askTargets.isEmpty() && fallbackTargets != null && !fallbackTargets.isEmpty()) {
            askTargets = List.copyOf(fallbackTargets);
            if (askTargetIndex >= askTargets.size()) askTargetIndex = 0;
        }
        // Dans Dame Nature, une demande doit toujours proposer une carte en échange.
        if (askTargets.isEmpty() || askCards.isEmpty() || giveCards.isEmpty()) {
            LOGGER.debug("[ask] cannot open: no targets or cards");
            askDialogOpen = false;
            return;
        }
        askDialogOpen = true;
        askFocusIndex = 0;
        updateInfoLabel.accept(infoLabelFormatter.formatAskLabel(
                askDialogOpen,
                askTargets.stream().map(PlayerOption::name).toList(),
                askTargetIndex,
                askCards.stream().map(AskCardOption::label).toList(),
                askCardIndex,
                giveCards.stream().map(AskCardOption::label).toList(),
                askGiveIndex,
                askFocusIndex
        ));
    }

    public void refreshAskDialogData(GenericGameState state) {
        this.askTargets = extractAskTargets(state);
        this.askCards = extractAskCards(state);
        this.giveCards = extractGiveCards(state);

        if (askTargetIndex >= askTargets.size()) askTargetIndex = askTargets.isEmpty() ? 0 : askTargets.size() - 1;
        if (askCardIndex >= askCards.size()) askCardIndex = askCards.isEmpty() ? 0 : askCards.size() - 1;
        if (askFocusIndex == 2 && giveCards.isEmpty()) askFocusIndex = 0;

        if (askTargets.isEmpty() || askCards.isEmpty() || giveCards.isEmpty()) {
            askDialogOpen = false;
        }

        StringBuilder reason = new StringBuilder();
        if (askTargets.isEmpty()) reason.append("aucun joueur cible. ");
        if (askCards.isEmpty()) reason.append("catalogue de cartes indisponible. ");
        if (giveCards.isEmpty()) reason.append("aucune carte à offrir. ");
        lastAskBlockReason = reason.toString().trim();
    }

    public void moveAskFocus(boolean backward) {
        if (!askDialogOpen) return;
        int step = backward ? -1 : 1;
        askFocusIndex = (askFocusIndex + step + 5) % 5;
        refreshAskInfoLabel();
    }

    public void moveAskSelection(int delta) {
        if (!askDialogOpen) return;
        if (askFocusIndex == 0 && !askTargets.isEmpty()) {
            askTargetIndex = (askTargetIndex + delta + askTargets.size()) % askTargets.size();
            // Mettre à jour la liste des cartes demandables selon la cible.
            if (lastAskState != null) {
                this.askCards = extractAskCards(lastAskState);
                if (askCardIndex >= askCards.size()) askCardIndex = askCards.isEmpty() ? 0 : askCards.size() - 1;
            }
        } else if (askFocusIndex == 1 && !askCards.isEmpty()) {
            askCardIndex = (askCardIndex + delta + askCards.size()) % askCards.size();
        } else if (askFocusIndex == 2 && !giveCards.isEmpty()) {
            askGiveIndex = (askGiveIndex + delta + giveCards.size()) % giveCards.size();
        } else if (askFocusIndex == 3 && delta > 0) {
            sendAskDialog();
            return;
        } else if (askFocusIndex == 4 && delta > 0) {
            cancelAskDialog();
            return;
        }
        refreshAskInfoLabel();
    }

    public void sendAskDialog() {
        if (!askDialogOpen) return;
        if (askTargets.isEmpty() || askCards.isEmpty() || giveCards.isEmpty() || localPlayerId == null) {
            cancelAskDialog();
            return;
        }

        PlayerOption target = askTargets.get(Math.max(0, Math.min(askTargetIndex, askTargets.size() - 1)));
        AskCardOption card = askCards.get(Math.max(0, Math.min(askCardIndex, askCards.size() - 1)));
        AskCardOption give = giveCards.get(Math.max(0, Math.min(askGiveIndex, giveCards.size() - 1)));

        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("playerId", localPlayerId);
        payload.put("targetPlayerId", target.id());
        payload.put("target", target.id());
        payload.put("familyId", card.familyId());
        payload.put("memberId", card.memberId());

        payload.put("giveFamilyId", give.familyId());
        payload.put("giveMemberId", give.memberId());
        payload.put("offerMemberId", give.memberId());
        payload.put("give", give.memberId());

        submitAction.accept("ask_card", payload);
        askDialogOpen = false;
        updateInfoLabel.accept("");
    }

    public void cancelAskDialog() {
        askDialogOpen = false;
        updateInfoLabel.accept("");
    }

    public String buildAskAnnouncementText() {
        if (!askDialogOpen || askTargets.isEmpty() || askCards.isEmpty()) {
            return "";
        }
        PlayerOption target = askTargets.get(Math.max(0, Math.min(askTargetIndex, askTargets.size() - 1)));
        AskCardOption card = askCards.get(Math.max(0, Math.min(askCardIndex, askCards.size() - 1)));
        AskCardOption give = giveCards.isEmpty() ? null : giveCards.get(Math.max(0, Math.min(askGiveIndex, giveCards.size() - 1)));

        switch (askFocusIndex) {
            case 0 -> { return "Joueur cible : " + target.name() + " (" + (askTargetIndex + 1) + "/" + askTargets.size() + ")"; }
            case 1 -> { return "Carte à demander : " + card.label() + " (" + (askCardIndex + 1) + "/" + askCards.size() + ")"; }
            case 2 -> { return give == null ? "" : "Carte à donner : " + give.label() + " (" + (askGiveIndex + 1) + "/" + giveCards.size() + ")"; }
            case 3 -> { return "Valider la demande"; }
            case 4 -> { return "Annuler"; }
            default -> { return ""; }
        }
    }

    private void refreshAskInfoLabel() {
        updateInfoLabel.accept(infoLabelFormatter.formatAskLabel(
                askDialogOpen,
                askTargets.stream().map(PlayerOption::name).toList(),
                askTargetIndex,
                askCards.stream().map(AskCardOption::label).toList(),
                askCardIndex,
                giveCards.stream().map(AskCardOption::label).toList(),
                askGiveIndex,
                askFocusIndex
        ));
    }

    private List<PlayerOption> extractAskTargets(GenericGameState state) {
        List<PlayerOption> res = new ArrayList<>();
        if (state == null) {
            return res;
        }

        // Préférence : extras.playerViews (toujours présent côté Dame Nature, même si state.players est incomplet).
        JsonNode extras = state.extras();
        if (extras != null && extras.isObject()) {
            if (localPlayerId == null) {
                JsonNode currentView = extras.path("currentPlayerView");
                if (currentView != null && currentView.isObject() && currentView.path("id").isInt()) {
                    localPlayerId = currentView.path("id").asInt();
                }
            }
            JsonNode views = extras.path("playerViews");
            if (views != null && views.isArray()) {
                for (JsonNode v : views) {
                    int id = v.path("id").asInt(-1);
                    String username = v.path("username").asText("");
                    if (id > 0 && !username.isBlank() && (localPlayerId == null || id != localPlayerId)) {
                        res.add(new PlayerOption(id, username));
                    }
                }
                if (!res.isEmpty()) {
                    return res;
                }
            }
        }

        // Fallback : state.players
        if (state.players() == null || !state.players().isArray()) {
            return res;
        }
        for (JsonNode p : state.players()) {
            int id = p.path("id").asInt(-1);
            String username = p.path("username").asText("");
            if (id > 0 && !username.isBlank() && (localPlayerId == null || id != localPlayerId)) {
                res.add(new PlayerOption(id, username));
            }
        }
        return res;
    }

    private List<AskCardOption> extractAskCards(GenericGameState state) {
        List<AskCardOption> res = new ArrayList<>();
        JsonNode extras = state == null ? null : state.extras();
        if (extras == null || !extras.isObject()) return res;

        // Si le serveur expose la main de la cible (Dame Nature), limiter la liste aux cartes réellement disponibles.
        if (!askTargets.isEmpty() && askTargetIndex >= 0 && askTargetIndex < askTargets.size()) {
            int targetId = askTargets.get(askTargetIndex).id();
            JsonNode targetHands = extras.path("askTargetHands");
            if (targetHands != null && targetHands.isObject()) {
                JsonNode cards = targetHands.get(String.valueOf(targetId));
                if (cards != null && cards.isArray()) {
                    cards.forEach(c -> {
                        String familyId = c.path("familyId").asText("");
                        String memberId = c.path("memberId").asText("");
                        String label = c.path("label").asText("");
                        if (!familyId.isBlank() && !memberId.isBlank()) {
                            res.add(new AskCardOption(familyId.trim(), memberId.trim(), (label == null || label.isBlank()) ? (familyId + ":" + memberId) : label));
                        }
                    });
                    return res;
                }
            }
        }

        JsonNode catalog = extras.path("catalog");
        if (catalog.isObject()) {
            catalog.fields().forEachRemaining(family -> {
                String familyId = family.getKey();
                JsonNode members = family.getValue();
                if (members.isArray()) {
                    members.forEach(m -> {
                        String memberId = m.isObject() ? m.path("id").asText("") : m.asText("");
                        String memberName = m.isObject() ? m.path("name").asText("") : "";
                        if (memberId.isBlank()) return;
                        String label = !memberName.isBlank() ? (familyId + " - " + memberName) : (familyId + " : " + memberId);
                        res.add(new AskCardOption(familyId, memberId, label));
                    });
                }
            });
        }
        return res;
    }

    private List<AskCardOption> extractGiveCards(GenericGameState state) {
        List<AskCardOption> res = new ArrayList<>();
        JsonNode extras = state == null ? null : state.extras();
        if (extras == null || !extras.isObject()) return res;
        JsonNode handCards = extras.path("handCards");
        if (handCards.isArray()) {
            handCards.forEach(card -> {
                String familyId = card.path("familyId").asText("");
                String memberId = card.path("memberId").asText("");
                String label = card.path("label").asText("");
                if (!familyId.isBlank() && !memberId.isBlank()) {
                    res.add(new AskCardOption(familyId.trim(), memberId.trim(), (label == null || label.isBlank()) ? (familyId + ":" + memberId) : label));
                }
            });
            return res;
        }
        JsonNode hand = extras.path("hand");
        if (hand.isArray()) {
            hand.forEach(cardNode -> {
                String cardStr = cardNode.asText("");
                String[] parts = cardStr.split(":", 2);
                if (parts.length == 2) {
                    res.add(new AskCardOption(parts[0].trim(), parts[1].trim(), cardStr));
                }
            });
        }
        return res;
    }

    public void setLocalPlayerId(Integer localPlayerId) {
        this.localPlayerId = localPlayerId;
    }

    // ===== DISCARD DIALOG =====

    public boolean isDiscardDialogOpen() {
        return discardDialogOpen;
    }

    public void refreshDiscardOptions(GenericGameState state) {
        List<AskCardOption> options = state == null ? List.of() : extractDiscardOptions(state);
        discardOptions = options;

        if (discardIndex >= discardOptions.size()) {
            discardIndex = discardOptions.isEmpty() ? 0 : discardOptions.size() - 1;
        }

        if (discardOptions.isEmpty() || !hasActionMatching.test(GameActionUtils::isDiscardAction)) {
            discardDialogOpen = false;
        }

        if (discardDialogOpen) {
            refreshDiscardInfoLabel();
        }
    }

    public void openDiscardDialog() {
        if (discardOptions.isEmpty()) {
            LOGGER.debug("[discard] cannot open: no options");
            discardDialogOpen = false;
            return;
        }

        discardDialogOpen = true;
        if (discardIndex < 0 || discardIndex >= discardOptions.size()) {
            discardIndex = 0;
        }
        refreshDiscardInfoLabel();
    }

    public void moveDiscardSelection(int delta) {
        if (!discardDialogOpen || discardOptions.isEmpty()) {
            return;
        }
        int size = discardOptions.size();
        int next = discardIndex + delta;
        if (next < 0) {
            next = size - 1;
        } else if (next >= size) {
            next = 0;
        }
        discardIndex = next;
        refreshDiscardInfoLabel();
    }

    public void sendDiscardSelection() {
        if (!discardDialogOpen) return;
        discardDialogOpen = false;

        if (discardOptions.isEmpty()) {
            updateInfoLabel.accept("");
            return;
        }

        AskCardOption opt = discardOptions.get(Math.max(0, Math.min(discardIndex, discardOptions.size() - 1)));

        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("familyId", opt.familyId());
        payload.put("memberId", opt.memberId());
        if (localPlayerId != null) {
            payload.put("playerId", localPlayerId);
        }

        submitAction.accept("discard_card", payload);
        updateInfoLabel.accept("");
    }

    public void cancelDiscardDialog() {
        discardDialogOpen = false;
        updateInfoLabel.accept("");
    }

    public void handleDiscardShortcut() {
        if (!hasActionMatching.test(GameActionUtils::isDiscardAction)) {
            LOGGER.debug("[discard] no discard action available");
            discardDialogOpen = false;
            return;
        }
        if (discardDialogOpen) {
            sendDiscardSelection();
            return;
        }
        openDiscardDialog();
    }

    public String buildDiscardAnnouncementText() {
        if (discardOptions.isEmpty()) {
            return "";
        }
        AskCardOption opt = discardOptions.get(Math.max(0, Math.min(discardIndex, discardOptions.size() - 1)));
        return "Défausser : " + opt.label() + " (" + (discardIndex + 1) + "/" + discardOptions.size() + ") - flèches pour naviguer, Entrée pour valider.";
    }

    private void refreshDiscardInfoLabel() {
        updateInfoLabel.accept(infoLabelFormatter.formatDiscardLabel(
                discardOptions.stream().map(AskCardOption::label).toList(),
                discardIndex
        ));
    }

    private List<AskCardOption> extractDiscardOptions(GenericGameState state) {
        return extractGiveCards(state);
    }

    // ===== REFRESH INFO LABEL =====

    public void refreshInfoLabelIfNeeded() {
        if (discardDialogOpen) {
            refreshDiscardInfoLabel();
        } else if (askDialogOpen) {
            refreshAskInfoLabel();
        }
    }
}
