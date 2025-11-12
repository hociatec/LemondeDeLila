package com.lemondelila.framework.core.di;

import com.lemondelila.framework.core.context.ApplicationContext;

import java.lang.annotation.Annotation;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.lang.reflect.Parameter;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Utilitaires de réflexion pour instancier et injecter des dépendances.
 */
public final class InjectionSupport {

    private InjectionSupport() {
    }

    public static <T> T instantiate(Class<T> implementation, ApplicationContext context) {
        Constructor<T> constructor = selectConstructor(implementation);
        Object[] arguments = resolveArguments(constructor, context);
        try {
            T instance = constructor.newInstance(arguments);
            injectFields(instance, context);
            return instance;
        } catch (InstantiationException | IllegalAccessException | InvocationTargetException ex) {
            throw new InjectionException("Impossible d'instancier " + implementation.getName(), ex);
        }
    }

    private static <T> Constructor<T> selectConstructor(Class<T> type) {
        Constructor<?>[] constructors = type.getDeclaredConstructors();
        List<Constructor<?>> annotated = new ArrayList<>();
        for (Constructor<?> constructor : constructors) {
            if (constructor.isAnnotationPresent(Inject.class)) {
                annotated.add(constructor);
            }
        }
        if (annotated.size() > 1) {
            throw new InjectionException("Plusieurs constructeurs @Inject détectés sur " + type.getName());
        }
        @SuppressWarnings("unchecked")
        Constructor<T> chosen = (Constructor<T>) (annotated.isEmpty() ? null : annotated.get(0));
        if (chosen != null) {
            chosen.setAccessible(true);
            return chosen;
        }
        try {
            Constructor<T> defaultCtor = type.getDeclaredConstructor();
            defaultCtor.setAccessible(true);
            return defaultCtor;
        } catch (NoSuchMethodException ignored) {
        }
        if (constructors.length == 1) {
            @SuppressWarnings("unchecked")
            Constructor<T> single = (Constructor<T>) constructors[0];
            single.setAccessible(true);
            return single;
        }
        throw new InjectionException("Aucun constructeur injectable trouvé pour " + type.getName());
    }

    private static Object[] resolveArguments(Constructor<?> constructor, ApplicationContext context) {
        Parameter[] parameters = constructor.getParameters();
        Object[] arguments = new Object[parameters.length];
        for (int i = 0; i < parameters.length; i++) {
            arguments[i] = resolveDependency(
                    parameters[i].getType(),
                    extractQualifier(parameters[i].getAnnotations()),
                    parameters[i].getParameterizedType(),
                    context,
                    constructor.toGenericString() + " paramètre " + parameters[i].getName());
        }
        return arguments;
    }

    private static void injectFields(Object instance, ApplicationContext context) {
        Class<?> type = instance.getClass();
        while (type != null && type != Object.class) {
            for (Field field : type.getDeclaredFields()) {
                if (!field.isAnnotationPresent(Inject.class)) {
                    continue;
                }
                if (Modifier.isFinal(field.getModifiers())) {
                    throw new InjectionException("Impossible d'injecter le champ final " + field);
                }
                Object value = resolveDependency(
                        field.getType(),
                        extractQualifier(field.getAnnotations()),
                        field.getGenericType(),
                        context,
                        "champ " + field.toGenericString());
                boolean accessible = field.canAccess(instance);
                field.setAccessible(true);
                try {
                    field.set(instance, value);
                } catch (IllegalAccessException ex) {
                    throw new InjectionException("Injection impossible dans " + field.toGenericString(), ex);
                } finally {
                    field.setAccessible(accessible);
                }
            }
            type = type.getSuperclass();
        }
    }

    private static Object resolveDependency(Class<?> dependencyType,
                                            String qualifier,
                                            Type genericType,
                                            ApplicationContext context,
                                            String location) {
        if (dependencyType.equals(ApplicationContext.class)) {
            return context;
        }
        if (Optional.class.equals(dependencyType)) {
            Class<?> nested = extractOptionalType(genericType, location);
            return context.find(nested, qualifier);
        }
        try {
            return context.get(dependencyType, qualifier);
        } catch (IllegalStateException ex) {
            throw new InjectionException("Aucune dépendance pour " + dependencyType.getName()
                    + " (" + location + ")", ex);
        }
    }

    private static Class<?> extractOptionalType(Type genericType, String location) {
        if (genericType instanceof ParameterizedType parameterized) {
            Type[] arguments = parameterized.getActualTypeArguments();
            if (arguments.length == 1 && arguments[0] instanceof Class<?> cls) {
                return cls;
            }
        }
        throw new InjectionException("Impossible de déterminer le type générique de Optional pour " + location);
    }

    private static String extractQualifier(Annotation[] annotations) {
        for (Annotation annotation : annotations) {
            if (annotation.annotationType() == Named.class) {
                return ((Named) annotation).value();
            }
        }
        return ApplicationContext.DEFAULT_QUALIFIER;
    }
}
