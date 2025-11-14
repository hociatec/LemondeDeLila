package com.lemondelila.client.framework.core.di;

/**
 * Exception levée lorsqu'un point d'injection ne peut pas être résolu.
 */
public final class InjectionException extends RuntimeException {

    public InjectionException(String message) {
        super(message);
    }

    public InjectionException(String message, Throwable cause) {
        super(message, cause);
    }
}
