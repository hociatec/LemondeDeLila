using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Linq;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Automation.Peers;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Game.History.ViewModels;

namespace client_win.Modules.Game.History.Views;

public partial class GameHistoryView : UserControl
{
    private GameHistoryViewModel? _viewModel;
    private bool _pendingRebuild;
    private int _lastKnownEntryCount;
    private DispatcherTimer? _announceTimer;
    private readonly Queue<string> _announceQueue = new();
    private bool _announcerToggle;
    private DateTime _nextAnnouncementAtUtc = DateTime.MinValue;
    private DateTime _lastUserInteractionAtUtc = DateTime.MinValue;

    public GameHistoryView()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
        DataContextChanged += OnDataContextChanged;

        // IMPORTANT: si l'utilisateur interagit (navigation NVDA, flèches, Tab, etc.),
        // on suspend temporairement les annonces pour ne pas parler "par-dessus" l'utilisateur.
        AddHandler(Keyboard.PreviewKeyDownEvent, new KeyEventHandler(OnAnyPreviewKeyDown), handledEventsToo: true);
        AddHandler(Mouse.PreviewMouseDownEvent, new MouseButtonEventHandler(OnAnyPreviewMouseDown), handledEventsToo: true);
    }

    public FrameworkElement? FocusTarget => HistoryEditor;

    public event EventHandler<TabNavigationRequestedEventArgs>? TabNavigationRequested;

    public void CancelPendingAnnouncementsFromHost()
    {
        _lastUserInteractionAtUtc = DateTime.UtcNow;
        DropPendingAnnouncements();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        AttachViewModel(DataContext as GameHistoryViewModel);
        if (_announceQueue.Count > 0)
        {
            EnsureAnnouncePump();
            PumpAnnouncements();
        }

        Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            if (!HistoryEditor.IsKeyboardFocusWithin)
            {
                HistoryEditor.ScrollToEnd();
            }
        }));
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        AttachViewModel(null);
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        AttachViewModel(e.NewValue as GameHistoryViewModel);
    }

    private void AttachViewModel(GameHistoryViewModel? next)
    {
        if (_viewModel == next)
        {
            return;
        }

        if (_viewModel != null)
        {
            _viewModel.Entries.CollectionChanged -= OnEntriesCollectionChanged;
        }

        ResetAnnouncementState();
        _viewModel = next;

        if (_viewModel != null)
        {
            _viewModel.Entries.CollectionChanged += OnEntriesCollectionChanged;
            RebuildFromViewModel(scrollToEnd: true);
            _lastKnownEntryCount = _viewModel.Entries.Count;

            // Cas important: certains messages (ex: "Table créée...") sont ajoutés avant que la vue
            // ne soit chargée et donc avant l'abonnement à CollectionChanged.
            // On annonce les dernières lignes existantes à l'attache.
            if (_viewModel.Entries.Count > 0)
            {
                // IMPORTANT: annoncer tout l'existant à l'attache pour éviter de "perdre" le début
                // quand l'utilisateur arrive dans la room après que la partie a déjà poussé des logs.
                // Snapshot de la taille au moment de l'attache: sinon si des logs arrivent pendant la boucle,
                // ils peuvent être annoncés deux fois (ici + via CollectionChanged).
                var initialCount = _viewModel.Entries.Count;
                for (var i = 0; i < initialCount; i++)
                {
                    var line = (_viewModel.Entries[i] ?? string.Empty).Trim();
                    if (!string.IsNullOrWhiteSpace(line))
                    {
                        EnqueueAnnouncement(line);
                    }
                }
            }
            return;
        }

        HistoryEditor.Clear();
        _lastKnownEntryCount = 0;
        StopAnnouncePump(clearQueue: true);
    }

    private void ResetAnnouncementState()
    {
        StopAnnouncePump(clearQueue: true);
        _announcerToggle = false;
        _nextAnnouncementAtUtc = DateTime.MinValue;
    }

    private void OnEntriesCollectionChanged(object? sender, NotifyCollectionChangedEventArgs e)
    {
        if (_viewModel == null)
        {
            return;
        }

        if (e.Action == NotifyCollectionChangedAction.Add && e.NewItems != null && e.NewItems.Count > 0)
        {
            AppendEntries(e.NewItems.Cast<string>());

            // Annoncer uniquement ce qui vient d'être ajouté (et pas tout le texte),
            // en séquençant pour éviter que le lecteur d'écran ne "coupe" des messages en rafale.
            var added = e.NewItems
                .Cast<string>()
                .Select(s => (s ?? string.Empty).Trim())
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .ToList();

            if (added.Count > 0)
            {
                foreach (var msg in added.SelectMany(SplitLines))
                {
                    EnqueueAnnouncement(msg);
                }
            }

            _lastKnownEntryCount = _viewModel.Entries.Count;
            return;
        }

        ScheduleRebuild(scrollToEnd: false);
        _lastKnownEntryCount = _viewModel.Entries.Count;
    }

    private void AppendEntries(IEnumerable<string> entries)
    {
        var shouldAutoScroll = ShouldAutoScrollToEnd();
        var preserveSelection = HistoryEditor.IsKeyboardFocusWithin && !shouldAutoScroll;

        var selectionStart = HistoryEditor.SelectionStart;
        var selectionLength = HistoryEditor.SelectionLength;
        var caretIndex = HistoryEditor.CaretIndex;

        foreach (var entry in entries.Where(s => !string.IsNullOrWhiteSpace(s)))
        {
            if (HistoryEditor.Text.Length > 0)
            {
                HistoryEditor.AppendText(Environment.NewLine);
            }

            HistoryEditor.AppendText(entry);
        }

        if (preserveSelection)
        {
            RestoreSelection(selectionStart, selectionLength, caretIndex);
            return;
        }

        if (shouldAutoScroll)
        {
            HistoryEditor.CaretIndex = HistoryEditor.Text.Length;
            HistoryEditor.ScrollToEnd();
        }
    }

    private void ScheduleRebuild(bool scrollToEnd)
    {
        if (_pendingRebuild)
        {
            return;
        }

        _pendingRebuild = true;
        Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            _pendingRebuild = false;
            RebuildFromViewModel(scrollToEnd);
        }));
    }

    private void RebuildFromViewModel(bool scrollToEnd)
    {
        if (_viewModel == null)
        {
            return;
        }

        var shouldAutoScroll = scrollToEnd || ShouldAutoScrollToEnd();
        var preserveSelection = HistoryEditor.IsKeyboardFocusWithin && !shouldAutoScroll;

        var selectionStart = HistoryEditor.SelectionStart;
        var selectionLength = HistoryEditor.SelectionLength;
        var caretIndex = HistoryEditor.CaretIndex;

        HistoryEditor.Text = string.Join(Environment.NewLine, _viewModel.Entries.Where(s => !string.IsNullOrEmpty(s)));

        if (preserveSelection)
        {
            RestoreSelection(selectionStart, selectionLength, caretIndex);
            return;
        }

        if (shouldAutoScroll)
        {
            HistoryEditor.CaretIndex = HistoryEditor.Text.Length;
            HistoryEditor.ScrollToEnd();
        }
    }

    private void RestoreSelection(int selectionStart, int selectionLength, int caretIndex)
    {
        var textLength = HistoryEditor.Text.Length;
        var clampedStart = Math.Clamp(selectionStart, 0, textLength);
        var clampedLength = Math.Clamp(selectionLength, 0, Math.Max(0, textLength - clampedStart));
        var clampedCaret = Math.Clamp(caretIndex, 0, textLength);

        HistoryEditor.SelectionStart = clampedStart;
        HistoryEditor.SelectionLength = clampedLength;
        HistoryEditor.CaretIndex = clampedCaret;
    }

    private bool ShouldAutoScrollToEnd()
    {
        if (!HistoryEditor.IsKeyboardFocusWithin)
        {
            return true;
        }

        if (HistoryEditor.LineCount <= 0)
        {
            return true;
        }

        var lastVisibleLine = HistoryEditor.GetLastVisibleLineIndex();
        return lastVisibleLine >= HistoryEditor.LineCount - 1;
    }

    private void OnHistoryEditorPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Tab)
        {
            return;
        }

        e.Handled = true;

        var shift = (Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift;
        TabNavigationRequested?.Invoke(this, new TabNavigationRequestedEventArgs(shift));
    }

    private static IEnumerable<string> SplitLines(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            yield break;
        }

        var normalized = message
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n');

        foreach (var raw in normalized.Split('\n'))
        {
            var cleaned = (raw ?? string.Empty).Trim();
            if (!string.IsNullOrWhiteSpace(cleaned))
            {
                yield return cleaned;
            }
        }
    }

    private void EnqueueAnnouncement(string message)
    {
        var cleaned = (message ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(cleaned))
        {
            return;
        }

        _announceQueue.Enqueue(cleaned);

        // Annoncer le premier message immédiatement si la vue est prête,
        // sinon laisser la pompe reprendre dès que la vue est chargée.
        if (_announceQueue.Count == 1 && IsLoaded)
        {
            PumpAnnouncements();
        }

        if (_announceQueue.Count > 0)
        {
            EnsureAnnouncePump();
        }
    }

    private void EnsureAnnouncePump()
    {
        if (_announceTimer != null)
        {
            if (!_announceTimer.IsEnabled)
            {
                _announceTimer.Start();
            }
            return;
        }

        // Sans anti-rafale/coalescing: on séquence juste les notifications pour éviter que certains lecteurs d'écran
        // en "ratent" quand plusieurs events UIA partent trop vite.
        _announceTimer = new DispatcherTimer(DispatcherPriority.Background, Dispatcher)
        {
            Interval = TimeSpan.FromMilliseconds(50),
        };
        _announceTimer.Tick += (_, __) => PumpAnnouncements();
        _announceTimer.Start();
    }

    private void PumpAnnouncements()
    {
        if (_announceQueue.Count == 0)
        {
            StopAnnouncePump(clearQueue: false);
            return;
        }

        if (!IsLoaded || !A11yAnnouncer.IsLoaded || PresentationSource.FromVisual(A11yAnnouncer) == null)
        {
            return;
        }

        // Si l'utilisateur interagit, on ne doit pas "reprendre" plus tard :
        // on abandonne les annonces en attente (l'historique reste consultable manuellement).
        if (IsUserInteracting())
        {
            DropPendingAnnouncements();
            return;
        }

        var now = DateTime.UtcNow;
        if (now < _nextAnnouncementAtUtc)
        {
            return;
        }

        // Ne pas Dequeue tant qu'on n'est pas prêt à annoncer, sinon on perd des lignes.
        var next = _announceQueue.Peek();
        if (string.IsNullOrWhiteSpace(next))
        {
            _announceQueue.Dequeue();
            return;
        }

        try
        {
            _announceQueue.Dequeue();

            // Mise à jour du live-region de secours (plus fiable sur certains setups NVDA).
            // On alterne un caractère "invisible" pour forcer un changement de texte (même si le message se répète),
            // sans polluer ce que le lecteur d'écran doit prononcer (lui lit le paramètre `next`).
            _announcerToggle = !_announcerToggle;
            var marker = _announcerToggle ? "\u200B" : "\u200C"; // zero-width space / non-joiner
            A11yAnnouncer.Text = $"{next}{marker}";
            AutomationProperties.SetName(A11yAnnouncer, next);

            var peer = FrameworkElementAutomationPeer.FromElement(A11yAnnouncer) ??
                       FrameworkElementAutomationPeer.CreatePeerForElement(A11yAnnouncer);
            peer?.RaiseAutomationEvent(AutomationEvents.LiveRegionChanged);

            _nextAnnouncementAtUtc = now + ComputeAnnouncementDelay(next);
        }
        catch
        {
            // ignore (best-effort)
        }
    }

    private static TimeSpan ComputeAnnouncementDelay(string message)
    {
        // NVDA ne lit pas "ligne par ligne" si on spam trop vite les LiveRegionChanged : il droppe des events.
        // On garde donc un séquençage minimal, mais suffisamment court pour rester naturel.
        var text = message ?? string.Empty;
        var length = text.Length;

        var ms = 90 + (length * 3);
        if (ms < 110) ms = 110;
        if (ms > 550) ms = 550;
        return TimeSpan.FromMilliseconds(ms);
    }

    private bool IsUserInteracting()
    {
        // Suspendre brièvement après une interaction (navigation NVDA, lecture document, etc.).
        // IMPORTANT: ne pas bloquer uniquement parce que l'historique a le focus, sinon les retours d'actions
        // (raccourcis de jeu) peuvent être perdus si l'utilisateur garde le focus dans le panneau.
        var last = _lastUserInteractionAtUtc;
        if (last == DateTime.MinValue)
        {
            return false;
        }

        return (DateTime.UtcNow - last) < TimeSpan.FromMilliseconds(900);
    }

    private void DropPendingAnnouncements()
    {
        _announceQueue.Clear();
        StopAnnouncePump(clearQueue: false);
        _nextAnnouncementAtUtc = DateTime.UtcNow;
    }

    private void OnAnyPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.IsRepeat)
        {
            return;
        }

        var key = e.Key == Key.System ? e.SystemKey : e.Key;
        if (key is Key.LeftShift or Key.RightShift or Key.LeftCtrl or Key.RightCtrl or Key.LeftAlt or Key.RightAlt or Key.LWin or Key.RWin)
        {
            return;
        }

        // Ne pas traiter les raccourcis "lettres/chiffres" comme une interaction qui annule les annonces,
        // sinon un enchaînement rapide (ex: 't' puis 't') peut faire "perdre" la première annonce.
        // On annule uniquement sur les touches de navigation/lecture (qui signifient que l'utilisateur reprend la main).
        var isNavigationKey =
            key is Key.Up or Key.Down or Key.Left or Key.Right
            or Key.PageUp or Key.PageDown or Key.Home or Key.End
            or Key.Tab or Key.Escape
            or Key.Enter;

        if (!isNavigationKey)
        {
            return;
        }

        _lastUserInteractionAtUtc = DateTime.UtcNow;
        DropPendingAnnouncements();
    }

    private void OnAnyPreviewMouseDown(object sender, MouseButtonEventArgs e)
    {
        _lastUserInteractionAtUtc = DateTime.UtcNow;
        DropPendingAnnouncements();
    }

    private void StopAnnouncePump(bool clearQueue)
    {
        if (clearQueue)
        {
            _announceQueue.Clear();
        }

        if (_announceTimer != null)
        {
            _announceTimer.Stop();
            _announceTimer = null;
        }
    }
}

public sealed class TabNavigationRequestedEventArgs : EventArgs
{
    public TabNavigationRequestedEventArgs(bool isShiftPressed)
    {
        IsShiftPressed = isShiftPressed;
    }

    public bool IsShiftPressed { get; }
}
