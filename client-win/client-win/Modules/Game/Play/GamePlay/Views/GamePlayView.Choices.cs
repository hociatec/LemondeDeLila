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
    private bool _restoreChoiceFocusAfterSubmit;
    private int _restoreChoiceFocusIndex;
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
        _restoreChoiceFocusAfterSubmit = true;
        _restoreChoiceFocusIndex = ChoicesList?.SelectedIndex ?? -1;
    }

    private void NoteHandSubmittedForFocusRestore()
    {
        _restoreHandFocusAfterSubmit = true;
        _restoreHandFocusIndex = HandList?.SelectedIndex ?? -1;
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
                    // Strict behavior: when interactive lists are available, keep focus on them
                    // instead of bouncing back to the root "zone de jeu".
                    if (HandList.Visibility == Visibility.Visible && HandList.Items.Count > 0)
                    {
                        var idx = HandList.SelectedIndex;
                        if (idx < 0) idx = 0;
                        if (idx >= HandList.Items.Count) idx = HandList.Items.Count - 1;
                        HandList.SelectedIndex = idx;
                        HandList.ScrollIntoView(HandList.SelectedItem);
                        TryFocusChoiceIndex(HandList, idx);
                        return;
                    }

                    if (ChoicesList.Visibility == Visibility.Visible && ChoicesList.Items.Count > 0)
                    {
                        var idx = ChoicesList.SelectedIndex;
                        if (idx < 0) idx = 0;
                        if (idx >= ChoicesList.Items.Count) idx = ChoicesList.Items.Count - 1;
                        ChoicesList.SelectedIndex = idx;
                        ChoicesList.ScrollIntoView(ChoicesList.SelectedItem);
                        TryFocusChoiceIndex(ChoicesList, idx);
                        return;
                    }

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

            // Hand-driven flows (LAMA, etc.): keep focus anchored on hand list after submit,
            // even if HandCards collection does not raise immediately.
            if (_restoreHandFocusAfterSubmit)
            {
                Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                {
                    try
                    {
                        if (HandList.Visibility != Visibility.Visible || HandList.Items.Count <= 0)
                        {
                            // Keep pending restore until hand list is available again.
                            return;
                        }

                        var count = HandList.Items.Count;
                        var idx = _restoreHandFocusIndex;
                        _restoreHandFocusAfterSubmit = false;

                        if (idx < 0) idx = 0;
                        if (idx >= count) idx = count - 1;

                        HandList.SelectedIndex = idx;
                        HandList.ScrollIntoView(HandList.SelectedItem);
                        TryFocusChoiceIndex(HandList, idx);
                    }
                    catch
                    {
                        // ignore
                    }
                }));
                return;
            }

            // After a player submit, keep a pending restore until choices are available again.
            // This avoids ending up stuck on "zone de jeu" between player/bot turns (e.g. LAMA).
            if (_restoreChoiceFocusAfterSubmit)
            {
                Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                {
                    try
                    {
                        if (ChoicesList.Visibility != Visibility.Visible || ChoicesList.Items.Count <= 0)
                        {
                            // Keep pending restore until the choices list is available again.
                            return;
                        }

                        _restoreChoiceFocusAfterSubmit = false;

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
                return;
            }

            if (_vm.PendingChoices.Count <= 0)
            {
                // Strict mode: never force root/game-zone focus when player choices collapse.
                return;
            }

            // Ne pas voler le focus si l'utilisateur est dans une zone de saisie/lecture (ex: historique).
            if (IsTextInputFocused())
            {
                return;
            }

            // Keep focus on root; do not auto-focus choices list items.
            // This prevents screen readers from announcing "liste" on state refreshes.
            return;
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
        var focused = Keyboard.FocusedElement as DependencyObject;
        while (focused != null)
        {
            if (focused is TextBoxBase or PasswordBox or RichTextBox)
            {
                return true;
            }

            if (focused is ComboBox combo && combo.IsEditable)
            {
                return true;
            }

            focused = GetVisualOrLogicalParent(focused);
        }

        return false;
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

        // Never steal focus from chat/history or other areas on background state refreshes.
        if (!forceFromOutsideTextInput && !IsFocusInsideThisGameView())
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
            var idx = HandList.SelectedIndex;
            if (idx < 0) idx = 0;
            if (idx >= HandList.Items.Count) idx = HandList.Items.Count - 1;
            HandList.SelectedIndex = idx;
            HandList.ScrollIntoView(HandList.SelectedItem);
            TryFocusChoiceIndex(HandList, idx);
            return;
        }

        if (ChoicesList.Visibility == Visibility.Visible && ChoicesList.Items.Count > 0)
        {
            if (ChoicesList.SelectedIndex < 0)
            {
                ChoicesList.SelectedIndex = 0;
            }
            var idx = ChoicesList.SelectedIndex;
            if (idx < 0) idx = 0;
            if (idx >= ChoicesList.Items.Count) idx = ChoicesList.Items.Count - 1;
            ChoicesList.SelectedIndex = idx;
            ChoicesList.ScrollIntoView(ChoicesList.SelectedItem);
            TryFocusChoiceIndex(ChoicesList, idx);
            return;
        }

        // Strict mode: never fallback to root focus ("zone de jeu") from here.
        // Keep current focus if no interactive list/grid target is available yet.
        return;
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

            focused = GetVisualOrLogicalParent(focused);
        }

        return false;
    }

    private bool IsFocusInsideThisGameView()
    {
        var focused = Keyboard.FocusedElement as DependencyObject;
        while (focused != null)
        {
            if (ReferenceEquals(focused, this))
            {
                return true;
            }

            focused = GetVisualOrLogicalParent(focused);
        }

        return false;
    }

    private static DependencyObject? GetVisualOrLogicalParent(DependencyObject current)
    {
        try
        {
            if (current is System.Windows.Media.Visual || current is System.Windows.Media.Media3D.Visual3D)
            {
                return System.Windows.Media.VisualTreeHelper.GetParent(current);
            }
        }
        catch
        {
            // ignore
        }

        if (current is FrameworkElement fe)
        {
            return fe.Parent ?? fe.TemplatedParent;
        }

        return LogicalTreeHelper.GetParent(current);
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

            Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
            {
                try
                {
                    if (HandList.Visibility != Visibility.Visible || HandList.Items.Count <= 0)
                    {
                        // Keep pending restore until hand list becomes available again.
                        return;
                    }

                    var count = HandList.Items.Count;
                    var idx = _restoreHandFocusIndex;
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
