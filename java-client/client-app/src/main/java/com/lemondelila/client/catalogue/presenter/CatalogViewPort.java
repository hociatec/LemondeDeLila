package com.lemondelila.client.catalogue.presenter;

import com.lemondelila.client.catalogue.model.GameSummary;

import java.util.List;

/**
 * API minimale permettant au presenter de piloter l'affichage des catégories et jeux.
 */
public interface CatalogViewPort {

    void showCategories(List<CatalogCategoryItem> items, int selectedIndex, String breadcrumb, String status);

    void showGames(List<GameSummary> games, int selectedIndex, String breadcrumb, String status);

    void setStatus(String text);

    void setLoadingState(boolean busy);

    void playNavigateSound();
}

