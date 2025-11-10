package com.lemondelila.client.media;

public enum SoundEffect {

    APP_LAUNCH("sound.app.launch", "/audio/app-launch.wav"),
    MENU_NAVIGATE("sound.menu.navigate", "/audio/menu-navigate.wav"),
    MENU_SELECT("sound.menu.select", "/audio/menu-select.wav"),
    MENU_BACK("sound.menu.back", "/audio/menu-back.wav");

    private final String key;
    private final String resourcePath;

    SoundEffect(String key, String resourcePath) {
        this.key = key;
        this.resourcePath = resourcePath;
    }

    public String key() {
        return key;
    }

    public String resourcePath() {
        return resourcePath;
    }
}
