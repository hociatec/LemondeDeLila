package com.lemondelila.client.ui.screens;

import com.lemondelila.client.events.LoginFailed;
import com.lemondelila.client.events.LoginRequested;
import com.lemondelila.client.events.LoginSucceeded;
import com.lemondelila.client.events.RegistrationFailed;
import com.lemondelila.client.events.RegistrationRequested;
import com.lemondelila.client.events.RegistrationSucceeded;
import com.lemondelila.framework.access.AccessibleDecorator;
import com.lemondelila.framework.access.AccessibleSpec;
import com.lemondelila.framework.access.FocusHighlighter;
import com.lemondelila.framework.access.NarrationQueue;
import com.lemondelila.framework.access.shortcut.AccessibleShortcutRegistry;
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
        landingPanel.onLogin(this::showLoginForm);
        landingPanel.onRegister(this::showRegisterForm);

        loginForm.onSubmit(this::submitCredentials);
        loginForm.onBack(this::showLanding);

        registerForm.onSubmit(this::submitRegistration);
        registerForm.onBack(this::showLanding);
    }

    private void registerShortcuts() {
        actionManager.register("home.connexion", () -> new AbstractAction("connexion") {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (currentCard == Card.LOGIN) {
                    submitCredentials();
                } else {
                    showLoginForm();
                }
            }
        }, KeyStroke.getKeyStroke("alt C"));
        shortcutRegistry.register(KeyStroke.getKeyStroke("alt C"), "Connexion (Alt+C)");

        actionManager.register("home.inscription", () -> new AbstractAction("inscription") {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (currentCard == Card.REGISTER) {
                    submitRegistration();
                } else {
                    showRegisterForm();
                }
            }
        }, KeyStroke.getKeyStroke("alt I"));
        shortcutRegistry.register(KeyStroke.getKeyStroke("alt I"), "Inscription (Alt+I)");

        actionManager.register("home.retour", () -> new AbstractAction("retour") {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (currentCard == Card.LOGIN || currentCard == Card.REGISTER) {
                    showLanding();
                }
            }
        }, KeyStroke.getKeyStroke("alt R"));
        shortcutRegistry.register(KeyStroke.getKeyStroke("alt R"), "Retour (Alt+R)");

        actionManager.attachTo(this);
        shortcutRegistry.applyTo(this);
    }

    private void showLanding() {
        switchTo(Card.LANDING);
        setStatus("Choisissez une action.");
        landingPanel.focusDefault();
    }

    private void showLoginForm() {
        switchTo(Card.LOGIN);
        setStatus("Saisissez vos identifiants.");
        loginForm.focusUsername();
    }

    private void showRegisterForm() {
        switchTo(Card.REGISTER);
        setStatus("Renseignez votre inscription.");
        registerForm.focusUsername();
    }

    private void switchTo(Card card) {
        currentCard = card;
        CardLayout layout = (CardLayout) cardPanel.getLayout();
        layout.show(cardPanel, card.name());
        landingPanel.setBusy(false);
        loginForm.setBusy(false);
        registerForm.setBusy(false);
    }

    private void submitCredentials() {
        String username = loginForm.username();
        char[] password = loginForm.password();
        if (username.isEmpty() || password.length == 0) {
            Arrays.fill(password, '\0');
            dialogService.error("Connexion impossible", "Veuillez saisir un identifiant et un mot de passe.");
            setStatus("Identifiants manquants");
            loginForm.clearPassword();
            setBusy(false);
            return;
        }
        setStatus("Connexion en cours...");
        setBusy(true);
        eventBus.publish(new LoginRequested(username, password));
        NarrationQueue queue = narrationQueue();
        if (queue != null) {
            queue.enqueue(loginForm.submitButton(), "Tentative de connexion pour " + username);
        }
    }

    private void submitRegistration() {
        String username = registerForm.username();
        String email = registerForm.email();
        char[] password = registerForm.password();
        if (username.isEmpty() || email.isEmpty() || password.length == 0) {
            Arrays.fill(password, '\0');
            dialogService.error("Inscription impossible", "Veuillez saisir identifiant, e-mail et mot de passe.");
            setStatus("Informations insuffisantes pour l'inscription");
            registerForm.clearAfterError();
            setBusy(false);
            return;
        }
        if (!email.contains("@") || !email.contains(".")) {
            Arrays.fill(password, '\0');
            dialogService.error("E-mail invalide", "Veuillez saisir une adresse e-mail valide.");
            setStatus("Adresse e-mail invalide");
            registerForm.clearAfterError();
            setBusy(false);
            return;
        }
        setStatus("Inscription en cours...");
        setBusy(true);
        eventBus.publish(new RegistrationRequested(username, password, email));
        NarrationQueue queue = narrationQueue();
        if (queue != null) {
            queue.enqueue(registerForm.submitButton(), "Tentative d'inscription pour " + username);
        }
    }

    private void setStatus(String message) {
        SwingUtilities.invokeLater(() -> statusLabel.setText(message));
    }

    private void setBusy(boolean busy) {
        switch (currentCard) {
            case LANDING -> landingPanel.setBusy(busy);
            case LOGIN -> loginForm.setBusy(busy);
            case REGISTER -> registerForm.setBusy(busy);
        }
    }

    @Override
    public String id() {
        return "home";
    }

    @Override
    public HomeScreen getComponent() {
        return this;
    }

    @Override
    public void onShow(ScreenContext context) {
        this.screenManager = context.screenManager();
        showLanding();
        loginSuccessSub.set(eventBus.subscribe(LoginSucceeded.class, this::handleLoginSuccess));
        loginFailedSub.set(eventBus.subscribe(LoginFailed.class, this::handleLoginFailure));
        registrationSuccessSub.set(eventBus.subscribe(RegistrationSucceeded.class, this::handleRegistrationSuccess));
        registrationFailedSub.set(eventBus.subscribe(RegistrationFailed.class, this::handleRegistrationFailure));
    }

    @Override
    public void onHide(ScreenContext context) {
        this.screenManager = null;
        closeQuietly(loginSuccessSub.getAndSet(null));
        closeQuietly(loginFailedSub.getAndSet(null));
        closeQuietly(registrationSuccessSub.getAndSet(null));
        closeQuietly(registrationFailedSub.getAndSet(null));
        setBusy(false);
    }

    private void handleLoginSuccess(LoginSucceeded event) {
        setStatus("Connexion reussie pour " + event.username());
        loginForm.clearPassword();
        setBusy(false);
        if (screenManager != null) {
            SwingUtilities.invokeLater(() -> screenManager.show("main-menu"));
        }
    }

    private void handleLoginFailure(LoginFailed event) {
        setStatus("Connexion echouee : " + event.reason());
        dialogService.error("Connexion echouee", event.reason());
        loginForm.clearPassword();
        setBusy(false);
    }

    private void handleRegistrationSuccess(RegistrationSucceeded event) {
        setStatus("Compte cree pour " + event.username());
        dialogService.info("Inscription reussie", "Le compte " + event.username() + " est pret.");
        registerForm.clearAfterSuccess();
        setBusy(false);
        showLoginForm();
    }

    private void handleRegistrationFailure(RegistrationFailed event) {
        setStatus("Inscription echouee : " + event.reason());
        dialogService.error("Inscription echouee", event.reason());
        registerForm.clearAfterError();
        setBusy(false);
    }

    private void closeQuietly(AutoCloseable closable) {
        if (closable != null) {
            try {
                closable.close();
            } catch (Exception ignored) {
            }
        }
    }

    private NarrationQueue narrationQueue() {
        NarrationQueue queue = narrationQueue;
        if (queue == null && narrationQueueSupplier != null) {
            queue = narrationQueueSupplier.get();
            narrationQueue = queue;
        }
        return queue;
    }
}

