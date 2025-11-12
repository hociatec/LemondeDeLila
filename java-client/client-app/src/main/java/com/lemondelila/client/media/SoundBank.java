package com.lemondelila.client.media;

import com.lemondelila.framework.media.sound.SoundClip;

public enum SoundBank implements SoundClip {
    APP_LAUNCH("sound.app.launch", "/audio/app-launch.wav", false),
    BACKGROUND_FON("sound.background.fon", "/audio/fon.wav", true),
    MENU_NAVIGATE("sound.menu.navigate", "/audio/menu-navigate.wav", false),
    MENU_SELECT("sound.menu.select", "/audio/menu-select.wav", false),
    DICE_ROLL("sound.game.dice", "/audio/dice-roll.wav", false),
    ITEM_COLLECT("sound.game.item", "/audio/collect-item.wav", false),
    EXCHANGE_CARD("sound.game.exchange", "/audio/exchange.wav", false),
    QUIZ_PROMPT("sound.game.quiz", "/audio/quiz.wav", false);

    private final String key;
    private final String resource;
    private final boolean loop;

    SoundBank(String key, String resource, boolean loop) {
        this.key = key;
        this.resource = resource;
        this.loop = loop;
    }

    @Override
    public String key() {
        return key;
    }

    @Override
    public String resourcePath() {
        return resource;
    }

    @Override
    public boolean loop() {
        return loop;
    }
}
