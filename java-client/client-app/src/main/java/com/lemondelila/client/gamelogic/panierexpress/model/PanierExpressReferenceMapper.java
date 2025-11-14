package com.lemondelila.client.gamelogic.panierexpress.model;

import com.fasterxml.jackson.databind.JsonNode;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class PanierExpressReferenceMapper {

    private PanierExpressReferenceMapper() {
    }

    public static PanierExpressReference fromJson(JsonNode root) throws IOException {
        if (root == null || !root.isObject()) {
            throw new IOException("Référence Panier Express invalide");
        }

        List<PanierExpressReference.BoardTile> board = parseBoard(root.path("board"));
        PanierExpressReference.Courses courses = parseCourses(root.path("courses"));
        List<PanierExpressReference.ShoppingList> shoppingLists = parseShoppingLists(root.path("shoppingLists"));
        List<PanierExpressReference.QuizCard> quizCards = parseQuiz(root.path("quizCards"));
        List<PanierExpressReference.CardEffect> exchangeCards = parseCards(root.path("exchangeCards"), null);
        List<PanierExpressReference.CardEffect> eventCards = parseCards(root.path("eventCards"), "category");
        List<PanierExpressReference.TokenInfo> tokens = parseTokens(root.path("tokens"));

        return new PanierExpressReference(
                board,
                courses,
                shoppingLists,
                quizCards,
                exchangeCards,
                eventCards,
                tokens
        );
    }

    private static List<PanierExpressReference.BoardTile> parseBoard(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<PanierExpressReference.BoardTile> tiles = new ArrayList<>();
        for (JsonNode item : node) {
            int index = item.path("index").asInt(0);
            String label = item.path("label").asText("");
            String type = item.path("type").asText("");
            List<PanierExpressReference.TileAction> actions = parseTileActions(item.path("actions"));
            tiles.add(new PanierExpressReference.BoardTile(index, label, type, actions));
        }
        Collections.sort(tiles, java.util.Comparator.comparingInt(PanierExpressReference.BoardTile::index));
        return List.copyOf(tiles);
    }

    private static List<PanierExpressReference.TileAction> parseTileActions(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<PanierExpressReference.TileAction> actions = new ArrayList<>();
        for (JsonNode actionNode : node) {
            if (!actionNode.isObject()) {
                continue;
            }
            String type = actionNode.path("type").asText(null);
            if (type == null || type.isBlank()) {
                continue;
            }
            String message = actionNode.hasNonNull("message") ? actionNode.get("message").asText() : null;
            Integer delta = actionNode.hasNonNull("delta") ? actionNode.get("delta").asInt() : null;
            Integer count = actionNode.hasNonNull("count") ? actionNode.get("count").asInt() : null;
            actions.add(new PanierExpressReference.TileAction(type, message, delta, count));
        }
        return List.copyOf(actions);
    }

    private static PanierExpressReference.Courses parseCourses(JsonNode node) {
        List<PanierExpressReference.CourseItem> fruits = parseCourseItems(node.path("fruits"));
        List<PanierExpressReference.CourseItem> vegetables = parseCourseItems(node.path("vegetables"));
        return new PanierExpressReference.Courses(fruits, vegetables);
    }

    private static List<PanierExpressReference.CourseItem> parseCourseItems(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<PanierExpressReference.CourseItem> items = new ArrayList<>();
        for (JsonNode item : node) {
            String id = item.path("id").asText("");
            String name = item.path("name").asText("");
            items.add(new PanierExpressReference.CourseItem(id, name));
        }
        items.sort(java.util.Comparator.comparing(PanierExpressReference.CourseItem::name, String.CASE_INSENSITIVE_ORDER));
        return List.copyOf(items);
    }

    private static List<PanierExpressReference.ShoppingList> parseShoppingLists(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<PanierExpressReference.ShoppingList> lists = new ArrayList<>();
        int index = 1;
        for (JsonNode listNode : node) {
            List<String> items = new ArrayList<>();
            if (listNode.isArray()) {
                for (JsonNode item : listNode) {
                    items.add(item.asText(""));
                }
            }
            lists.add(new PanierExpressReference.ShoppingList(index++, List.copyOf(items)));
        }
        return List.copyOf(lists);
    }

    private static List<PanierExpressReference.QuizCard> parseQuiz(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<PanierExpressReference.QuizCard> cards = new ArrayList<>();
        for (JsonNode item : node) {
            String id = item.path("id").asText("");
            String question = item.path("question").asText("");
            List<String> options = new ArrayList<>();
            JsonNode optionsNode = item.path("options");
            if (optionsNode.isArray()) {
                for (JsonNode optionNode : optionsNode) {
                    options.add(optionNode.asText(""));
                }
            }
            int answerIndex = item.path("answer").asInt(-1);
            cards.add(new PanierExpressReference.QuizCard(id, question, List.copyOf(options), answerIndex));
        }
        return List.copyOf(cards);
    }

    private static List<PanierExpressReference.CardEffect> parseCards(JsonNode node, String categoryField) {
        if (!node.isArray()) {
            return List.of();
        }
        List<PanierExpressReference.CardEffect> cards = new ArrayList<>();
        for (JsonNode item : node) {
            String id = item.path("id").asText("");
            String title = item.path("title").asText("");
            String effect = item.path("effect").asText("");
            String category = categoryField != null ? item.path(categoryField).asText("") : "";
            cards.add(new PanierExpressReference.CardEffect(id, title, effect, category));
        }
        return List.copyOf(cards);
    }

    private static List<PanierExpressReference.TokenInfo> parseTokens(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<PanierExpressReference.TokenInfo> tokens = new ArrayList<>();
        for (JsonNode item : node) {
            String id = item.path("id").asText("");
            String name = item.path("name").asText("");
            String description = item.path("description").asText("");
            tokens.add(new PanierExpressReference.TokenInfo(id, name, description));
        }
        return List.copyOf(tokens);
    }
}
