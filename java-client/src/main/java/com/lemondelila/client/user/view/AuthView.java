package com.lemondelila.client.user.view;

public interface AuthView {
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
