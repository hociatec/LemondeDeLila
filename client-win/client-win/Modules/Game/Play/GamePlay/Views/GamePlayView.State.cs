using System;
using System.Collections.Specialized;
using System.Threading;
using System.ComponentModel;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Game.Play.GamePlay.ViewModels;

namespace client_win.Modules.Game.Play.GamePlay.Views;

public partial class GamePlayView
{
    private GamePlayViewModel? _vm;
    private INotifyCollectionChanged? _choicesCollection;
    private NotifyCollectionChangedEventHandler? _choicesChanged;
    private Action<GameFocusReason>? _focusRequestedHandler;
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
    private EventHandler? _choicesListGeneratorStatusChanged;
    private EventHandler? _choicesListLayoutUpdated;
    private EventHandler? _handListGeneratorStatusChanged;
    private EventHandler? _handListLayoutUpdated;
    private EventHandler? _gridFocusGeneratorStatusChanged;
    private EventHandler? _gridFocusLayoutUpdated;
    private EventHandler? _inlinePromptLayoutUpdated;
    private int _preferredInteractiveFocusRequestId;
    private int _gameZoneFocusRequestId;
    private int _postPawnSubmitFocusRequestId;
    private bool _pendingInitialInteractiveFocus;
    private bool _lastChoicesA11yWasQuiz;
    private bool _lastChoicesA11yUsedLabeledBy;
    private string _lastChoicesA11yLabel = string.Empty;
}
