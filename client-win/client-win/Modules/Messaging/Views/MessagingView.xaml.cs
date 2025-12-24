using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
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
    private const int SectionCount = 3;

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
            if (MenuList.Items.Count > 0)
            {
                MenuList.SelectedIndex = 0;
            }
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

        if (Keyboard.FocusedElement is TextBoxBase)
        {
            return;
        }

        // FLÈCHE DROITE : Passer à la section suivante
        if (e.Key == Key.Right)
        {
            NavigateToNextSection();
            e.Handled = true;
            return;
        }

        // FLÈCHE GAUCHE : Passer à la section précédente
        if (e.Key == Key.Left)
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
        _currentSection = (_currentSection + 1) % SectionCount; // 0->1->2->0
        FocusSection(_currentSection);
    }

    /// <summary>
    /// Navigation vers la section précédente (Ctrl+Flèche Haut)
    /// </summary>
    private void NavigateToPreviousSection()
    {
        _currentSection = (_currentSection - 1 + SectionCount) % SectionCount; // 2->1->0->2
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
                MenuList.Focus();
                if (MenuList.Items.Count > 0 && MenuList.SelectedIndex < 0)
                {
                    MenuList.SelectedIndex = 0;
                }
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
                if (DataContext is MessagingViewModel { IsComposeMode: true })
                {
                    ComposePanel.FocusFirstField();
                    break;
                }
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

    private void OnMenuPanelKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key is Key.Up or Key.Down)
        {
            e.Handled = false;
        }
    }

    private void OnMenuKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            ActivateMenuSelection();
            e.Handled = true;
        }
    }

    private void OnMenuClick(object sender, MouseButtonEventArgs e)
    {
        ActivateMenuSelection();
    }

    private void ActivateMenuSelection()
    {
        if (DataContext is not MessagingViewModel vm || MenuList.SelectedItem is not ListBoxItem item)
        {
            return;
        }

        var tag = item.Tag as string ?? string.Empty;
        switch (tag)
        {
            case "compose":
                vm.IsComposeMode = true;
                FocusSection(2);
                break;
            case "inbox":
                vm.IsComposeMode = false;
                vm.SelectedBox = MessagingBox.Inbox;
                FocusSection(1);
                break;
            case "outbox":
                vm.IsComposeMode = false;
                vm.SelectedBox = MessagingBox.Outbox;
                FocusSection(1);
                break;
            case "deleted":
                vm.IsComposeMode = false;
                vm.SelectedBox = MessagingBox.Deleted;
                FocusSection(1);
                break;
        }
    }

    /// <summary>
    /// Gestion des touches dans la section Messages
    /// </summary>
    private void OnMessagesPanelKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter && DataContext is MessagingViewModel vm)
        {
            vm.IsComposeMode = false;
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
            vm.IsComposeMode = false;
            vm.OpenConversationCommand.Execute(null);
            FocusSection(2); // Passer à la conversation
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
