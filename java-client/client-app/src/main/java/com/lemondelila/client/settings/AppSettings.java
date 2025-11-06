package com.lemondelila.client.settings;

public record AppSettings(int gameVolume, int musicVolume, boolean confirmOnExit) {

    public static AppSettings defaults() {
        return new AppSettings(70, 60, true);
    }
}
