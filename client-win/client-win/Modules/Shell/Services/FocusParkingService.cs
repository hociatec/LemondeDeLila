using System;

namespace client_win.Modules.Shell.Services;

public sealed class FocusParkingService : IFocusParkingService
{
    public void ParkFocus()
    {
        FocusParking.Park();
    }
}
