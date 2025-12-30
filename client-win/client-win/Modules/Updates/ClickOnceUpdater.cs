using System;
using System.Deployment.Application;
using System.Threading.Tasks;

namespace client_win.Modules.Updates;

public sealed class ClickOnceUpdateResult
{
    public bool IsSupported { get; init; }
    public bool UpdateAvailable { get; init; }
    public bool Updated { get; init; }
    public string? Error { get; init; }
}

public static class ClickOnceUpdater
{
    public static ClickOnceUpdateResult CheckAndUpdate()
    {
        try
        {
            if (!ApplicationDeployment.IsNetworkDeployed)
            {
                return new ClickOnceUpdateResult { IsSupported = false };
            }

            var deployment = ApplicationDeployment.CurrentDeployment;
            var info = deployment.CheckForDetailedUpdate();
            if (info == null || !info.UpdateAvailable)
            {
                return new ClickOnceUpdateResult { IsSupported = true, UpdateAvailable = false };
            }

            deployment.Update();
            return new ClickOnceUpdateResult
            {
                IsSupported = true,
                UpdateAvailable = true,
                Updated = true,
            };
        }
        catch (Exception ex)
        {
            return new ClickOnceUpdateResult
            {
                IsSupported = true,
                Error = $"{ex.GetType().Name}: {ex.Message}",
            };
        }
    }

    public static Task<ClickOnceUpdateResult> CheckAndUpdateAsync()
    {
        // Update() peut prendre du temps (download). On l'isole du thread UI.
        return Task.Run(CheckAndUpdate);
    }
}

