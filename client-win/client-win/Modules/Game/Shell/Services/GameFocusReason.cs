namespace client_win.Modules.Game.Shell.Services;

public enum GameFocusReason
{
    Default = 0,
    InitialLoad = 1,
    TabCycle = 2,
    AfterDialog = 3,
    TableStarted = 4,
    GamePlayReady = 5,
    ChoosePawn = 6,
}
