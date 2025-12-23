using System;
using System.Security;
using System.Windows;
using System.Windows.Controls;

namespace client_win.Behaviors;

/// <summary>
/// Attached behavior pour synchroniser le SecurePassword d'un PasswordBox avec un SecureString dans le ViewModel.
/// Évite la duplication de code et gère correctement le Dispose des anciennes instances.
/// </summary>
public static class PasswordBoxBehavior
{
    private static bool _isUpdating;

    public static readonly DependencyProperty BoundPasswordProperty =
        DependencyProperty.RegisterAttached(
            "BoundPassword",
            typeof(SecureString),
            typeof(PasswordBoxBehavior),
            new FrameworkPropertyMetadata(null, OnBoundPasswordChanged)
            {
                BindsTwoWayByDefault = true
            });

    public static readonly DependencyProperty BindPasswordProperty =
        DependencyProperty.RegisterAttached(
            "BindPassword",
            typeof(bool),
            typeof(PasswordBoxBehavior),
            new PropertyMetadata(false, OnBindPasswordChanged));

    public static SecureString? GetBoundPassword(DependencyObject dp)
    {
        return (SecureString?)dp.GetValue(BoundPasswordProperty);
    }

    public static void SetBoundPassword(DependencyObject dp, SecureString? value)
    {
        dp.SetValue(BoundPasswordProperty, value);
    }

    public static bool GetBindPassword(DependencyObject dp)
    {
        return (bool)dp.GetValue(BindPasswordProperty);
    }

    public static void SetBindPassword(DependencyObject dp, bool value)
    {
        dp.SetValue(BindPasswordProperty, value);
    }

    private static void OnBindPasswordChanged(DependencyObject dp, DependencyPropertyChangedEventArgs e)
    {
        if (dp is not PasswordBox passwordBox)
        {
            return;
        }

        bool wasBound = (bool)e.OldValue;
        bool isBound = (bool)e.NewValue;

        if (wasBound)
        {
            passwordBox.PasswordChanged -= OnPasswordChanged;
        }

        if (isBound)
        {
            passwordBox.PasswordChanged += OnPasswordChanged;
        }
    }

    private static void OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        if (_isUpdating || sender is not PasswordBox passwordBox)
        {
            return;
        }

        _isUpdating = true;
        try
        {
            // Dispose de l'ancienne SecureString pour éviter les fuites mémoire
            var oldPassword = GetBoundPassword(passwordBox);
            if (oldPassword != null && !oldPassword.IsReadOnly())
            {
                oldPassword.Dispose();
            }

            // Crée une copie du SecurePassword
            SetBoundPassword(passwordBox, passwordBox.SecurePassword.Copy());
        }
        finally
        {
            _isUpdating = false;
        }
    }

    private static void OnBoundPasswordChanged(DependencyObject dp, DependencyPropertyChangedEventArgs e)
    {
        if (_isUpdating || dp is not PasswordBox passwordBox)
        {
            return;
        }

        // Note: On ne met pas à jour le PasswordBox.Password depuis le ViewModel
        // car cela causerait des problèmes de curseur et de synchronisation
        // Cette direction est à sens unique : PasswordBox -> ViewModel
    }
}
