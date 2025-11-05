package com.lemondelila.client.menu.view;

import com.lemondelila.client.menu.model.CategorySummary;
import com.lemondelila.client.menu.model.RoomSummary;

import java.util.List;

/**
 * Contrat d'affichage du menu principal une fois l'utilisateur connecte.
 */
public interface MenuView {

    void setMenuListener(MenuListener listener);

    void setUsername(String username);

    void setBusy(boolean busy);

    void showCategories(List<CategorySummary> categories);

    void showRooms(List<RoomSummary> rooms);

    void showOptions();

    void showMessage(String message);

    void showError(String message);

    void reset();

    default void requestMenuFocus() {
        // optional
    }

    interface MenuListener {
        void onShowCategoriesRequested();
        void onShowRoomsRequested();
        void onShowOptionsRequested();
        void onLogoutRequested();
        void onReturnToMainMenuRequested();
    }
}
