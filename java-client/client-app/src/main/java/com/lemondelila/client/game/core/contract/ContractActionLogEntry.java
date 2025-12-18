package com.lemondelila.client.game.core.contract;

public record ContractActionLogEntry(Integer actorId, String type, Object payload, Long timestamp, String step) {}

