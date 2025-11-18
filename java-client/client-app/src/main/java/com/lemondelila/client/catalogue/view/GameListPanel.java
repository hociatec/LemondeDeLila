package com.lemondelila.client.catalogue.view;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;

import javax.swing.ListCellRenderer;
import java.util.function.Consumer;

final class GameListPanel extends AbstractCatalogListPanel<GameSummary> {

    static final String CARD = "games";

    GameListPanel(SoundEffectManager soundManager) {
        super(Internationalization.text("catalog.games.list.title"), AccessibleSpec.builder()
                .name(Internationalization.text("catalog.games.list.name"))
                .description(Internationalization.text("catalog.games.list.desc"))
                .build(), soundManager);
    }

    @Override
    protected ListCellRenderer<GameSummary> createRenderer() {
        return new CatalogGameCard();
    }

    GameSummary selectedItem() {
        return super.selectedItem();
    }

    int selectedIndex() {
        return super.selectedIndex();
    }

    void onSelectionChange(Consumer<GameSummary> listener) {
        super.onSelectionChange(listener);
    }
}
