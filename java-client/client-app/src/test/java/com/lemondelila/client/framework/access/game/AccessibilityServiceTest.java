package com.lemondelila.client.framework.access.game;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AccessibilityServiceTest {

    @Test
    void formatTurnMessage_yourTurnUsesAccents() {
        AccessibilityService.TurnContext context = new AccessibilityService.TurnContext(true, "Alice", 3);
        String message = AccessibilityService.formatTurnMessage(context);
        assertEquals("C'est votre tour ! Dernier d\u00E9 : 3.", message);
    }

    @Test
    void formatTurnMessage_otherPlayerIncludesName() {
        AccessibilityService.TurnContext context = new AccessibilityService.TurnContext(false, "Bob", null);
        String message = AccessibilityService.formatTurnMessage(context);
        assertEquals("C'est au tour de Bob.", message);
    }

    @Test
    void formatBasketMessage_describesMissingItemsAndInventory() {
        AccessibilityService.BasketContext context = new AccessibilityService.BasketContext(
                true,
                2,
                4,
                List.of("Carottes", "Miel"),
                List.of("Pomme"),
                true
        );

        String expected = "Votre panier contient 2 articles sur 4. \u00C0 trouver encore : Carottes et Miel. " +
                "Inventaire pour \u00E9change : Pomme. Vous \u00EAtes pr\u00EAt pour la caisse.";
        assertEquals(expected, AccessibilityService.formatBasketMessage(context));
    }

    @Test
    void formatBasketMessage_handlesCompleteList() {
        AccessibilityService.BasketContext context = new AccessibilityService.BasketContext(
                false,
                3,
                3,
                List.of(),
                List.of(),
                false
        );

        assertEquals("Le panier contient 3 articles sur 3. La liste est compl\u00E8te.",
                AccessibilityService.formatBasketMessage(context));
    }
}
