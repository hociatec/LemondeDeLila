package com.lemondelila.client.game.plugin;

import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.game.launcher.GameLauncherBinding;
import com.lemondelila.client.game.launcher.GameLauncherRegistry;
import com.lemondelila.client.game.model.GameEngine;
import com.lemondelila.client.game.model.GameEngineRegistry;

import java.util.stream.Stream;

/**
 * Contrat commun pour enregistrer un jeu jouable dans le client.
 */
public interface GamePlugin extends LilaModule {

    /**
     * Describes the launchers that should be exposed for this plugin.
     */
    default Stream<GameLauncherBinding> launchers(ApplicationContext context) {
        return Stream.empty();
    }

    /**
     * Enregistre les lanceurs de jeu correspondants.
     */
    default void registerLaunchers(ApplicationContext context, GameLauncherRegistry registry) {
        launchers(context).forEach(registry::register);
    }

    /**
     * Permet d'enregistrer les moteurs locaux exposés par le jeu.
     */
    default void registerEngines(ApplicationContext context, GameEngineRegistry registry) {
        // no-op
    }

    /**
     * Notifié lors de la déconnexion de l'utilisateur pour remettre le jeu à zéro si nécessaire.
     */
    default void onUserLoggedOut(ApplicationContext context) {
        // no-op
    }
}
