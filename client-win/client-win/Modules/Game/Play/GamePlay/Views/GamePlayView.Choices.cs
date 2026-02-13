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
                // When quiz question state changes, refresh accessibility labels immediately.
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

            // After validating a choice, the list refreshes (card played/removed).
            // Avoid stealing focus or announcing the new first row.
            // Let server history announce the action instead.
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
                // When choices disappear (e.g. after quiz answer), virtualization can remove
                // the focused element and push focus out of the game zone.
                // Re-anchor focus best-effort unless user is typing.
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

        // Quiz: the question is shown as first row in the list (index 0).
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

        // Quiz: the list already contains question + answers. Do not duplicate it in list name.
        if (_vm.IsQuizPending)
        {
            ChoicesList.ClearValue(AutomationProperties.HelpTextProperty);
            AutomationProperties.SetName(ChoicesList, "Question et réponses");
            ChoicesList.ClearValue(AutomationProperties.LabeledByProperty);
            return;
        }

        // NVDA may use LabeledBy instead of Name.
        // Prefer server-provided label (pending.label) and avoid HelpText null/empty pitfalls.
        // Clear HelpText from older XAML/BAML versions to avoid generic announcements.
        ChoicesList.ClearValue(AutomationProperties.HelpTextProperty);
        if (string.IsNullOrWhiteSpace(label))
        {
            // Fallback: give the list an explicit name even if server did not provide one.
            // This keeps list announcements stable for screen readers.
            if (_vm.IsQuizPending)
            {
                AutomationProperties.SetName(ChoicesList, "Réponses");
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

        // NOTE: read label element via FindName to avoid relying on generated XAML field,
        // which may be stale in incremental build/cache scenarios.
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

        // Table reset can break focus (focused element destroyed/collapsed),
        // then Tab/Shift+Tab becomes painful. Keep a stable focus anchor in game zone.
        if (!forceFromOutsideTextInput && IsTextInputFocused())
        {
            return;
        }

        // UX priority:
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
            if (forceFromOutsideTextInput)
            {
                var idx = HandList.SelectedIndex;
                if (idx < 0) idx = 0;
                if (idx >= HandList.Items.Count) idx = HandList.Items.Count - 1;
                HandList.SelectedIndex = idx;
                HandList.ScrollIntoView(HandList.SelectedItem);
                TryFocusChoiceIndex(HandList, idx);
                return;
            }

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
            if (forceFromOutsideTextInput)
            {
                var idx = ChoicesList.SelectedIndex;
                if (idx < 0) idx = 0;
                if (idx >= ChoicesList.Items.Count) idx = ChoicesList.Items.Count - 1;
                ChoicesList.SelectedIndex = idx;
                ChoicesList.ScrollIntoView(ChoicesList.SelectedItem);
                TryFocusChoiceIndex(ChoicesList, idx);
                return;
            }

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
        // Quiz listbox must consume Enter to submit selected answer,
        // so it does not trigger global Enter shortcut (roll).
        e.Handled = true;
        try
        {
            bool sent = await vm.SubmitSelectedChoiceAsync(CancellationToken.None).ConfigureAwait(true);
            if (sent)
            {
                NoteChoiceSubmittedForFocusRestore();
                return;
            }

            // Quiz: when cursor is on question line, Enter jumps to first answer.
            if (vm.IsQuizPending && ChoicesList.Items.Count > 1 && ChoicesList.SelectedIndex == 0)
            {
                ChoicesList.SelectedIndex = 1;
                ChoicesList.ScrollIntoView(ChoicesList.SelectedItem);
                TryFocusChoiceIndex(ChoicesList, 1);
            }
        }
        catch
        {
            // ignore (Enter stays consumed)
        }
    }
}


