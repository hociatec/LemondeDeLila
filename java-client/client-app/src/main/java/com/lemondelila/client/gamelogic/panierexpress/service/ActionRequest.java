package com.lemondelila.client.gamelogic.panierexpress.service;

import java.util.Map;

public record ActionRequest(String type, Map<String, Object> payload) {
    public static ActionRequest rollDice() {
        return new ActionRequest("ROLL_DICE", Map.of(
                "config", Map.of(
                        "diceCount", 1,
                        "faces", 6,
                        "modifier", 0
                )
        ));
    }

    public static ActionRequest answerQuiz(int choice) {
        return new ActionRequest("QUIZ_VALIDATE", Map.of("choice", choice));
    }

    public static ActionRequest draw(String deck) {
        return new ActionRequest("DRAW_CARD", Map.of("deck", deck));
    }
}
