package com.lemondelila.client.menu.controller;

import com.lemondelila.client.config.ClientConfig;
import com.lemondelila.client.game.view.SwingMissionNemesisView;
import com.lemondelila.client.history.service.HistoryService;
import com.lemondelila.client.menu.model.CategorySummary;
import com.lemondelila.client.menu.model.GameSummary;
import com.lemondelila.client.menu.model.RoomSummary;
import com.lemondelila.client.menu.service.CatalogClient;
import com.lemondelila.client.menu.service.RoomClient;
import com.lemondelila.client.menu.view.MenuView;
import com.lemondelila.client.session.listener.SessionListener;
import com.lemondelila.client.session.service.SessionService;
import com.lemondelila.client.ui.SwingAuthView;

import javax.swing.JFrame;
import javax.swing.SwingUtilities;
import javax.swing.SwingWorker;
import java.awt.Component;
import java.net.URI;
import java.util.List;
import java.util.Objects;

public final class MenuController implements MenuView.MenuListener, SessionListener {

    private final MenuView view;
    private final SessionService sessionService;
    private final HistoryService historyService;
    private final CatalogClient catalogClient;
    private final RoomClient roomClient;
    private List<CategorySummary> categories;
    private final ClientConfig config;

    public MenuController(MenuView view,
                          SessionService sessionService,
                          HistoryService historyService,
                          ClientConfig config) {
        this.view = Objects.requireNonNull(view, "view");
        this.sessionService = Objects.requireNonNull(sessionService, "sessionService");
        this.historyService = Objects.requireNonNull(historyService, "historyService");
        this.config = Objects.requireNonNull(config, "config");
        this.catalogClient = new CatalogClient(config.catalogCategoriesUri());
        this.roomClient = new RoomClient(config.roomsUri());
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
                    categories = get();
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
    public void onCategorySelected(CategorySummary category) {
        if (!category.subCategories().isEmpty()) {
            view.showCategories(category.subCategories());
        } else if (!category.games().isEmpty()) {
            view.showGames(category.games());
        }
    }

    @Override
    public void onGameSelected(GameSummary game) {
        if (game.name().equals("MissionNemesis")) {
            launchMissionNemesis(sessionService, config);
        }
    }

    private void launchMissionNemesis(SessionService sessionService, ClientConfig config) {
        view.setBusy(true);
        new SwingWorker<Void, Void>() {
            @Override
            protected Void doInBackground() throws Exception {
                Thread.sleep(1000);
                return null;
            }

            @Override
            protected void done() {
                view.setBusy(false);
                SwingUtilities.invokeLater(() -> {
                    // TODO: This should be connected to a dynamic room selection UI.
                    String roomId = "1";
                    // TODO: The player index should be determined dynamically.
                    int playerIndex = 0;
                    JFrame frame = (JFrame) SwingUtilities.getWindowAncestor((Component) view);
                    frame.setContentPane(new SwingMissionNemesisView((SwingAuthView) frame, roomId, playerIndex, sessionService, config.apiBaseUri()));
                    frame.revalidate();
                    frame.repaint();
                });
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
        historyService.append("Menu", "Deconnexion demandee");
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
