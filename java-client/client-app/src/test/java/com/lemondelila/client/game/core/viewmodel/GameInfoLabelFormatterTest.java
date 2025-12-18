package com.lemondelila.client.game.core.viewmodel;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GameInfoLabelFormatterTest {

    private final GameInfoLabelFormatter formatter = new GameInfoLabelFormatter();

    @Test
    void formatAskLabel_returnsEmptyWhenClosed() {
        assertEquals("", formatter.formatAskLabel(false, List.of("A"), 0, List.of("C"), 0, List.of(), 0, 0));
    }

    @Test
    void formatAskLabel_includesFocusAndSelections() {
        String s = formatter.formatAskLabel(true,
                List.of("Bob", "Alice"), 1,
                List.of("Famille X"), 0,
                List.of("Offre Y"), 0,
                0
        );
        assertTrue(s.contains("[Cible]"));
        assertTrue(s.contains("cible=Alice"));
        assertTrue(s.contains("carte=Famille X"));
        assertTrue(s.contains("offre=Offre Y"));
    }

    @Test
    void formatDiscardLabel_handlesEmpty() {
        assertEquals("Choisissez une carte à défausser (aucune carte disponible).", formatter.formatDiscardLabel(List.of(), 0));
    }

    @Test
    void formatQuizInfoLabel_formatsChoiceListWhenNoSelection() {
        String s = formatter.formatQuizInfoLabel("Q", List.of("A", "B"), -1);
        assertTrue(s.contains("Quiz"));
        assertTrue(s.contains("1) A"));
        assertTrue(s.contains("2) B"));
    }
}

