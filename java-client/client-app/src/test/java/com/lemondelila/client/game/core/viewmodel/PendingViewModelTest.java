package com.lemondelila.client.game.core.viewmodel;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PendingViewModelTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final PendingViewModel vm = new PendingViewModel();

    @Test
    void compute_returnsEmptyAndClearsInfoWhenPendingNull() {
        PendingViewModel.Result r = vm.compute(null, false, true, false);
        assertEquals("", r.pendingLabel());
        assertFalse(r.exchangePending());
        assertTrue(r.resetExchangeNavigator());
        assertTrue(r.clearInfoLabelIfNotQuiz());
    }

    @Test
    void compute_setsExchangePendingAndResetsOnTransition() throws Exception {
        JsonNode node = mapper.readTree("{\"type\":\"exchange\",\"targetPlayerId\":2}");
        PendingViewModel.Result r = vm.compute(node, false, false, true);
        assertTrue(r.exchangePending());
        assertTrue(r.resetExchangeNavigator());
        assertEquals("Échange en attente avec le joueur 2", r.pendingLabel());
    }

    @Test
    void describePending_returnsNullForQuiz() throws Exception {
        JsonNode node = mapper.readTree("{\"type\":\"quiz\"}");
        assertEquals(null, vm.describePending(node));
    }
}

