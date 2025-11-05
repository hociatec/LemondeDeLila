package com.lemondelila.client.menu.controller;

import com.lemondelila.client.history.service.HistoryService;
import com.lemondelila.client.menu.model.CategorySummary;
import com.lemondelila.client.menu.model.RoomSummary;
import com.lemondelila.client.menu.service.CatalogClient;
import com.lemondelila.client.menu.service.RoomClient;
import com.lemondelila.client.menu.view.MenuView;
import com.lemondelila.client.session.listener.SessionListener;
import com.lemondelila.client.session.service.SessionService;

import javax.swing.SwingWorker;
import java.net.URI;
import java.util.List;
import java.util.Objects;

/**
 * Controleur principal pour la zone menu utilisateur connecte.
 */
public final class MenuController implements MenuView.MenuListener, SessionListener {

    private final MenuView view;
    private final SessionService sessionService;
    private final HistoryService historyService;
    private final CatalogClient catalogClient;
    private final RoomClient roomClient;

    public MenuController(MenuView view,
                          SessionService sessionService,
                          HistoryService historyService,
                          URI categoriesUri,
                          URI roomsUri) {
        this.view = Objects.requireNonNull(view, "view");
        this.sessionService = Objects.requireNonNull(sessionService, "sessionService");
        this.historyService = Objects.requireNonNull(historyService, "historyService");
        this.catalogClient = new CatalogClient(Objects.requireNonNull(categoriesUri, "categoriesUri"));
        this.roomClient = new RoomClient(Objects.requireNonNull(roomsUri, "roomsUri"));
        this.view.setMenuListener(this);
        this.sessionService.addListener(this);
    }

    @Override
    public void onShowCategoriesRequested() {
        if (!ensureSession()) return;
        view.setBusy(true);
        new SwingWorker<List<CategorySummary>, Void>() {
            @Override
            protected List<CategorySummary> doInBackground() throws Exception {
                return catalogClient.fetchCategories(sessionService.token().orElse(null));
            }

            @Override
            protected void done() {
                view.setBusy(false);
                try {
                    List<CategorySummary> categories = get();
                    view.showCategories(categories);
                    historyService.append("Menu", "Categories de jeux chargees");
                } catch (Exception e) {
                    view.showError("Impossible de recuperer les categories: " + e.getMessage());
                    historyService.append("Menu", "Erreur categories: " + e.getMessage());
                }
            }
        }.execute();
    }

    @Override
    public void onShowRoomsRequested() {
        if (!ensureSession()) return;
        view.setBusy(true);
        new SwingWorker<List<RoomSummary>, Void>() {
            @Override
            protected List<RoomSummary> doInBackground() throws Exception {
                return roomClient.fetchRooms(sessionService.token().orElse(null));
            }

            @Override
            protected void done() {
                view.setBusy(false);
                try {
                    List<RoomSummary> rooms = get();
                    view.showRooms(rooms);
                    historyService.append("Menu", "Parties en cours chargees");
                } catch (Exception e) {
                    view.showError("Impossible de recuperer les parties: " + e.getMessage());
                    historyService.append("Menu", "Erreur rooms: " + e.getMessage());
                }
            }
        }.execute();
    }

    @Override
    public void onShowOptionsRequested() {
        view.showOptions();
        historyService.append("Menu", "Affichage des options");
    }

    @Override
    public void onLogoutRequested() {
        sessionService.closeSession();
        historyService.append("Menu", "D\u00E9connexion demand\u00E9e");
    }

    @Override
    public void onReturnToMainMenuRequested() {
        view.reset();
        view.requestMenuFocus();
        historyService.append("Menu", "Retour au menu principal");
    }

    @Override
    public void onSessionOpened(String username, String token) {
        view.setUsername(username);
        view.reset();
        view.showMessage("Bienvenue " + username + " ! Choisissez une action dans le menu.");
        historyService.append("Menu", "Session ouverte pour " + username);
        view.requestMenuFocus();
    }

    @Override
    public void onSessionClosed() {
        view.reset();
        view.setUsername("?");
        view.showMessage("Session fermee");
        historyService.append("Menu", "Session fermee");
    }

    private boolean ensureSession() {
        if (sessionService.isActive()) {
            return true;
        }
        view.showError("Session expiree, veuillez vous reconnecter.");
        historyService.append("Menu", "Action refusee: session expiree");
        return false;
    }
}
