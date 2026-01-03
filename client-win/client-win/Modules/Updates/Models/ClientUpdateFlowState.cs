namespace client_win.Modules.Updates;

public record ClientUpdateFlowState(
    ClientUpdateFlowKind Kind,
    bool Required,
    string Title,
    string Message,
    string? Reason);
