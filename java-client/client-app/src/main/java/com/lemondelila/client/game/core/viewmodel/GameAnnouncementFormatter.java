package com.lemondelila.client.game.core.viewmodel;

import java.util.List;

public final class GameAnnouncementFormatter {

    public String sanitizeLogLine(String line) {
        if (line == null) {
            return "";
        }
        return line.replaceFirst("^\\[Panier Express\\]\\s*", "");
    }

    public String buildQuizAnnouncement(String question, List<String> choices) {
        StringBuilder sb = new StringBuilder();
        if (question != null && !question.isBlank()) {
            sb.append("Quiz : ").append(question.trim());
        } else {
            sb.append("Quiz en cours.");
        }
        if (choices != null && !choices.isEmpty()) {
            sb.append(" Choix : ");
            for (int i = 0; i < choices.size(); i++) {
                sb.append(i + 1).append(") ").append(choices.get(i));
                if (i < choices.size() - 1) {
                    sb.append(", ");
                }
            }
        } else {
            sb.append(" Aucun choix fourni.");
        }
        return sb.toString();
    }
}
