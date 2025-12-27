using System;
using System.Collections.Specialized;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using System.Windows.Controls.Primitives;
using client_win.Modules.Game.Play.ViewModels;

namespace client_win.Modules.Game.Play.Views;

public partial class GamePlayView : UserControl
{
    private int _initialized;
    private GamePlayViewModel? _vm;
    private INotifyCollectionChanged? _choicesCollection;
    private NotifyCollectionChangedEventHandler? _choicesChanged;
    private Action? _focusRequestedHandler;

    public GamePlayView()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
        Unloaded += OnUnloaded;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (System.Threading.Interlocked.Exchange(ref _initialized, 1) == 1)
        {
            return;
        }

        if (DataContext is GamePlayViewModel vm)
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
                await vm.InitializeAsync(cts.Token).ConfigureAwait(true);
            }
            catch
            {
                // Best-effort: l'état de connexion est déjà exposé dans le ViewModel.
            }
        }
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        HookChoiceAutoFocus(DataContext as GamePlayViewModel);
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        HookChoiceAutoFocus(null);
    }

    private void HookChoiceAutoFocus(GamePlayViewModel? vm)
    {
        if (_choicesCollection != null && _choicesChanged != null)
        {
            _choicesCollection.CollectionChanged -= _choicesChanged;
        }

        if (_vm != null && _focusRequestedHandler != null)
        {
            _vm.GameZoneFocusRequested -= _focusRequestedHandler;
        }

        _vm = vm;
        _choicesCollection = null;
        _choicesChanged = null;
        _focusRequestedHandler = null;

        if (_vm != null)
        {
            _focusRequestedHandler = () =>
            {
                Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                {
                    ForceFocusGameZone();
                }));
            };
            _vm.GameZoneFocusRequested += _focusRequestedHandler;
        }

        if (vm?.PendingChoices is not INotifyCollectionChanged notify)
        {
            return;
        }

        _choicesCollection = notify;
        _choicesChanged = (_, __) =>
        {
            if (_vm == null)
            {
                return;
            }

            if (_vm.PendingChoices.Count <= 0)
            {
                if (ChoicesList.IsKeyboardFocusWithin)
                {
                    Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                    {
                        ForceFocusGameZone();
                    }));
                }
                return;
            }

            // Ne pas voler le focus si l'utilisateur est dans une zone de saisie/lecture (ex: historique).
            if (IsTextInputFocused())
            {
                return;
            }

            Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
            {
                TryFocusFirstChoice();
            }));
        };

        notify.CollectionChanged += _choicesChanged;
    }

    private bool IsTextInputFocused()
    {
        var focused = Keyboard.FocusedElement;
        return focused is TextBoxBase ||
               focused is PasswordBox ||
               focused is RichTextBox;
    }

    private void TryFocusFirstChoice()
    {
        if (_vm == null)
        {
            return;
        }

        if (ChoicesList.Visibility != Visibility.Visible || ChoicesList.Items.Count == 0)
        {
            return;
        }

        if (ChoicesList.SelectedIndex < 0)
        {
            ChoicesList.SelectedIndex = 0;
        }

        ChoicesList.ScrollIntoView(ChoicesList.SelectedItem);
        ChoicesList.UpdateLayout();

        if (ChoicesList.ItemContainerGenerator.ContainerFromIndex(0) is ListBoxItem firstItem)
        {
            firstItem.Focus();
            Keyboard.Focus(firstItem);
            return;
        }

        // Fallback: focus la liste, puis on retente après layout pour que le container existe.
        ChoicesList.Focus();
        Keyboard.Focus(ChoicesList);
        Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
        {
            if (ChoicesList.ItemContainerGenerator.ContainerFromIndex(0) is ListBoxItem item)
            {
                item.Focus();
                Keyboard.Focus(item);
            }
        }));
    }

    private void ForceFocusGameZone()
    {
        // Le reset d'une table peut "casser" le focus (l'élément focusé est détruit/collapsé),
        // ce qui oblige ensuite à Tab/Maj+Tab. Ici on force un ancrage stable sur la zone de jeu.
        if (IsTextInputFocused())
        {
            return;
        }

        Focus();
        Keyboard.Focus(this);
    }

    private async void OnChoicesKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Enter)
        {
            return;
        }
        if (DataContext is not GamePlayViewModel vm)
        {
            return;
        }
        // Le ListBox de quiz doit "consommer" Enter pour envoyer la réponse sélectionnée,
        // afin de ne pas déclencher le raccourci global Enter (roll).
        try
        {
            bool sent = await vm.SubmitSelectedChoiceAsync(CancellationToken.None).ConfigureAwait(true);
            if (sent)
            {
                e.Handled = true;
                Focus();
                Keyboard.Focus(this);
            }
        }
        catch
        {
            e.Handled = true;
        }
    }
}
