using System;
using System.Collections.Specialized;
using System.Threading;
using System.ComponentModel;
using client_win.Modules.Game.Play.GamePlay.ViewModels;

namespace client_win.Modules.Game.Play.GamePlay.Views;

public partial class GamePlayView
{
    private GamePlayViewModel? _vm;
    private INotifyCollectionChanged? _choicesCollection;
    private NotifyCollectionChangedEventHandler? _choicesChanged;
    private Action? _focusRequestedHandler;
    private CancellationTokenSource? _initCts;
    private GamePlayViewModel? _initVm;
    private int _gridFocusIndex;
    private EventHandler? _gridGeneratorStatusChanged;
    private string _lastAutoFocusedQuizQuestionText = string.Empty;
    private PropertyChangedEventHandler? _vmPropertyChangedHandler;
    private int _choicesFocusRequestId;
    private int _handFocusRequestId;
    private int _gridFocusRequestId;
    private int _inlinePromptFocusRequestId;
}
