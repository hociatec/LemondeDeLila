using System;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Messaging.Models;
using client_win.Modules.Messaging.ViewModels;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Messaging.Views;

public partial class MessagingView : UserControl, IInitialFocusTarget
{
    private int _focusRequestId;
    private enum MessagingScreen
    {
        Menu,
        List,
        Detail,
        Compose
    }

    private MessagingScreen _currentScreen = MessagingScreen.Menu;
    private MessagingScreen _screenBeforeCompose = MessagingScreen.Menu;
    private MessagingViewModel? _vm;

    public MessagingView()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        await Dispatcher.InvokeAsync(() =>
        {
            // IMPORTANT : forcer le focus dans la vue dès l'ouverture.
            // Sinon la vue précédente peut conserver le focus (Échap ne fait rien et Tab navigue ailleurs).
            // Ne pas forcer le focus sur la vue elle-meme (sinon certains lecteurs d'ecran annoncent "inconnu").
            // Le focus est gere par ShowScreen() (menu / liste / detail / redaction).

            if (MenuList.Items.Count > 0)
            {
                MenuList.SelectedIndex = 0;
            }
            ShowScreen(MessagingScreen.Menu);
        }, DispatcherPriority.Input);

        if (DataContext is MessagingViewModel vm)
        {
            _ = InitializeVmAsync(vm);
        }
    }

    private static async Task InitializeVmAsync(MessagingViewModel vm)
    {
        try
        {
            await vm.InitializeAsync().ConfigureAwait(true);
        }
        catch
        {
            // Best-effort: éviter une exception non gérée qui bloquerait l'UI.
        }
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        DetachVmHandlers();
        _vm = DataContext as MessagingViewModel;
        AttachVmHandlers();
    }

    private void AttachVmHandlers()
    {
        if (_vm == null)
        {
            return;
        }

        _vm.BoxMessages.CollectionChanged += OnBoxMessagesChanged;
        _vm.PropertyChanged += OnVmPropertyChanged;
        _vm.FocusFirstMessageRequested += OnFocusFirstMessageRequested;
        _vm.NavigateHomeRequested += OnNavigateHomeRequested;
        UpdateDetailDocument();
    }

    private void DetachVmHandlers()
    {
        if (_vm == null)
        {
            return;
        }

        _vm.BoxMessages.CollectionChanged -= OnBoxMessagesChanged;
        _vm.PropertyChanged -= OnVmPropertyChanged;
        _vm.FocusFirstMessageRequested -= OnFocusFirstMessageRequested;
        _vm.NavigateHomeRequested -= OnNavigateHomeRequested;
        _vm = null;
    }

    private void OnNavigateHomeRequested(object? sender, EventArgs e)
    {
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            if (MenuList.Items.Count > 0)
            {
                MenuList.SelectedIndex = 0;
            }
            ShowScreen(MessagingScreen.Menu);
        }));
    }

    private void OnFocusFirstMessageRequested(object? sender, EventArgs e)
    {
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            // Après une suppression/restauration, revenir à la liste et replacer le focus sur le 1er item
            // (cohérent clavier / lecteur d'écran).
            if (_currentScreen != MessagingScreen.List)
            {
                ShowScreen(MessagingScreen.List);
                return;
            }

            if (MessagesList.Items.Count > 0)
            {
                MessagesList.SelectedIndex = 0;
            }
            FocusMessagesWhenReady();
        }));
    }

    private void OnVmPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(MessagingViewModel.SelectedMessage) ||
            e.PropertyName == nameof(MessagingViewModel.SelectedMessageDetailText))
        {
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(UpdateDetailDocument));
        }

        if (_currentScreen != MessagingScreen.List)
        {
            return;
        }

        if (e.PropertyName == nameof(MessagingViewModel.SelectedBox))
        {
            _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusMessagesWhenReady));
        }
    }

    private void OnBoxMessagesChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        if (_currentScreen != MessagingScreen.List)
        {
            return;
        }

        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusMessagesWhenReady));
    }

    private void OnRootKeyDown(object sender, KeyEventArgs e)
    {
        if (DataContext is not MessagingViewModel vm)
        {
            return;
        }

        if (_currentScreen is MessagingScreen.Detail or MessagingScreen.List
            && (Keyboard.Modifiers & ModifierKeys.Control) == ModifierKeys.Control)
        {
            if (e.Key == Key.R)
            {
                if (vm.SelectedBox == MessagingBox.Deleted)
                {
                    vm.RestoreCommand.Execute(null);
                }
                e.Handled = true;
                return;
            }
        }

        if (e.Key != Key.Escape)
        {
            return;
        }

        e.Handled = true;
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            try
            {
                switch (_currentScreen)
                {
                    case MessagingScreen.Menu:
                        vm.CloseCommand.Execute(null);
                        break;
                    case MessagingScreen.List:
                        ShowScreen(MessagingScreen.Menu);
                        break;
                    case MessagingScreen.Detail:
                        ShowScreen(MessagingScreen.List);
                        break;
                    case MessagingScreen.Compose:
                        var target = _screenBeforeCompose == MessagingScreen.Compose
                            ? MessagingScreen.Menu
                            : _screenBeforeCompose;
                        ShowScreen(target);
                        break;
                }
            }
            catch
            {
                // best-effort
            }
        }));
    }

    private void ShowScreen(MessagingScreen screen)
    {
        // IMPORTANT (NVDA): before collapsing panels, move focus to a stable element that won't disappear.
        // Otherwise NVDA may announce "indisponible" when the currently focused control becomes invisible.
        FocusParking.ForcePark();

        _currentScreen = screen;
        MenuPanel.Visibility = screen == MessagingScreen.Menu ? Visibility.Visible : Visibility.Collapsed;
        ListPanel.Visibility = screen == MessagingScreen.List ? Visibility.Visible : Visibility.Collapsed;
        DetailPanel.Visibility = screen == MessagingScreen.Detail ? Visibility.Visible : Visibility.Collapsed;
        ComposePanelContainer.Visibility = screen == MessagingScreen.Compose ? Visibility.Visible : Visibility.Collapsed;

        if (DataContext is MessagingViewModel vm)
        {
            vm.IsComposeMode = screen == MessagingScreen.Compose;
        }

        _ = Dispatcher.InvokeAsync(() =>
        {
            switch (screen)
            {
                case MessagingScreen.Menu:
                    if (MenuList.Items.Count > 0 && MenuList.SelectedIndex < 0)
                    {
                        MenuList.SelectedIndex = 0;
                    }
                    FocusListItem(MenuList);
                    break;
                case MessagingScreen.List:
                    FocusMessagesWhenReady();
                    break;
                case MessagingScreen.Detail:
                    UpdateDetailDocument();
                    DetailDocument.Focus();
                    break;
                case MessagingScreen.Compose:
                    ComposePanel.FocusFirstField();
                    break;
            }
        }, DispatcherPriority.Input);
    }

    private void UpdateDetailDocument()
    {
        if (_vm == null || DetailDocument == null)
        {
            return;
        }

        var text = _vm.SelectedMessageDetailText ?? string.Empty;
        text = text.Replace("\r\n", "\n", StringComparison.Ordinal);

        var doc = DetailDocument.Document;
        doc.Blocks.Clear();

        // IMPORTANT (NVDA):
        // Les lignes vides dans RichTextBox peuvent provoquer des lectures en double sur certains libellés.
        // On garde une structure "document" en paragraphes (espacement via Margin) plutôt qu'avec des lignes vides.
        var lines = text.Split('\n');
        if (lines.Length == 0)
        {
            return;
        }

        string subjectLine = lines.Length > 0 ? lines[0] : string.Empty;
        string deLine = lines.Length > 1 ? lines[1] : string.Empty;
        string aLine = lines.Length > 2 ? lines[2] : string.Empty;
        string contenuLine = lines.Length > 3 ? lines[3] : string.Empty;
        var bodyLines = lines.Length > 4 ? lines[4..] : Array.Empty<string>();

        doc.Blocks.Add(new Paragraph(new Run(subjectLine)) { Margin = new Thickness(0) });

        var pMeta = new Paragraph { Margin = new Thickness(0, 10, 0, 0) };
        pMeta.Inlines.Add(new Run(deLine));
        pMeta.Inlines.Add(new LineBreak());
        pMeta.Inlines.Add(new Run(aLine));
        doc.Blocks.Add(pMeta);

        var pBody = new Paragraph { Margin = new Thickness(0, 10, 0, 0) };
        pBody.Inlines.Add(new Run(contenuLine));
        if (bodyLines.Length > 0)
        {
            pBody.Inlines.Add(new LineBreak());
        }
        for (int i = 0; i < bodyLines.Length; i++)
        {
            pBody.Inlines.Add(new Run(bodyLines[i]));
            if (i < bodyLines.Length - 1)
            {
                pBody.Inlines.Add(new LineBreak());
            }
        }
        doc.Blocks.Add(pBody);

        // Positionner le caret au début pour une lecture cohérente.
        try
        {
            DetailDocument.CaretPosition = doc.ContentStart;
        }
        catch
        {
            // ignore
        }
    }

    private void FocusListItem(ListBox listBox)
    {
        if (listBox.Items.Count == 0)
        {
            listBox.Focus();
            Keyboard.Focus(listBox);
            return;
        }

        var index = listBox.SelectedIndex >= 0 ? listBox.SelectedIndex : 0;
        listBox.ScrollIntoView(listBox.Items[index]);
        var requestId = unchecked(++_focusRequestId);
        FocusListItemWithRetry(requestId, listBox, index, attemptsRemaining: 8);
    }

    private void FocusListItemWithRetry(int requestId, ListBox listBox, int index, int attemptsRemaining)
    {
        if (listBox.Items.Count == 0)
        {
            listBox.Focus();
            Keyboard.Focus(listBox);
            return;
        }

        var safeIndex = Math.Max(0, Math.Min(index, listBox.Items.Count - 1));
        listBox.ScrollIntoView(listBox.Items[safeIndex]);
        if (listBox.ItemContainerGenerator.ContainerFromIndex(safeIndex) is ListBoxItem container)
        {
            container.Focus();
            Keyboard.Focus(container);
            return;
        }

        if (attemptsRemaining > 0 && requestId == _focusRequestId)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Loaded,
                new Action(() => FocusListItemWithRetry(requestId, listBox, safeIndex, attemptsRemaining - 1)));
            return;
        }

        listBox.Focus();
        Keyboard.Focus(listBox);
    }

    private void FocusMessagesWhenReady()
    {
        if (!MessagesList.IsVisible)
        {
            return;
        }

        if (MessagesList.Items.Count == 0)
        {
            // Ne pas forcer le focus sur le placeholder "Aucun message" :
            // la liste peut être temporairement vide pendant un chargement, et certains lecteurs d'écran
            // annoncent alors "Aucun message" avant d'énumérer les items quand ils arrivent.
            MessagesList.Focus();
            return;
        }

        if (MessagesList.SelectedIndex < 0)
        {
            MessagesList.SelectedIndex = 0;
        }

        if (MessagesList.ItemContainerGenerator.Status == System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
        {
            FocusListItem(MessagesList);
            return;
        }

        EventHandler? handler = null;
        handler = (_, __) =>
        {
            if (MessagesList.ItemContainerGenerator.Status != System.Windows.Controls.Primitives.GeneratorStatus.ContainersGenerated)
            {
                return;
            }
            MessagesList.ItemContainerGenerator.StatusChanged -= handler;
            FocusListItem(MessagesList);
        };
        MessagesList.ItemContainerGenerator.StatusChanged += handler;
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
                _screenBeforeCompose = MessagingScreen.Menu;
                vm.IsComposeMode = true;
                ShowScreen(MessagingScreen.Compose);
                break;
            case "inbox":
                vm.IsComposeMode = false;
                if (vm.SelectedBox != MessagingBox.Inbox)
                {
                    vm.SelectedBox = MessagingBox.Inbox;
                }
                else
                {
                    _ = vm.ReloadSelectedBoxAsync();
                }
                ShowScreen(MessagingScreen.List);
                break;
            case "outbox":
                vm.IsComposeMode = false;
                if (vm.SelectedBox != MessagingBox.Outbox)
                {
                    vm.SelectedBox = MessagingBox.Outbox;
                }
                else
                {
                    _ = vm.ReloadSelectedBoxAsync();
                }
                ShowScreen(MessagingScreen.List);
                break;
            case "deleted":
                vm.IsComposeMode = false;
                if (vm.SelectedBox != MessagingBox.Deleted)
                {
                    vm.SelectedBox = MessagingBox.Deleted;
                }
                else
                {
                    _ = vm.ReloadSelectedBoxAsync();
                }
                ShowScreen(MessagingScreen.List);
                break;
        }
    }

    private async void OnMessagesKeyDown(object sender, KeyEventArgs e)
    {
        if (DataContext is not MessagingViewModel vm)
        {
            return;
        }

        if (e.Key == Key.Delete)
        {
            if (MessagesList?.SelectedItems == null || MessagesList.SelectedItems.Count == 0)
            {
                return;
            }

            var items = MessagesList.SelectedItems.OfType<MessagingMessage>().ToArray();
            if (items.Length == 0)
            {
                return;
            }

            var handled = await vm.DeleteMessagesAsync(items).ConfigureAwait(true);
            if (handled)
            {
                e.Handled = true;
            }

            return;
        }

        if (e.Key == Key.Enter)
        {
            OpenMessageDetail();
            e.Handled = true;
        }
    }

    private void OnMessagesDoubleClick(object sender, MouseButtonEventArgs e)
    {
        OpenMessageDetail();
    }

    private void OpenMessageDetail()
    {
        if (DataContext is not MessagingViewModel vm)
        {
            return;
        }

        if (vm.SelectedMessage == null)
        {
            return;
        }

        ShowScreen(MessagingScreen.Detail);
        _ = vm.MarkSelectedMessageReadAsync();
    }

    private void OnReplyClick(object sender, RoutedEventArgs e)
    {
        // The button's Command (ReplyCommand) prepares the compose fields.
        // We only need to switch the UI to the compose screen.
        _screenBeforeCompose = _currentScreen;
        _ = Dispatcher.BeginInvoke(
            DispatcherPriority.Input,
            new Action(() => ShowScreen(MessagingScreen.Compose)));
    }

    public void RequestInitialFocus()
    {
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            if (MenuList.Items.Count > 0 && MenuList.SelectedIndex < 0)
            {
                MenuList.SelectedIndex = 0;
            }
            ShowScreen(MessagingScreen.Menu);
        }));
    }
}
