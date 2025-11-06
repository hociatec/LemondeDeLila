package com.lemondelila.client.settings;

public record AppSettings(int gameVolume,
                          int musicVolume,
                          boolean confirmOnExit,
                          boolean chatEnabled,
                          boolean confirmChatExit) {

    public static AppSettings defaults() {
        return new AppSettings(70, 60, true, true, false);
    }
}
