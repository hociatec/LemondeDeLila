package com.lemondelila.client.menu.view;

import com.lemondelila.client.menu.model.CategorySummary;
import com.lemondelila.client.menu.model.GameSummary;
import com.lemondelila.client.menu.model.RoomSummary;
import java.util.List;

public interface MenuView {

    interface MenuListener {
        void onShowCategoriesRequested();
        void onShowRoomsRequested();
        void onShowOptionsRequested();
        void onLogoutRequested();
        void onReturnToMainMenuRequested();
        void onCategorySelected(CategorySummary category);
        void onGameSelected(GameSummary game);
    }

    void setMenuListener(MenuListener listener);
    void setUsername(String username);
    void setBusy(boolean busy);
    void showCategories(List<CategorySummary> categories);
    void showGames(List<GameSummary> games);
    void showRooms(List<RoomSummary> rooms);
    void showOptions();
    void showMessage(String message);
    void showError(String message);
    void reset();
    void requestMenuFocus();
}
