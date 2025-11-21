package com.lemondelila.client.game.core.model;

import com.lemondelila.client.game.core.action.ActionRequest;

public record PrimaryActionDescriptor(String label, ActionRequest action) {
}
