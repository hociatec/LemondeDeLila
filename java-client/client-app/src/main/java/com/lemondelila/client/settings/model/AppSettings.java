package com.lemondelila.client.settings.model;

public record AppSettings(int musicVolume,
                          boolean soundEnabled,
                          boolean soundAppLaunch,
                          int soundAppLaunchVolume,
                          boolean soundBackground,
                          int soundBackgroundVolume,
                          boolean soundNavigate,
                          int soundNavigateVolume,
                          boolean soundSelect,
                          int soundSelectVolume,
                          boolean confirmOnExit,
                          boolean chatEnabled,
                          boolean confirmChatExit) {

    public static AppSettings defaults() {
        return new AppSettings(60, true, true, 70, true, 60, true, 65, true, 70, true, true, false);
    }
}
