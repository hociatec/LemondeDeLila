package com.lemondelila.client.view.home;

import com.lemondelila.client.events.user.LoginFailed;
import com.lemondelila.client.events.user.LoginRequested;
import com.lemondelila.client.events.user.LoginSucceeded;
import com.lemondelila.client.events.user.RegistrationFailed;
import com.lemondelila.client.events.user.RegistrationRequested;
import com.lemondelila.client.events.user.RegistrationSucceeded;
import com.lemondelila.client.view.user.LoginFormPanel;
import com.lemondelila.client.view.user.RegisterFormPanel;
import com.lemondelila.framework.access.AccessibleDecorator;
import com.lemondelila.framework.access.AccessibleSpec;
import com.lemondelila.framework.access.FocusHighlighter;
import com.lemondelila.framework.access.NarrationQueue;
import com.lemondelila.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.framework.core.context.ApplicationContext;
import com.lemondelila.framework.core.di.Inject;
import com.lemondelila.framework.core.event.DomainEventBus;
import com.lemondelila.framework.ui.action.ActionManager;
import com.lemondelila.framework.ui.dialog.DialogService;
import com.lemondelila.framework.ui.screen.Screen;
import com.lemondelila.framework.ui.screen.ScreenContext;
import com.lemondelila.framework.ui.screen.ScreenManager;

import javax.swing.AbstractAction;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.CardLayout;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;

public final class HomeScreen extends JPanel implements Screen {

    private enum Card {
        LANDING,
        LOGIN,
        REGISTER
    }

    private final DomainEventBus eventBus;
    private final ActionManager actionManager;
    private final AccessibleShortcutRegistry shortcutRegistry;
    private final DialogService dialogService;

    private final JPanel cardPanel = new JPanel(new CardLayout());
    private final LandingPanel landingPanel = new LandingPanel();
    private final LoginFormPanel loginForm;
    private final RegisterFormPanel registerForm;

    private final JLabel statusLabel = new JLabel(" ");
    private final AtomicReference<AutoCloseable> loginSuccessSub = new AtomicReference<>();
    private final AtomicReference<AutoCloseable> loginFailedSub = new AtomicReference<>();
    private final AtomicReference<AutoCloseable> registrationSuccessSub = new AtomicReference<>();
    private final AtomicReference<AutoCloseable> registrationFailedSub = new AtomicReference<>();

    private Card currentCard = Card.LANDING;
    private final Supplier<NarrationQueue> narrationQueueSupplier;
    private volatile NarrationQueue narrationQueue;
    private ScreenManager screenManager;

    public HomeScreen(DomainEventBus eventBus,
                      ActionManager actionManager,
                      AccessibleShortcutRegistry shortcutRegistry,
                      FocusHighlighter focusHighlighter,
                      DialogService dialogService,
                      Supplier<NarrationQueue> narrationQueueSupplier) {
        this.eventBus = eventBus;
        this.actionManager = actionManager;
        this.shortcutRegistry = shortcutRegistry;
        this.dialogService = dialogService;
        this.loginForm = new LoginFormPanel(focusHighlighter);
        this.registerForm = new RegisterFormPanel(focusHighlighter);
        this.narrationQueueSupplier = narrationQueueSupplier;

        buildUi();
        registerListeners();
        registerShortcuts();
    }

    @Inject
    public HomeScreen(DomainEventBus eventBus,
                      ActionManager actionManager,
                      AccessibleShortcutRegistry shortcutRegistry,
                      FocusHighlighter focusHighlighter,
                      DialogService dialogService,
                      ApplicationContext context) {
        this(eventBus, actionManager, shortcutRegistry, focusHighlighter, dialogService,
                () -> context.get(NarrationQueue.class));
    }

    private void buildUi() {
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));
        setBorder(javax.swing.BorderFactory.createEmptyBorder(48, 64, 48, 64));

        JLabel title = new JLabel("Bienvenue dans Le Monde de Lila");
        title.setAlignmentX(Component.CENTER_ALIGNMENT);
        title.setFont(title.getFont().deriveFont(24f));
        add(title);
        add(Box.createRigidArea(new Dimension(0, 32)));

        cardPanel.setOpaque(false);
        cardPanel.setAlignmentX(Component.CENTER_ALIGNMENT);
        cardPanel.setMaximumSize(new Dimension(520, 360));
        cardPanel.add(landingPanel, Card.LANDING.name());
        cardPanel.add(loginForm, Card.LOGIN.name());
        cardPanel.add(registerForm, Card.REGISTER.name());
        add(cardPanel);

        add(Box.createRigidArea(new Dimension(0, 24)));

        statusLabel.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(statusLabel, AccessibleSpec.builder()
                .name("Zone de statut")
                .description("Affiche l'etat des actions de connexion et d'inscription")
                .build());
        add(statusLabel);

        showLanding();
    }

    private void registerListeners() {
        loginForm.onLogin(credentials -> {
            statusLabel.setText("Connexion en cours...");
            eventBus.publish(new LoginRequested(credentials.username(), credentials.password()));
        });

        registerForm.onRegister(data -> {
            statusLabel.setText("Inscription en cours...");
            eventBus.publish(new RegistrationRequested(data.username(), data.password(), data.email()));
        });

        landingPanel.onLogin(() -> switchTo(Card.LOGIN));
        landingPanel.onRegister(() -> switchTo(Card.REGISTER));
        landingPanel.onQuit(() -> {
            if (dialogService.confirm("Quitter", "Voulez-vous quitter l'application ?").join()) {
                System.exit(0);
            }
        });
    }

    private void registerShortcuts() {
        KeyStroke escapeKey = KeyStroke.getKeyStroke("ESCAPE");
        actionManager.register("home.show-landing", () -> new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                showLanding();
            }
        }, escapeKey);
        shortcutRegistry.register(escapeKey, "Retour accueil");
        actionManager.attachTo(this);
        shortcutRegistry.applyTo(this);
    }

    private void switchTo(Card target) {
        if (target == currentCard) {
            return;
        }
        this.currentCard = target;
        CardLayout layout = (CardLayout) cardPanel.getLayout();
        layout.show(cardPanel, target.name());
        statusLabel.setText(" ");
        if (target == Card.LOGIN) {
            SwingUtilities.invokeLater(loginForm::focusDefaultField);
        } else if (target == Card.REGISTER) {
            SwingUtilities.invokeLater(registerForm::focusDefaultField);
        }
    }

    private void showLanding() {
        switchTo(Card.LANDING);
        landingPanel.requestFocusInWindow();
    }

    private void handleLoginSucceeded(LoginSucceeded event) {
        statusLabel.setText("Bienvenue " + event.username() + "!");
        if (screenManager != null) {
            SwingUtilities.invokeLater(() -> screenManager.show("main-menu"));
        }
    }

    private void handleLoginFailed(LoginFailed event) {
        statusLabel.setText(event.reason());
        dialogService.error("Connexion impossible", event.reason());
        SwingUtilities.invokeLater(() -> loginForm.focusDefaultField());
    }

    private void handleRegistrationSucceeded(RegistrationSucceeded event) {
        statusLabel.setText("Inscription reussie ! Vous pouvez vous connecter.");
        dialogService.info("Inscription reussie", "Bienvenue " + event.username() + " ! Connectez-vous pour continuer.");
        switchTo(Card.LOGIN);
    }

    private void handleRegistrationFailed(RegistrationFailed event) {
        statusLabel.setText(event.reason());
        dialogService.error("Inscription impossible", event.reason());
        SwingUtilities.invokeLater(() -> registerForm.focusDefaultField());
    }

    @Override
    public String id() {
        return "home";
    }

    @Override
    public JPanel getComponent() {
        return this;
    }

    @Override
    public void onShow(ScreenContext context) {
        this.screenManager = context.screenManager();
        narrationQueue = narrationQueueSupplier.get();
        loginSuccessSub.set(eventBus.subscribe(LoginSucceeded.class, this::handleLoginSucceeded));
        loginFailedSub.set(eventBus.subscribe(LoginFailed.class, this::handleLoginFailed));
        registrationSuccessSub.set(eventBus.subscribe(RegistrationSucceeded.class, this::handleRegistrationSucceeded));
        registrationFailedSub.set(eventBus.subscribe(RegistrationFailed.class, this::handleRegistrationFailed));
        narrationQueue.enqueue(this, "Ecran d'accueil, utilisez les fleches pour naviguer.");
        showLanding();
    }

    @Override
    public void onHide(ScreenContext context) {
        this.screenManager = null;
        Arrays.asList(loginSuccessSub, loginFailedSub, registrationSuccessSub, registrationFailedSub)
                .forEach(ref -> {
                    AutoCloseable closeable = ref.getAndSet(null);
                    if (closeable != null) {
                        try {
                            closeable.close();
                        } catch (Exception ignored) {
                        }
                    }
                });
    }
}


