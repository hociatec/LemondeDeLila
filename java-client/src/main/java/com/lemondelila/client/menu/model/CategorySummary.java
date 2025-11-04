package com.lemondelila.client.menu.model;

import java.util.List;

public record CategorySummary(String name, List<CategorySummary> subCategories, List<GameSummary> games) {
}
