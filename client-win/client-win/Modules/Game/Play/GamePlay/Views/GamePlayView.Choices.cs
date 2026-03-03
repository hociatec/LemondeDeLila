using System;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Threading;
using System.Windows.Media;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Game.Shell.Views;
using client_win.Modules.Game.Play.GamePlay.ViewModels;

namespace client_win.Modules.Game.Play.GamePlay.Views;

public partial class GamePlayView
{
    private bool _restoreChoiceFocusAfterSubmit;
    private int _restoreChoiceFocusIndex;
    private bool _restoreHandFocusAfterSubmit;
    private int _restoreHandFocusIndex;
    private bool _preferredInteractiveFocusForceFromOutside = true;
    private DateTime _postPawnSelectionRecoveryUntilUtc;
    private int _postPawnSelectionRecoveryRequestId;

    public void FocusPreferredInteractiveElement()
    {
        FocusPreferredInteractiveElement(forceFromOutsideTextInput: true);
    }

    public void FocusPreferredInteractiveElement(bool forceFromOutsideTextInput, bool allowExternalTextInputSteal = false)
    {
        if (DataContext is GamePlayViewModel vmNow && vmNow.HasInlinePrompt)
        {
            FocusFirstInlinePromptField();
            return;
        }

        _preferredInteractiveFocusForceFromOutside = forceFromOutsideTextInput;
        _preferredInteractiveAllowExternalTextInputSteal = allowExternalTextInputSteal;
        var requestId = Interlocked.Increment(ref _preferredInteractiveFocusRequestId);
        RunPreferredInteractiveFocusPass(requestId);
        QueuePreferredInteractiveFocusPass(requestId, DispatcherPriority.Loaded);
        QueuePreferredInteractiveFocusPass(requestId, DispatcherPriority.ApplicationIdle);
        QueuePreferredInteractiveFocusDelayedPass(requestId, 120);
        QueuePreferredInteractiveFocusDelayedPass(requestId, 280);
        QueuePreferredInteractiveFocusDelayedPass(requestId, 520);
    }

    private void QueuePreferredInteractiveFocusPass(int requestId, DispatcherPriority priority)
    {
        _ = Dispatcher.BeginInvoke(priority, new Action(() => RunPreferredInteractiveFocusPass(requestId)));
    }

    private void QueuePreferredInteractiveFocusDelayedPass(int requestId, int delayMs)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(delayMs).ConfigureAwait(false);
            }
            catch
            {
                return;
            }

            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.ApplicationIdle,
                new Action(() => RunPreferredInteractiveFocusPass(requestId)));
        });
    }

    private void RunPreferredInteractiveFocusPass(int requestId)
    {
        if (requestId != _preferredInteractiveFocusRequestId)
        {
            return;
        }

        ForceFocusGameZoneCore(
            forceFromOutsideTextInput: _preferredInteractiveFocusForceFromOutside,
            allowExternalTextInputSteal: _preferredInteractiveAllowExternalTextInputSteal);
    }

    private void NoteChoiceSubmittedForFocusRestore()
    {
        _restoreChoiceFocusAfterSubmit = true;
        _restoreChoiceFocusIndex = ChoicesList?.SelectedIndex ?? -1;
        RequestPostSubmitInteractiveFocus();
    }

    private void NoteChoiceSubmittedForFocusRestore(GamePlayViewModel vm)
    {
        NoteChoiceSubmittedForFocusRestore();

        if (!vm.IsChoosePawnPending)
        {
            return;
        }

        var requestId = Interlocked.Increment(ref _postPawnSubmitFocusRequestId);
        RunPostPawnSubmitFocusRecovery(requestId);
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() => RunPostPawnSubmitFocusRecovery(requestId)));
    }

    private void RunPostPawnSubmitFocusRecovery(int requestId)
    {
        if (requestId != _postPawnSubmitFocusRequestId)
        {
            return;
        }

        if (DataContext is not GamePlayViewModel vm)
        {
            return;
        }

        // During pawn selection, keep the list focused. Once selection is done, re-anchor
        // focus to the next interactive game element to avoid focus landing on an unnamed gap.
        if (vm.IsChoosePawnPending)
        {
            ForceFocusGameZoneCore(forceFromOutsideTextInput: true);
            return;
        }

        FocusPreferredInteractiveElement();
    }

    private void NoteHandSubmittedForFocusRestore()
    {
        _restoreHandFocusAfterSubmit = true;
        _restoreHandFocusIndex = HandList?.SelectedIndex ?? -1;
        RequestPostSubmitInteractiveFocus();
    }

    private void RequestPostSubmitInteractiveFocus()
    {
        _pendingInitialInteractiveFocus = true;
        FocusPreferredInteractiveElement(forceFromOutsideTextInput: true);
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
        _lastChoicesA11yWasQuiz = false;
        _lastChoicesA11yUsedLabeledBy = false;
        _lastChoicesA11yLabel = string.Empty;
        _lastObservedChoosePawnPending = false;

        if (_vm != null)
        {
            _lastObservedChoosePawnPending = _vm.IsChoosePawnPending;
            _focusRequestedHandler = RequestGameZoneFocusFromVm;
            _vm.GameZoneFocusRequested += _focusRequestedHandler;

            _vmPropertyChangedHandler = (_, e) =>
            {
                if (string.Equals(e.PropertyName, nameof(GamePlayViewModel.IsChoosePawnPending), StringComparison.Ordinal) ||
                    string.Equals(e.PropertyName, nameof(GamePlayViewModel.PendingType), StringComparison.Ordinal))
                {
                    var isChoosePawnPending = _vm.IsChoosePawnPending;
                    var justExitedChoosePawn = _lastObservedChoosePawnPending && !isChoosePawnPending;
                    _lastObservedChoosePawnPending = isChoosePawnPending;

                    if (justExitedChoosePawn)
                    {
                        _pendingInitialInteractiveFocus = true;
                        StartPostPawnSelectionRecoveryWindow();
                        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                        {
                            FocusPreferredInteractiveElement(forceFromOutsideTextInput: true);
                        }));
                    }
                }

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
                        if (!HandList.IsVisible || HandList.Items.Count <= 0)
                        {
                            return;
                        }

                        var count = HandList.Items.Count;
                        var idx = _restoreHandFocusIndex;
                        _restoreHandFocusAfterSubmit = false;

                        if (idx < 0) idx = 0;
                        if (idx >= count) idx = count - 1;

                        HandList.SelectedIndex = idx;
                        HandList.ScrollIntoView(HandList.SelectedItem);
                        // Silent restore: keep selection stable without forcing keyboard focus.
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
                if (ChoicesList.IsVisible && ChoicesList.Items.Count > 0)
                {
                    Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                    {
                        try
                        {
                            if (!ChoicesList.IsVisible || ChoicesList.Items.Count <= 0)
                            {
                                return;
                            }

                            _restoreChoiceFocusAfterSubmit = false;

                            var count = ChoicesList.Items.Count;
                            var idx = _restoreChoiceFocusIndex;
                            if (idx < 0) idx = 0;
                            if (idx >= count) idx = count - 1;

                            ChoicesList.SelectedIndex = idx;
                            ChoicesList.ScrollIntoView(ChoicesList.SelectedItem);
                            // Silent restore: keep selection stable without forcing keyboard focus.
                        }
                        catch
                        {
                            // ignore
                        }
                    }));
                    return;
                }

                _restoreChoiceFocusAfterSubmit = false;
            }

            if (_vm.PendingChoices.Count <= 0)
            {
                if (ShouldRecoverBrokenFocus())
                {
                    Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                    {
                        FocusPreferredInteractiveElement(forceFromOutsideTextInput: true);
                    }));
                }
                // Strict mode: never force root/game-zone focus when player choices collapse.
                return;
            }

            if (_pendingInitialInteractiveFocus &&
                ChoicesList.IsVisible &&
                ChoicesList.Items.Count > 0)
            {
                _pendingInitialInteractiveFocus = false;
                Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                {
                    FocusPreferredInteractiveElement(forceFromOutsideTextInput: true);
                }));
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
    private void UpdateChoicesAccessibility()
    {
        if (_vm == null)
        {
            return;
        }

        var label = string.IsNullOrWhiteSpace(_vm.ChoicesLabel) ? string.Empty : _vm.ChoicesLabel.Trim();
        var isQuiz = _vm.IsQuizPending;
        var shouldUseLabeledBy =
            !isQuiz &&
            !string.IsNullOrWhiteSpace(label) &&
            FindName("ChoicesLabelText") is FrameworkElement labelElementProbe &&
            labelElementProbe.Visibility == Visibility.Visible;

        if (_lastChoicesA11yWasQuiz == isQuiz &&
            _lastChoicesA11yUsedLabeledBy == shouldUseLabeledBy &&
            string.Equals(_lastChoicesA11yLabel, label, StringComparison.Ordinal))
        {
            return;
        }

        // Quiz: the list already contains question + answers. Do not duplicate it in list name.
        if (isQuiz)
        {
            ChoicesList.ClearValue(AutomationProperties.HelpTextProperty);
            AutomationProperties.SetName(ChoicesList, "Question et réponses");
            ChoicesList.ClearValue(AutomationProperties.LabeledByProperty);
            _lastChoicesA11yWasQuiz = true;
            _lastChoicesA11yUsedLabeledBy = false;
            _lastChoicesA11yLabel = label;
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
            AutomationProperties.SetName(ChoicesList, isQuiz ? "Réponses" : "Choix");
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
            _lastChoicesA11yWasQuiz = false;
            _lastChoicesA11yUsedLabeledBy = true;
            _lastChoicesA11yLabel = label;
            return;
        }

        ChoicesList.ClearValue(AutomationProperties.LabeledByProperty);
        _lastChoicesA11yWasQuiz = false;
        _lastChoicesA11yUsedLabeledBy = false;
        _lastChoicesA11yLabel = label;
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
    private void RequestGameZoneFocusFromVm(GameFocusReason reason)
    {
        var requestId = Interlocked.Increment(ref _gameZoneFocusRequestId);
        RunGameZoneFocusRequest(requestId, reason);
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() => RunGameZoneFocusRequest(requestId, reason)));
    }

    private void StartPostPawnSelectionRecoveryWindow()
    {
        _postPawnSelectionRecoveryUntilUtc = DateTime.UtcNow.AddSeconds(2);
        RequestPostPawnSelectionFocusRecovery();
    }

    private void RequestPostPawnSelectionFocusRecovery()
    {
        var requestId = Interlocked.Increment(ref _postPawnSelectionRecoveryRequestId);
        RunPostPawnSelectionRecovery(requestId);
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() => RunPostPawnSelectionRecovery(requestId)));
        QueuePostPawnSelectionRecoveryDelayedPass(requestId, 120);
        QueuePostPawnSelectionRecoveryDelayedPass(requestId, 280);
        QueuePostPawnSelectionRecoveryDelayedPass(requestId, 520);
    }

    private void QueuePostPawnSelectionRecoveryDelayedPass(int requestId, int delayMs)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                await Task.Delay(delayMs).ConfigureAwait(false);
            }
            catch
            {
                return;
            }

            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.ApplicationIdle,
                new Action(() => RunPostPawnSelectionRecovery(requestId)));
        });
    }

    private void RunPostPawnSelectionRecovery(int requestId)
    {
        if (requestId != _postPawnSelectionRecoveryRequestId)
        {
            return;
        }

        if (_postPawnSelectionRecoveryUntilUtc == default ||
            DateTime.UtcNow > _postPawnSelectionRecoveryUntilUtc)
        {
            return;
        }

        if (IsTextInputFocused())
        {
            return;
        }

        if (!ShouldRecoverBrokenFocus() && IsFocusInsideThisGameView())
        {
            return;
        }

        FocusPreferredInteractiveElement(
            forceFromOutsideTextInput: true,
            allowExternalTextInputSteal: true);
    }

    private void TryRecoverPostPawnSelectionFocusFromLayout()
    {
        if (_postPawnSelectionRecoveryUntilUtc == default ||
            DateTime.UtcNow > _postPawnSelectionRecoveryUntilUtc)
        {
            return;
        }

        RunPostPawnSelectionRecovery(_postPawnSelectionRecoveryRequestId);
    }

    private void RunGameZoneFocusRequest(int requestId, GameFocusReason reason)
    {
        if (requestId != _gameZoneFocusRequestId)
        {
            return;
        }

        if (reason == GameFocusReason.ChoosePawn)
        {
            ForceFocusGameZoneCore(
                forceFromOutsideTextInput: true,
                allowExternalTextInputSteal: true);
            return;
        }

        // "GamePlayReady" is emitted on frequent state transitions (turn/action updates).
        // Keep focus stable if the user is currently reading chat/history to avoid
        // repetitive root re-announcements from screen readers.
        if (reason == GameFocusReason.GamePlayReady)
        {
            FocusPreferredInteractiveElement(forceFromOutsideTextInput: false);
            return;
        }

        FocusPreferredInteractiveElement(forceFromOutsideTextInput: true);
    }

    private void ForceFocusGameZoneCore(bool forceFromOutsideTextInput, bool allowExternalTextInputSteal = false)
    {
        if (DataContext is GamePlayViewModel vmPrompt && vmPrompt.HasInlinePrompt)
        {
            _pendingInitialInteractiveFocus = false;
            FocusFirstInlinePromptField();
            return;
        }

        // Table reset can break focus (focused element destroyed/collapsed),
        // then Tab/Shift+Tab becomes painful. Keep a stable focus anchor in game zone.
        if (!forceFromOutsideTextInput && IsTextInputFocused())
        {
            return;
        }

        // Preserve reading/typing context in chat/history on passive or VM-driven focus nudges.
        // Explicit host-driven focus requests can opt-in to bypass this guard.
        if (!allowExternalTextInputSteal &&
            !IsFocusInsideThisGameView() &&
            IsTextInputFocused() &&
            !ShouldRecoverBrokenFocus())
        {
            return;
        }

        // Passive refreshes (state updates from other players/bots) must not move focus
        // when the user is already reading/interacting inside the game view, unless
        // the current focus became invalid (collapsed/disabled).
        if (!forceFromOutsideTextInput && IsFocusInsideThisGameView() && !ShouldRecoverBrokenFocus())
        {
            return;
        }

        // Never steal focus from chat/history or other areas on background state refreshes.
        if (!forceFromOutsideTextInput &&
            !IsFocusInsideThisGameView() &&
            !ShouldRecoverBrokenFocus())
        {
            return;
        }

        if (DataContext is GamePlayViewModel vmChoosePawn &&
            vmChoosePawn.IsChoosePawnPending &&
            ChoicesList.IsVisible &&
            ChoicesList.Items.Count > 0)
        {
            if (IsFocusWithinChoicesList())
            {
                _pendingInitialInteractiveFocus = false;
                return;
            }
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
            _pendingInitialInteractiveFocus = !IsFocusWithinChoicesList();
            return;
        }

        // UX priority:
        // - choose_pawn: garder le focus sur la liste de pions
        // - sinon, si une grille est visible: ancrer sur la grille (jeux type Corridor)
        // - sinon, si une liste de choix est visible: ancrer sur cette liste (ex: LAMA = main)
        // - sinon: attendre qu'un élément interactif soit prêt
        if (DataContext is GamePlayViewModel vm && vm.Grid.IsVisible)
        {
            // When entering the game area via Tab/Shift+Tab, keep focus on the game zone root.
            // Users can then enter the grid intentionally with arrow keys.
            if (forceFromOutsideTextInput && !IsFocusInsideThisGameView())
            {
                _pendingInitialInteractiveFocus = true;
                TryFocusGameViewRoot();
                return;
            }

            if ((GridBoard?.IsKeyboardFocusWithin ?? false) || (GridItems?.IsKeyboardFocusWithin ?? false))
            {
                _pendingInitialInteractiveFocus = false;
                return;
            }
            var focusRequested = TryFocusPreferredGridCell();
            _pendingInitialInteractiveFocus = !IsFocusWithinGrid();
            if (!focusRequested && forceFromOutsideTextInput)
            {
                TryFocusGameViewRoot();
            }
            return;
        }

        if (HandList.IsVisible && HandList.Items.Count > 0)
        {
            if (IsFocusWithinHandList())
            {
                _pendingInitialInteractiveFocus = false;
                return;
            }
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
            _pendingInitialInteractiveFocus = !IsFocusWithinHandList();
            return;
        }

        if (ChoicesList.IsVisible && ChoicesList.Items.Count > 0)
        {
            if (IsFocusWithinChoicesList())
            {
                _pendingInitialInteractiveFocus = false;
                return;
            }
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
            _pendingInitialInteractiveFocus = !IsFocusWithinChoicesList();
            return;
        }

        // Lors d'une demande explicite de retour au jeu (ex: Tab depuis chat/historique),
        // ne pas ancrer sur la racine "zone de jeu": attendre la prochaine cible interactive.
        if (forceFromOutsideTextInput || ShouldRecoverBrokenFocus())
        {
            _pendingInitialInteractiveFocus = true;
            TryFocusGameViewRoot();
        }
    }

    private void TryFocusGameViewRoot()
    {
        try
        {
            if (IsFocusInsideThisGameView())
            {
                return;
            }

            // Keep focus on the host game-zone anchor (single announced zone),
            // without calling host.FocusGameZone() here to avoid re-entrant focus loops.
            var parent = GetVisualOrLogicalParent(this);
            while (parent != null)
            {
                if (parent is GameZoneHostView host)
                {
                    if (host.FindName("GameZoneFocusAnchor") is IInputElement anchor)
                    {
                        Keyboard.Focus(anchor);
                        (anchor as UIElement)?.Focus();
                        return;
                    }
                    break;
                }

                parent = GetVisualOrLogicalParent(parent);
            }

            // Fallback best-effort when the host anchor is not reachable.
            Focus();
            Keyboard.Focus(this);
        }
        catch
        {
            // best-effort
        }
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

    private bool IsFocusWithinChoicesList()
    {
        if (ChoicesList == null)
        {
            return false;
        }

        var focused = Keyboard.FocusedElement as DependencyObject;
        while (focused != null)
        {
            if (ReferenceEquals(focused, ChoicesList))
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

    private bool ShouldRecoverBrokenFocus()
    {
        var window = Window.GetWindow(this);
        if (window != null && !window.IsActive && !window.IsKeyboardFocusWithin)
        {
            return false;
        }

        if (Keyboard.FocusedElement is not DependencyObject focused)
        {
            return true;
        }

        if (PresentationSource.FromDependencyObject(focused) == null)
        {
            return true;
        }

        if (focused is UIElement ui)
        {
            return !ui.IsVisible || !ui.IsEnabled;
        }

        if (focused is FrameworkElement fe)
        {
            return !fe.IsVisible || !fe.IsEnabled;
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
            if (_pendingInitialInteractiveFocus &&
                HandList.IsVisible &&
                HandList.Items.Count > 0)
            {
                _pendingInitialInteractiveFocus = false;
                Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                {
                    FocusPreferredInteractiveElement(forceFromOutsideTextInput: true);
                }));
                return;
            }

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
                    if (!HandList.IsVisible || HandList.Items.Count <= 0)
                    {
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
                    // Silent restore: keep selection stable without forcing keyboard focus.
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
                    NoteChoiceSubmittedForFocusRestore(vm);
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
