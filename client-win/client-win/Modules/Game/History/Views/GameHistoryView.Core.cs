using System;
using System.Collections.Specialized;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Game.History.ViewModels;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.History.Views;

public partial class GameHistoryView : UserControl
{
    private GameHistoryViewModel? _viewModel;
    private bool _pendingRebuild;
    private readonly HistoryAnnouncerController _announcerController;
    private static readonly TimeSpan InteractionHoldWindow = TimeSpan.FromSeconds(12);
    private DateTime _lastInteractionAtUtc;

    public GameHistoryView()
    {
        _announcerController = new HistoryAnnouncerController(this);
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
        DataContextChanged += OnDataContextChanged;
        HistoryViewer.GotKeyboardFocus += OnHistoryGotKeyboardFocus;
        HistoryViewer.PreviewMouseWheel += OnHistoryViewerMouseWheel;
        HistoryViewer.PreviewMouseDown += OnHistoryViewerMouseDown;
        HistoryViewer.PreviewKeyDown += OnHistoryViewerPreviewKeyDown;
    }

    public FrameworkElement? FocusTarget => HistoryViewer;
    public bool IsHistoryFocused => HistoryViewer.IsKeyboardFocusWithin;
    public bool HasRecentInteraction => DateTime.UtcNow - _lastInteractionAtUtc <= InteractionHoldWindow;

    public void FocusToBottom()
    {
        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(MoveCaretAndScrollToEnd));
    }

    public event Action? HistoryUpdatedWhileFocused;

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        AttachViewModel(DataContext as GameHistoryViewModel);
        AttachAppActivationHooks();

        Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            if (!HistoryViewer.IsKeyboardFocusWithin)
            {
                MoveCaretAndScrollToEnd();
            }
        }));
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        AttachViewModel(null);
        DetachAppActivationHooks();
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

        _viewModel = next;
        _announcerController.AttachViewModel(next);

        if (_viewModel != null)
        {
            _viewModel.Entries.CollectionChanged += OnEntriesCollectionChanged;
            RebuildFromViewModel(scrollToEnd: true);
            return;
        }

        OnViewModelCleared();
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
            _announcerController.CollectAnnouncements(e.NewItems.Cast<string>());
            return;
        }

        ScheduleRebuild(scrollToEnd: false);
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

    private void OnHistoryGotKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
    {
        RegisterHistoryInteraction();
        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(MoveCaretAndScrollToEnd));
    }

    private void OnHistoryViewerMouseWheel(object? sender, MouseWheelEventArgs e) => RegisterHistoryInteraction();

    private void OnHistoryViewerMouseDown(object? sender, MouseButtonEventArgs e) => RegisterHistoryInteraction();

    private void OnHistoryViewerPreviewKeyDown(object? sender, KeyEventArgs e) => RegisterHistoryInteraction();

    private void RegisterHistoryInteraction()
    {
        _lastInteractionAtUtc = DateTime.UtcNow;
    }

    private void MoveCaretAndScrollToEnd()
    {
        try
        {
            var end = HistoryViewer.Document?.ContentEnd;
            if (end != null)
            {
                HistoryViewer.CaretPosition = end;
            }
        }
        catch
        {
        }

        try
        {
            HistoryViewer.ScrollToEnd();
        }
        catch
        {
        }
    }

    private void OnViewModelCleared()
    {
        _announcerController.Reset();
        HistoryViewer.Document.Blocks.Clear();
        _announcerController.ClearViewModel();
    }

    public void SetScreenReader(IScreenReaderAnnouncer? screenReader) =>
        _announcerController.SetScreenReader(screenReader);

    public void NotifyUserInteraction() =>
        _announcerController.NotifyUserInteraction();

    public void CancelPendingAnnouncementsFromHost() =>
        _announcerController.CancelPendingAnnouncements();
}
