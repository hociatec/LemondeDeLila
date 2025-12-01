package com.lemondelila.client.framework.ui.menu;

import javax.swing.JMenu;
import javax.swing.JMenuBar;
import javax.swing.JMenuItem;
import javax.swing.KeyStroke;
import java.util.List;
import java.util.Objects;

public final class MenuFactory {

    public JMenuBar createMenuBar(List<MenuDescriptor> descriptors) {
        JMenuBar bar = new JMenuBar();
        descriptors.forEach(desc -> bar.add(createMenu(desc)));
        return bar;
    }

    private JMenu createMenu(MenuDescriptor descriptor) {
        JMenu menu = new JMenu(descriptor.title());
        descriptor.items().forEach(item -> {
            JMenuItem menuItem = new JMenuItem(item.label());
            item.keyStroke().ifPresent(menuItem::setAccelerator);
            item.action().ifPresent(menuItem::addActionListener);
            menu.add(menuItem);
        });
        return menu;
    }

    public record MenuDescriptor(String title, List<MenuItemDescriptor> items) {
        public MenuDescriptor {
            Objects.requireNonNull(title, "title");
            items = List.copyOf(items);
        }
    }

    public record MenuItemDescriptor(String label,
                                     java.util.Optional<KeyStroke> keyStroke,
                                     java.util.Optional<java.awt.event.ActionListener> action) {
        public MenuItemDescriptor {
            Objects.requireNonNull(label, "label");
            Objects.requireNonNull(keyStroke, "keyStroke");
            Objects.requireNonNull(action, "action");
        }

        public static MenuItemDescriptor simple(String label, Runnable runnable) {
            Objects.requireNonNull(runnable, "runnable");
            return new MenuItemDescriptor(
                    label,
                    java.util.Optional.empty(),
                    java.util.Optional.of(e -> runnable.run())
            );
        }

        public MenuItemDescriptor withShortcut(KeyStroke stroke) {
            return new MenuItemDescriptor(label, java.util.Optional.of(stroke), action);
        }
    }
}

