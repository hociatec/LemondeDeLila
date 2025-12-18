package com.lemondelila.client.game.core.viewmodel;

import com.lemondelila.client.game.core.model.GenericGameState;

import javax.swing.ListModel;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;

public final class GameActionUtils {

    private GameActionUtils() {
    }

    public static boolean isDrawAction(GenericGameState.GenericAction action) {
        String text = normalize(action);
        return containsAny(text, "pioch", "draw", "pick", "take_card", "takecard", "take card");
    }

    public static boolean isDiscardAction(GenericGameState.GenericAction action) {
        String text = normalize(action);
        return containsAny(text, "discard", "defausse", "défausse", "jette", "trash");
    }

    public static boolean isDiceAction(GenericGameState.GenericAction action) {
        String text = normalize(action);
        return containsAny(text, "roll", "dice", "lancer", "lance", "throw");
    }

    public static boolean isExchangeAction(GenericGameState.GenericAction action) {
        String text = normalize(action);
        return containsAny(text, "exchange_with", "exchange", "echange", "échange");
    }

    public static String describeActions(ListModel<GenericGameState.GenericAction> actionsModel) {
        if (actionsModel == null || actionsModel.getSize() <= 0) return "[]";
        List<String> list = new ArrayList<>();
        for (int i = 0; i < actionsModel.getSize(); i++) {
            GenericGameState.GenericAction a = actionsModel.getElementAt(i);
            if (a == null) continue;
            list.add((a.type() == null ? "" : a.type()) + ":" + (a.label() == null ? "" : a.label()));
        }
        return list.toString();
    }

    public static String buildQuizSelectionAnnouncement(List<String> choices, int index) {
        int total = choices == null ? 0 : choices.size();
        if (total <= 0 || index < 0 || index >= total) {
            return "Quiz : réponse invalide.";
        }
        String choice = choices.get(index);
        return "Quiz, reponse " + (index + 1) + " sur " + total + " : " + choice;
    }

    private static String normalize(GenericGameState.GenericAction action) {
        if (action == null) return "";
        String raw = ((action.label() == null ? "" : action.label()) + " " + (action.type() == null ? "" : action.type()))
                .trim();
        String nfd = Normalizer.normalize(raw, Normalizer.Form.NFD);
        return nfd.replaceAll("\\p{M}", "").toLowerCase();
    }

    private static boolean containsAny(String text, String... tokens) {
        if (text == null || text.isBlank()) return false;
        for (String token : tokens) {
            if (token != null && !token.isBlank() && text.contains(token.toLowerCase())) {
                return true;
            }
        }
        return false;
    }
}
