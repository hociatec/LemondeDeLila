package com.lemondelila.client.framework.media.sound;

/**
 * Identifies a sound resource loadable by {@link SoundEffectManager}.
 */
public interface SoundClip {

    /**
     * Unique identifier used when registering the clip with the audio service.
     */
    String key();

    /**
     * Classpath resource path pointing to the audio content.
     */
    String resourcePath();

    /**
     * @return {@code true} when the clip should be looped by default.
     */
    default boolean loop() {
        return false;
    }
}
