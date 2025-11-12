package com.lemondelila.framework.media.sound;

/**
 * Provides sound preferences such as per-clip enablement and volume.
 */
public interface SoundPreferences {

    /**
     * @return {@code true} if the clip associated with {@code clipKey} should be played.
     */
    boolean isEnabled(String clipKey);

    /**
     * @return volume for the clip in the range 0-100.
     */
    int volumeFor(String clipKey);

    /**
     * Convenience factory that returns preferences disabling every sound.
     */
    static SoundPreferences disabled() {
        return new SoundPreferences() {
            @Override
            public boolean isEnabled(String clipKey) {
                return false;
            }

            @Override
            public int volumeFor(String clipKey) {
                return 0;
            }
        };
    }
}
