package com.lemondelila.client.game.core.viewmodel;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PendingActionSelectorTest {

    private static final class A {
        final String type;
        A(String type) { this.type = type; }
    }

    @Test
    void selectIndex_defaultsToZeroWhenNoPendingType() {
        PendingActionSelector selector = new PendingActionSelector();
        assertEquals(0, selector.selectIndex(List.of(new A("x")), "", a -> ((A) a).type));
    }

    @Test
    void selectIndex_matchesPendingType() {
        PendingActionSelector selector = new PendingActionSelector();
        int idx = selector.selectIndex(List.of(new A("a"), new A("b")), "b", a -> ((A) a).type);
        assertEquals(1, idx);
    }

    @Test
    void selectIndex_mapsVoteToDayVote() {
        PendingActionSelector selector = new PendingActionSelector();
        int idx = selector.selectIndex(List.of(new A("day_vote")), "vote", a -> ((A) a).type);
        assertEquals(0, idx);
    }

    @Test
    void selectIndex_mapsExchangeToAnyExchangeType() {
        PendingActionSelector selector = new PendingActionSelector();
        int idx = selector.selectIndex(List.of(new A("do_exchange_now")), "exchange", a -> ((A) a).type);
        assertEquals(0, idx);
    }

    @Test
    void selectIndex_returnsMinusOneWhenNoActions() {
        PendingActionSelector selector = new PendingActionSelector();
        assertEquals(-1, selector.selectIndex(List.of(), "x", a -> null));
    }
}

