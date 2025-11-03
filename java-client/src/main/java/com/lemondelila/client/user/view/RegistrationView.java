package com.lemondelila.client.user.view;

/**
 * Contrat d'affichage pour le formulaire d'inscription.
 */
public interface RegistrationView {

    void setRegistrationListener(RegistrationListener listener);

    void setRegistrationLoading(boolean loading);

    void showRegistrationError(String message);

    void showRegistrationSuccess(String message);

    void clearRegistrationForm();

    void clearRegistrationPassword();

    void focusRegistrationUsername();

    void switchToLoginTab();

    interface RegistrationListener {
        void onRegistrationRequested(String username, String email, char[] password);
    }
}
