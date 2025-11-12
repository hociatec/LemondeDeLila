package com.lemondelila.framework.core.di;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marqueur pour indiquer les points d'injection de dépendances.
 * Peut être appliqué sur un constructeur ou un champ.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.CONSTRUCTOR, ElementType.FIELD})
public @interface Inject {
}
