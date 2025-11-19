package com.lemondelila.client.game.service;

/**
 * Actions déclenchées par les raccourcis clavier globaux d'un jeu.
 */
public interface GameCommandActions {

    void onQuit();

    void onRestart();

    void onShowRules();

    void onShowPlayers();
}
