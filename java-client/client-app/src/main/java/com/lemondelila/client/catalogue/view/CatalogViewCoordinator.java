package com.lemondelila.client.catalogue.view;

import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.NarrationQueue;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;
import com.lemondelila.client.framework.ui.component.StatusBanner;
import com.lemondelila.client.media.SoundBank;

import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Dimension;
import java.awt.Font;

/**
 * Coordonne la vue principale du catalogue : en-tête, panneaux et retours audio.
 */
final class CatalogViewCoordinator {

    private final CardLayout viewLayout = new CardLayout();
    private final JPanel viewPanel = new JPanel(viewLayout);
    private final JLabel breadcrumbLabel = new JLabel("Categories");
    private final StatusBanner statusBanner;
    private final CategoryListPanel categoryListPanel;
    private final GameListPanel gameListPanel;
    private final SoundEffectManager soundManager;
    private final NarrationQueue narrationQueue;

    CatalogViewCoordinator(JPanel host,
                           SoundEffectManager soundManager,
                           NarrationQueue narrationQueue) {
        this.soundManager = soundManager;
        this.narrationQueue = narrationQueue;
        this.categoryListPanel = new CategoryListPanel(soundManager);
        this.gameListPanel = new GameListPanel(soundManager);
        this.statusBanner = new StatusBanner(
                "Statut catalogue",
                "Annonce les chargements et actions dans le catalogue",
                host,
                narrationQueue
        );
        buildUi(host);
    }

    private void buildUi(JPanel host) {
        host.setLayout(new BorderLayout(16, 16));
        host.setBorder(BorderFactory.createEmptyBorder(32, 48, 32, 48));

        JLabel titleLabel = new JLabel("Etageres");
        titleLabel.setFont(titleLabel.getFont().deriveFont(Font.BOLD, 26f));
        AccessibleDecorator.apply(titleLabel, AccessibleSpec.builder()
                .name("Catalogue des jeux")
                .description("Sélection de catégories et jeux disponibles")
                .build());
        breadcrumbLabel.setFont(breadcrumbLabel.getFont().deriveFont(Font.ITALIC, 14f));
        AccessibleDecorator.apply(breadcrumbLabel, AccessibleSpec.builder()
                .name("Fil d'Ariane catalogue")
                .description("Indique la catégorie ou le jeu en cours de consultation")
                .build());

        JPanel titleContainer = new JPanel();
        titleContainer.setLayout(new BoxLayout(titleContainer, BoxLayout.Y_AXIS));
        titleContainer.setOpaque(false);
        titleContainer.add(titleLabel);
        titleContainer.add(Box.createRigidArea(new Dimension(0, 6)));
        titleContainer.add(breadcrumbLabel);

        JPanel header = new JPanel(new BorderLayout(12, 12));
        header.setOpaque(false);
        header.add(titleContainer, BorderLayout.WEST);
        host.add(header, BorderLayout.NORTH);

        viewPanel.setOpaque(false);
        viewPanel.add(categoryListPanel, CategoryListPanel.CARD);
        viewPanel.add(gameListPanel, GameListPanel.CARD);
        host.add(viewPanel, BorderLayout.CENTER);

        JLabel bannerComponent = statusBanner.component();
        bannerComponent.setBorder(BorderFactory.createEmptyBorder(8, 4, 0, 4));
        host.add(bannerComponent, BorderLayout.SOUTH);
    }

    void showCategories(java.util.List<CategoryListPanel.CategoryItem> items,
                        int selectedIndex,
                        String breadcrumb,
                        String status) {
        categoryListPanel.show(items, selectedIndex);
        switchTo(CategoryListPanel.CARD);
        setBreadcrumb(breadcrumb);
        setStatus(status);
        SwingUtilities.invokeLater(categoryListPanel::requestFocusInWindow);
    }

    void showGames(java.util.List<GameSummary> games,
                   int selectedIndex,
                   String breadcrumb,
                   String status) {
        gameListPanel.show(games, selectedIndex);
        switchTo(GameListPanel.CARD);
        setBreadcrumb(breadcrumb);
        setStatus(status);
        SwingUtilities.invokeLater(gameListPanel::requestFocusInWindow);
    }

    void setStatus(String text) {
        String safe = (text == null || text.isBlank()) ? " " : text;
        SwingUtilities.invokeLater(() -> statusBanner.setStatus(safe));
    }

    void setLoadingState(boolean busy) {
        categoryListPanel.setEnabled(!busy);
        gameListPanel.setEnabled(!busy);
    }

    void playSelectSound() {
        if (soundManager != null) {
            soundManager.play(SoundBank.MENU_SELECT);
        }
    }

    void playNavigateSound() {
        if (soundManager != null) {
            soundManager.play(SoundBank.MENU_NAVIGATE);
        }
    }

    CategoryListPanel categoryListPanel() {
        return categoryListPanel;
    }

    GameListPanel gameListPanel() {
        return gameListPanel;
    }

    private void setBreadcrumb(String text) {
        SwingUtilities.invokeLater(() -> breadcrumbLabel.setText(text));
    }

    private void switchTo(String card) {
        viewLayout.show(viewPanel, card);
    }
}
