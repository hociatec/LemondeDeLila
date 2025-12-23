using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Messaging.Models;
using client_win.Modules.Messaging.ViewModels;

namespace client_win.Modules.Messaging.Views;

public partial class MessagingView : UserControl
{
    // Suivi de la section active (0=Boîtes, 1=Messages, 2=Conversation)
    private int _currentSection = 0;

    public MessagingView()
    {
        InitializeComponent();
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (DataContext is MessagingViewModel vm)
        {
            await vm.InitializeAsync();
        }

        // Focus initial sur la section Boîtes
        await Dispatcher.InvokeAsync(() =>
        {
            FocusSection(0);
        }, DispatcherPriority.Input);
    }

    /// <summary>
    /// Gestion globale des touches (Échap, Flèches haut/bas)
    /// </summary>
    private void OnRootKeyDown(object sender, KeyEventArgs e)
    {
        // ÉCHAP : Fermer la messagerie
        if (e.Key == Key.Escape && DataContext is MessagingViewModel vm)
        {
            vm.CloseCommand.Execute(null);
            e.Handled = true;
            return;
        }

        // FLÈCHE BAS : Passer à la section suivante
        if (e.Key == Key.Down && (Keyboard.Modifiers & ModifierKeys.Control) != 0)
        {
            NavigateToNextSection();
            e.Handled = true;
            return;
        }

        // FLÈCHE HAUT : Passer à la section précédente
        if (e.Key == Key.Up && (Keyboard.Modifiers & ModifierKeys.Control) != 0)
        {
            NavigateToPreviousSection();
            e.Handled = true;
            return;
        }
    }

    /// <summary>
    /// Navigation vers la section suivante (Ctrl+Flèche Bas)
    /// </summary>
    private void NavigateToNextSection()
    {
        _currentSection = (_currentSection + 1) % 3; // 0->1->2->0
        FocusSection(_currentSection);
    }

    /// <summary>
    /// Navigation vers la section précédente (Ctrl+Flèche Haut)
    /// </summary>
    private void NavigateToPreviousSection()
    {
        _currentSection = (_currentSection - 1 + 3) % 3; // 2->1->0->2
        FocusSection(_currentSection);
    }

    /// <summary>
    /// Focus sur une section spécifique et applique un highlight visuel
    /// </summary>
    private void FocusSection(int section)
    {
        // Réinitialise les bordures
        ResetPanelBorders();

        switch (section)
        {
            case 0: // Section Boîtes
                HighlightPanel(BoxesPanel);
                BtnInbox.Focus();
                break;

            case 1: // Section Messages
                HighlightPanel(MessagesPanel);
                MessagesList.Focus();
                if (MessagesList.Items.Count > 0 && MessagesList.SelectedIndex < 0)
                {
                    MessagesList.SelectedIndex = 0;
                }
                break;

            case 2: // Section Conversation
                HighlightPanel(ConversationPanel);
                ConversationList.Focus();
                if (ConversationList.Items.Count > 0 && ConversationList.SelectedIndex < 0)
                {
                    ConversationList.SelectedIndex = ConversationList.Items.Count - 1;
                }
                break;
        }

        _currentSection = section;
    }

    /// <summary>
    /// Réinitialise les bordures de tous les panneaux
    /// </summary>
    private void ResetPanelBorders()
    {
        BoxesPanel.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#1E3C5B"));
        MessagesPanel.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#2A4A6A"));
        ConversationPanel.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#3A5E8C"));
    }

    /// <summary>
    /// Applique un highlight visuel au panneau actif
    /// </summary>
    private void HighlightPanel(Border panel)
    {
        panel.BorderBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FFD966"));
    }

    /// <summary>
    /// Gestion des touches dans la section Boîtes
    /// </summary>
    private void OnBoxesPanelKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Down && (Keyboard.Modifiers & ModifierKeys.Control) == 0)
        {
            // Navigation interne avec flèches (sans Ctrl)
            e.Handled = false; // Laisse WPF gérer la navigation interne
        }
        else if (e.Key == Key.Up && (Keyboard.Modifiers & ModifierKeys.Control) == 0)
        {
            e.Handled = false; // Laisse WPF gérer la navigation interne
        }
        else if (e.Key == Key.Enter)
        {
            // Enter : ouvrir la boîte sélectionnée ou lancer la recherche
            e.Handled = true;
        }
    }

    /// <summary>
    /// Gestion des touches dans la section Messages
    /// </summary>
    private void OnMessagesPanelKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter && DataContext is MessagingViewModel vm)
        {
            vm.OpenConversationCommand.Execute(null);
            e.Handled = true;
            FocusSection(2); // Passer à la conversation
        }
        else if (e.Key == Key.Down && (Keyboard.Modifiers & ModifierKeys.Control) == 0)
        {
            e.Handled = false; // Navigation interne dans la liste
        }
        else if (e.Key == Key.Up && (Keyboard.Modifiers & ModifierKeys.Control) == 0)
        {
            e.Handled = false; // Navigation interne dans la liste
        }
    }

    /// <summary>
    /// Gestion des touches dans la section Conversation
    /// </summary>
    private void OnConversationPanelKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Delete && DataContext is MessagingViewModel vm)
        {
            vm.DeleteCommand.Execute(null);
            e.Handled = true;
        }
        else if (e.Key == Key.Down && (Keyboard.Modifiers & ModifierKeys.Control) == 0)
        {
            e.Handled = false; // Navigation interne dans la liste
        }
        else if (e.Key == Key.Up && (Keyboard.Modifiers & ModifierKeys.Control) == 0)
        {
            e.Handled = false; // Navigation interne dans la liste
        }
    }

    /// <summary>
    /// Double-clic sur un message : ouvrir la conversation
    /// </summary>
    private void OnMessagesDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (DataContext is MessagingViewModel vm)
        {
            vm.OpenConversationCommand.Execute(null);
            FocusSection(2); // Passer à la conversation
        }
    }

    /// <summary>
    /// Clic sur un bouton de boîte
    /// </summary>
    private void OnBoxClick(object sender, RoutedEventArgs e)
    {
        if (DataContext is not MessagingViewModel vm || sender is not FrameworkElement fe || fe.Tag is not MessagingBox box)
        {
            return;
        }
        vm.SelectedBox = box;
        FocusSection(1); // Passer aux messages après sélection de boîte
    }

    /// <summary>
    /// Touche Enter dans la zone de recherche
    /// </summary>
    private void OnSearchKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter && DataContext is MessagingViewModel vm)
        {
            vm.SearchUserCommand.Execute(null);
            e.Handled = true;
            FocusSection(2); // Passer à la conversation après recherche
        }
        else if (e.Key == Key.Down || e.Key == Key.Up)
        {
            e.Handled = false; // Permettre la navigation normale dans la TextBox
        }
    }

    /// <summary>
    /// Touche Enter dans la zone d'input de message
    /// </summary>
    private void OnInputKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter && DataContext is MessagingViewModel vm)
        {
            vm.SendCommand.Execute(null);
            e.Handled = true;
        }
        else if (e.Key == Key.Down || e.Key == Key.Up)
        {
            e.Handled = false; // Permettre la navigation normale dans la TextBox
        }
    }
}
