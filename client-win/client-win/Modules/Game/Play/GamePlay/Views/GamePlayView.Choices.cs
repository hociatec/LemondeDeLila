using System;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Threading;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Game.Play.GamePlay.ViewModels;

namespace client_win.Modules.Game.Play.GamePlay.Views;

public partial class GamePlayView
{
    private DateTime _suppressChoiceAutoFocusUntilUtc;
    private bool _restoreChoiceFocusAfterSubmit;
    private int _restoreChoiceFocusIndex;
    private DateTime _suppressHandAutoFocusUntilUtc;
    private bool _restoreHandFocusAfterSubmit;
    private int _restoreHandFocusIndex;

    public void FocusPreferredInteractiveElement()
    {
        ForceFocusGameZoneCore(forceFromOutsideTextInput: true);
        _ = Dispatcher.BeginInvoke(
            DispatcherPriority.Input,
            new Action(() => ForceFocusGameZoneCore(forceFromOutsideTextInput: true)));
        _ = Dispatcher.BeginInvoke(
            DispatcherPriority.Loaded,
            new Action(() => ForceFocusGameZoneCore(forceFromOutsideTextInput: true)));
        _ = Dispatcher.BeginInvoke(
            DispatcherPriority.ApplicationIdle,
            new Action(() => ForceFocusGameZoneCore(forceFromOutsideTextInput: true)));
    }

    private void NoteChoiceSubmittedForFocusRestore()
    {
        _suppressChoiceAutoFocusUntilUtc = DateTime.UtcNow;
        _restoreChoiceFocusAfterSubmit = false;
        _restoreChoiceFocusIndex = -1;
    }

    private void NoteHandSubmittedForFocusRestore()
    {
        _suppressHandAutoFocusUntilUtc = DateTime.UtcNow;
        _restoreHandFocusAfterSubmit = false;
        _restoreHandFocusIndex = -1;
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

        if (_vm != null && _vmPropertyChangedHandler != null)
        {
            _vm.PropertyChanged -= _vmPropertyChangedHandler;
        }

        _vm = vm;
        _choicesCollection = null;
        _choicesChanged = null;
        _focusRequestedHandler = null;
        _vmPropertyChangedHandler = null;

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

            _vmPropertyChangedHandler = (_, e) =>
            {
                // Quand la question de quiz apparaÃ®t/change, on veut la lire immÃ©diatement.
                if (!string.Equals(e.PropertyName, nameof(GamePlayViewModel.QuizQuestionText), StringComparison.Ordinal) &&
                    !string.Equals(e.PropertyName, nameof(GamePlayViewModel.PendingType), StringComparison.Ordinal) &&
                    !string.Equals(e.PropertyName, nameof(GamePlayViewModel.IsQuizPending), StringComparison.Ordinal))
                {
                    return;
                }

                if (IsTextInputFocused())
                {
                    return;
                }

                Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                {
                    UpdateChoicesAccessibility();
                }));
            };
            _vm.PropertyChanged += _vmPropertyChangedHandler;
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

            UpdateChoicesAccessibility();

            // AprÃ¨s validation d'un choix (EntrÃ©e), la liste se met Ã  jour (carte jouÃ©e/retirÃ©e).
            // Ã‰viter de voler le focus / annoncer la nouvelle premiÃ¨re ligne ("LAMA", etc.),
            // afin de laisser l'historique serveur annoncer l'action ("X joue un 3.").
            if (DateTime.UtcNow < _suppressChoiceAutoFocusUntilUtc)
            {
                if (_restoreChoiceFocusAfterSubmit)
                {
                    _restoreChoiceFocusAfterSubmit = false;
                    Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                    {
                        try
                        {
                            if (ChoicesList.Visibility != Visibility.Visible || ChoicesList.Items.Count <= 0)
                            {
                                ForceFocusGameZone();
                                return;
                            }

                            var count = ChoicesList.Items.Count;
                            var idx = _restoreChoiceFocusIndex;
                            if (idx < 0) idx = 0;
                            if (idx >= count) idx = count - 1;

                            ChoicesList.SelectedIndex = idx;
                            ChoicesList.ScrollIntoView(ChoicesList.SelectedItem);
                            TryFocusChoiceIndex(ChoicesList, idx);
                        }
                        catch
                        {
                            // ignore
                        }
                    }));
                }
                return;
            }

            if (_vm.PendingChoices.Count <= 0)
            {
                // Quand les choix disparaissent (ex: quiz aprÇ¸s rÇ¸ponse),
                // l'Ç¸lÇ¸ment focalisÇ¸ peut Å’tre dÇ¸truit par la virtualisation et WPF dÇ¸porte le focus hors de la zone de jeu.
                // On rÇ¸-ancre le focus best-effort, sauf si l'utilisateur est dans une zone de saisie.
                if (!IsTextInputFocused() && (!IsKeyboardFocusWithin || ChoicesList.IsKeyboardFocusWithin))
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

            // Keep focus on root; do not auto-focus choices list items.`r`n            // This prevents screen readers from announcing "liste" on state refreshes.`r`n            return;
        };

        notify.CollectionChanged += _choicesChanged;
    }

    private bool TryAutoFocusQuizQuestion()
    {
        if (DataContext is not GamePlayViewModel vm || !vm.IsQuizPending)
        {
            _lastAutoFocusedQuizQuestionText = string.Empty;
            return false;
        }

        var question = (vm.QuizQuestionText ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(question))
        {
            return false;
        }

        if (string.Equals(_lastAutoFocusedQuizQuestionText, question, StringComparison.Ordinal))
        {
            return false;
        }

        _lastAutoFocusedQuizQuestionText = question;

        // Quiz: la question est affichÃ©e comme 1Ã¨re ligne de la liste (index 0).
        if (ChoicesList.Visibility != Visibility.Visible || ChoicesList.Items.Count <= 0)
        {
            return false;
        }

        try
        {
            ChoicesList.SelectedIndex = 0;
            ChoicesList.ScrollIntoView(ChoicesList.SelectedItem);
            TryFocusChoiceIndex(ChoicesList, 0);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private void UpdateChoicesAccessibility()
    {
        if (_vm == null)
        {
            return;
        }

        var label = string.IsNullOrWhiteSpace(_vm.ChoicesLabel) ? string.Empty : _vm.ChoicesLabel.Trim();

        // Quiz: la liste contient "question + rÃ©ponses". Ne pas dupliquer la question dans le nom de liste.
        if (_vm.IsQuizPending)
        {
            ChoicesList.ClearValue(AutomationProperties.HelpTextProperty);
            AutomationProperties.SetName(ChoicesList, "Question et rÃ©ponses");
            ChoicesList.ClearValue(AutomationProperties.LabeledByProperty);
            return;
        }

        // NVDA utilise parfois LabeledBy plutÃ´t que Name.
        // On force un libellÃ© serveur (pending.label) et on Ã©vite HelpText (valeurs vides/null peuvent provoquer une erreur WPF).
        // On efface aussi tout HelpText dÃ©fini via XAML/BAML (anciennes versions) pour Ã©viter les annonces gÃ©nÃ©riques.
        ChoicesList.ClearValue(AutomationProperties.HelpTextProperty);
        if (string.IsNullOrWhiteSpace(label))
        {
            // Fallback : donner un nom Ã  la liste pour qu'elle soit correctement annoncÃ©e,
            // mÃªme si le serveur n'a pas fourni de label.
            if (_vm.IsQuizPending)
            {
                AutomationProperties.SetName(ChoicesList, "RÃ©ponses");
            }
            else
            {
                ChoicesList.ClearValue(AutomationProperties.NameProperty);
            }
        }
        else
        {
            AutomationProperties.SetName(ChoicesList, label);
        }

        // NOTE: On rÃ©cupÃ¨re le label via FindName pour Ã©viter une dÃ©pendance au champ gÃ©nÃ©rÃ© par le XAML,
        // qui peut ne pas Ãªtre rÃ©gÃ©nÃ©rÃ© dans certains scÃ©narios (build incrÃ©mentale / cache).
        if (!string.IsNullOrWhiteSpace(label) &&
            FindName("ChoicesLabelText") is FrameworkElement labelElement &&
            labelElement.Visibility == Visibility.Visible)
        {
            AutomationProperties.SetName(labelElement, label);
            AutomationProperties.SetLabeledBy(ChoicesList, labelElement);
            return;
        }

        ChoicesList.ClearValue(AutomationProperties.LabeledByProperty);
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
        TryFocusChoiceIndex(ChoicesList, 0);
    }

    private void ForceFocusGameZone() => ForceFocusGameZoneCore(forceFromOutsideTextInput: false);

    private void ForceFocusGameZoneCore(bool forceFromOutsideTextInput)
    {
        if (DataContext is GamePlayViewModel vmPrompt && vmPrompt.HasInlinePrompt)
        {
            FocusFirstInlinePromptField();
            return;
        }

        // Le reset d'une table peut "casser" le focus (l'Ã©lÃ©ment focusÃ© est dÃ©truit/collapsÃ©),
        // ce qui oblige ensuite Ã  Tab/Maj+Tab. Ici on force un ancrage stable sur la zone de jeu.
        if (!forceFromOutsideTextInput && IsTextInputFocused())
        {
            return;
        }

        // PrioritÃ© UX :
        // - si une grille est visible: ancrer sur la grille (jeux type Corridor)
        // - sinon, si une liste de choix est visible: ancrer sur cette liste (ex: LAMA = main)
        // - sinon: ancrer sur la vue racine
        if (DataContext is GamePlayViewModel vm && vm.Grid.IsVisible)
        {
            Focus();
            Keyboard.Focus(this);
            TryFocusPreferredGridCell();
            return;
        }

        if (HandList.Visibility == Visibility.Visible && HandList.Items.Count > 0)
        {
            if (HandList.SelectedIndex < 0)
            {
                HandList.SelectedIndex = 0;
            }
            // Keep keyboard focus on the game zone root. Auto-focusing the hand list makes
            // some screen readers announce "liste" on each state refresh/turn change.
            Focus();
            Keyboard.Focus(this);
            return;
        }

        if (ChoicesList.Visibility == Visibility.Visible && ChoicesList.Items.Count > 0)
        {
            if (ChoicesList.SelectedIndex < 0)
            {
                ChoicesList.SelectedIndex = 0;
            }
            // Same for the server choice list: do not auto-focus list items.
            Focus();
            Keyboard.Focus(this);
            return;
        }

        Focus();
        Keyboard.Focus(this);
    }

    private bool IsFocusWithinHandList()
    {
        if (HandList == null)
        {
            return false;
        }

        var focused = Keyboard.FocusedElement as DependencyObject;
        while (focused != null)
        {
            if (ReferenceEquals(focused, HandList))
            {
                return true;
            }

            focused = System.Windows.Media.VisualTreeHelper.GetParent(focused);
        }

        return false;
    }

    private void HookHandAutoFocus(GamePlayViewModel? vm)
    {
        if (_handCardsCollection != null && _handCardsChanged != null)
        {
            _handCardsCollection.CollectionChanged -= _handCardsChanged;
        }

        _handCardsCollection = null;
        _handCardsChanged = null;

        if (vm?.HandCards is not INotifyCollectionChanged handNotify)
        {
            return;
        }

        _handCardsCollection = handNotify;
        _handCardsChanged = (_, __) =>
        {
            if (IsTextInputFocused())
            {
                return;
            }

            // Never auto-focus the hand list on plain state refreshes/turn changes.
            // Keep explicit restore only after a user submit.
            if (!_restoreHandFocusAfterSubmit)
            {
                return;
            }

            // If the hand list is visible, keep keyboard focus anchored there to avoid NVDA re-announcing
            // the root "Partie en cours" on every state refresh (bot turns, played cards, etc.).
            var shouldRestore = DateTime.UtcNow < _suppressHandAutoFocusUntilUtc || IsFocusWithinHandList();
            if (!shouldRestore)
            {
                return;
            }
            // Avoid re-focusing the same hand item on every state refresh: this can make NVDA
            // announce "liste" repeatedly ("liste, liste") during turn changes.
            if (IsFocusWithinHandList() &&
                !_restoreHandFocusAfterSubmit &&
                DateTime.UtcNow >= _suppressHandAutoFocusUntilUtc)
            {
                return;
            }

            Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
            {
                try
                {
                    if (HandList.Visibility != Visibility.Visible || HandList.Items.Count <= 0)
                    {
                        return;
                    }

                    var count = HandList.Items.Count;
                    var idx = _restoreHandFocusAfterSubmit ? _restoreHandFocusIndex : HandList.SelectedIndex;
                    _restoreHandFocusAfterSubmit = false;

                    if (idx < 0) idx = 0;
                    if (idx >= count) idx = count - 1;

                    // Same guard on UI tick: ignore stale queued requests if focus is already correct.
                    if (IsFocusWithinHandList() && HandList.SelectedIndex == idx)
                    {
                        return;
                    }

                    HandList.SelectedIndex = idx;
                    HandList.ScrollIntoView(HandList.SelectedItem);
                    TryFocusChoiceIndex(HandList, idx);
                }
                catch
                {
                    // ignore
                }
            }));
        };
        handNotify.CollectionChanged += _handCardsChanged;
    }

    private INotifyCollectionChanged? _handCardsCollection;
    private NotifyCollectionChangedEventHandler? _handCardsChanged;

    private async void OnChoicesKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key is not (Key.Enter or Key.Return))
        {
            return;
        }
        if (DataContext is not GamePlayViewModel vm)
        {
            return;
        }
        // Le ListBox de quiz doit "consommer" Enter pour envoyer la rÃ©ponse sÃ©lectionnÃ©e,
        // afin de ne pas dÃ©clencher le raccourci global Enter (roll).
        e.Handled = true;
        try
        {
            bool sent = await vm.SubmitSelectedChoiceAsync(CancellationToken.None).ConfigureAwait(true);
            if (sent)
            {
                NoteChoiceSubmittedForFocusRestore();
                return;
            }

            // Quiz: si l'utilisateur est sur la ligne "question", Enter doit aller Ã  la 1Ã¨re rÃ©ponse.
            if (vm.IsQuizPending && ChoicesList.Items.Count > 1 && ChoicesList.SelectedIndex == 0)
            {
                ChoicesList.SelectedIndex = 1;
                ChoicesList.ScrollIntoView(ChoicesList.SelectedItem);
                TryFocusChoiceIndex(ChoicesList, 1);
            }
        }
        catch
        {
            // ignore (Enter reste consommÃ©)
        }
    }
}
