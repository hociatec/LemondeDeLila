package com.lemondelila.client.social.view;

import java.util.function.Consumer;
import java.util.function.Supplier;

import javax.swing.WindowConstants;

public interface SocialMessagesPanelFactory {

    SocialMessagesPanel create(Supplier<java.awt.Window> ownerSupplier,
                                Consumer<String> statusUpdater,
                                Runnable onEscape);
}
