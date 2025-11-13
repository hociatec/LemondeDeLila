package com.lemondelila.client.gamelogic.panierexpress.model;

import java.util.List;

public record PanierExpressReference(
        List<BoardTile> board,
        Courses courses,
        List<ShoppingList> shoppingLists,
        List<QuizCard> quizCards,
        List<CardEffect> exchangeCards,
        List<CardEffect> eventCards,
        List<TokenInfo> tokens
) {

    public record BoardTile(int index, String label, String type, List<TileAction> actions) { }

    public record Courses(List<CourseItem> fruits, List<CourseItem> vegetables) { }

    public record CourseItem(String id, String name) { }

    public record ShoppingList(int number, List<String> items) { }

    public record QuizCard(String id, String question, List<String> options, int answerIndex) {
        public String answerLabel() {
            if (options == null || options.isEmpty()) {
                return "";
            }
            if (answerIndex < 0 || answerIndex >= options.size()) {
                return "";
            }
            return options.get(answerIndex);
        }
    }

    public record CardEffect(String id, String title, String effect, String category) { }

    public record TokenInfo(String id, String name, String description) { }

    public record TileAction(String type, String message, Integer delta, Integer count) { }
}
