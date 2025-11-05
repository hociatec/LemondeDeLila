package com.lemondelila.client.menu.model;

import java.util.List;

public record CategorySummary(String id, String name, List<CategorySummary> children, List<Game> games) {
}
