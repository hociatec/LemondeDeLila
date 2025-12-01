package com.lemondelila.client.game.shortcut.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.game.shortcut.view.ShortcutHelpView;

/**
 * Contrôleur léger pour exposer les raccourcis disponibles et rafraîchir une vue d'aide.
 */
public final class ShortcutController {

    private final TableShortcutManager manager;

    @Inject
    public ShortcutController(TableShortcutManager manager) {
        this.manager = manager;
    }

    /**
     * Rend dans une vue d'aide la liste courante des raccourcis enregistrés.
     */
    public void renderHelp(ShortcutHelpView view) {
        if (view == null) {
            return;
        }
        view.render(manager.shortcutsModel());
    }
}
