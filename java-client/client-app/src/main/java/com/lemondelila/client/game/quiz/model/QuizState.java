package com.lemondelila.client.game.quiz.model;

import java.util.List;

public record QuizState(String question, List<String> choices, Integer playerId) {
    public List<String> choices() {
        return choices == null ? List.of() : List.copyOf(choices);
    }
}
