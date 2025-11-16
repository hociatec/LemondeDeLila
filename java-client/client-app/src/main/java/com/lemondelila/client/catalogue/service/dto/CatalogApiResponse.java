package com.lemondelila.client.catalogue.service.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public final class CatalogApiResponse {

    private List<CatalogCategoryDto> categories;
    private List<GameSummaryDto> games;

    public List<CatalogCategoryDto> categories() {
        return categories;
    }

    public void setCategories(List<CatalogCategoryDto> categories) {
        this.categories = categories;
    }

    public List<GameSummaryDto> games() {
        return games;
    }

    public void setGames(List<GameSummaryDto> games) {
        this.games = games;
    }
}
