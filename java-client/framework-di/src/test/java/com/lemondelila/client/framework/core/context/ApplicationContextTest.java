package com.lemondelila.client.framework.core.context;

import com.lemondelila.client.framework.core.module.LilaModule;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class ApplicationContextTest {

    @Test
    void providesSingletonInstance() {
        ApplicationContext.Builder builder = ApplicationContext.builder()
                .bindInstance(String.class, "hello");

        ApplicationContext context = builder.build();
        assertSame(context.get(String.class), context.get(String.class));
    }

    @Test
    void bindFactoryCreatesLazySingleton() {
        AtomicInteger counter = new AtomicInteger();
        ApplicationContext context = ApplicationContext.builder()
                .bindFactory(Integer.class, ctx -> counter.incrementAndGet())
                .build();

        assertEquals(1, context.get(Integer.class));
        assertEquals(1, context.get(Integer.class));
    }

    @Test
    void optionalLookupReturnsEmptyWhenMissing() {
        ApplicationContext context = ApplicationContext.builder().build();
        assertTrue(context.find(LilaModule.class).isEmpty());
    }

    @Test
    void detectsCircularDependencies() {
        ApplicationContext.Builder builder = ApplicationContext.builder();
        builder.bindFactory(A.class, ctx -> new A(ctx.get(B.class)));
        builder.bindFactory(B.class, ctx -> new B(ctx.get(A.class)));
        ApplicationContext context = builder.build();
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> context.get(A.class));
        assertTrue(ex.getMessage().contains("Dépendance circulaire"));
    }

    private record A(B dependency) {}
    private record B(A dependency) {}

    @Test
    void getAllReturnsAssignableBeansOnly() {
        ApplicationContext context = ApplicationContext.builder()
                .bindAuto(SampleRunnable.class)
                .bindAuto(SampleCallable.class)
                .bindInstance(String.class, "noop")
                .build();

        List<Runnable> runnables = context.getAll(Runnable.class);
        assertEquals(2, runnables.size());
    }

    private static final class SampleRunnable implements Runnable {
        @Override
        public void run() {
        }
    }

    private static final class SampleCallable implements Runnable {
        @Override
        public void run() {
        }
    }
}
