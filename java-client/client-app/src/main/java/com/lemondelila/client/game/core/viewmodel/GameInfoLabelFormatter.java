package com.lemondelila.client.game.core.viewmodel;

import java.util.List;

public final class GameInfoLabelFormatter {

    public String formatAskLabel(boolean askDialogOpen,
                                 List<String> targets,
                                 int targetIndex,
                                 List<String> askCards,
                                 int askCardIndex,
                                 List<String> giveCards,
                                 int askGiveIndex,
                                 int askFocusIndex) {
        if (!askDialogOpen || targets == null || targets.isEmpty() || askCards == null || askCards.isEmpty()) {
            return "";
        }
        String target = safePick(targets, targetIndex);
        String card = safePick(askCards, askCardIndex);
        String give = (giveCards == null || giveCards.isEmpty()) ? "(aucune)" : safePick(giveCards, askGiveIndex);

        String focus = switch (askFocusIndex) {
            case 0 -> "[Cible]";
            case 1 -> "[Carte demandée]";
            case 2 -> "[Carte offerte]";
            case 3 -> "[Demander]";
            case 4 -> "[Annuler]";
            default -> "";
        };

        return String.format("%s Demander : cible=%s | carte=%s | offre=%s | Tab/Shift+Tab pour naviguer, ↑/↓ pour changer, Entrée pour valider, Échap pour annuler.",
                focus, target, card, give);
    }

    public String formatDiscardLabel(List<String> discardOptions, int discardIndex) {
        if (discardOptions == null || discardOptions.isEmpty()) {
            return "Choisissez une carte à défausser (aucune carte disponible).";
        }
        String opt = safePick(discardOptions, discardIndex);
        int idx = clampIndex(discardIndex, discardOptions.size());
        return "Défausser : " + opt + " (" + (idx + 1) + "/" + discardOptions.size() + ") - flèches pour naviguer, Entrée pour valider.";
    }

    public String formatQuizInfoLabel(String question, List<String> choices, int selectedIndex) {
        if (choices == null || choices.isEmpty()) {
            return "Quiz : aucune reponse disponible.";
        }
        if (selectedIndex < 0 || selectedIndex >= choices.size()) {
            return formatQuizChoicesLabel(question, choices);
        }
        return "Quiz : reponse " + (selectedIndex + 1) + "/" + choices.size() + " -> " + choices.get(selectedIndex);
    }

    public String formatQuizChoicesLabel(String question, List<String> choices) {
        StringBuilder sb = new StringBuilder();
        sb.append("Quiz");
        if (question != null && !question.isBlank()) {
            sb.append(" : ").append(question.trim());
        }
        if (choices != null && !choices.isEmpty()) {
            sb.append(" - utilisez les fleches haut et bas puis Entree. Options : ");
            for (int i = 0; i < choices.size(); i++) {
                if (i > 0) {
                    sb.append(" / ");
                }
                sb.append(i + 1).append(") ").append(choices.get(i));
            }
        } else {
            sb.append(" - aucune option disponible.");
        }
        return sb.toString();
    }

    private static String safePick(List<String> options, int index) {
        if (options == null || options.isEmpty()) {
            return "";
        }
        int i = clampIndex(index, options.size());
        String v = options.get(i);
        return v == null ? "" : v;
    }

    private static int clampIndex(int idx, int size) {
        if (size <= 0) return 0;
        if (idx < 0) return 0;
        if (idx >= size) return size - 1;
        return idx;
    }
}

