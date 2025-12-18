package com.lemondelila.client.game.core.contract;

public sealed interface ContractPending permits ContractPending.Quiz, ContractPending.Generic {

    record Quiz(String question, java.util.List<String> choices, Integer playerId) implements ContractPending {
        public java.util.List<String> choices() {
            return choices == null ? java.util.List.of() : java.util.Collections.unmodifiableList(choices);
        }
    }

    record Generic(String type, String name, Integer playerId, Integer targetPlayerId, Object raw) implements ContractPending {}
}

