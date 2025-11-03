package com.lemondelila.client.user.view;

/**
 * Contrat d'affichage pour le formulaire de connexion.
 */
public interface LoginView {

    void setLoginListener(LoginListener listener);

    void showView();

    void setLoading(boolean loading);

    void showError(String message);

    void showSuccess(String message);

    void clearPassword();

    void focusUsername();

    interface LoginListener {
        void onLoginRequested(String username, char[] password);
    }
}
