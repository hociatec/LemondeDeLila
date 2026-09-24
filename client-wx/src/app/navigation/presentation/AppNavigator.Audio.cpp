#include "app/navigation/presentation/AppNavigator.h"
#include <memory>
#include <wx/weakref.h>
#include "app/navigation/presentation/HostFrame.h"
#include "modules/audio/application/IAudioService.h"
#include "modules/audio/infrastructure/NotificationAudioDecoder.h"
#include "modules/rooms/application/RoomInvitationMonitor.h"
#include "modules/session/application/SessionStore.h"

namespace lila::app::navigation
{
void AppNavigator::BindNotificationAudio()
{
    auto decoder = std::make_shared<modules::audio::infrastructure::NotificationAudioDecoder>();
    const wxWeakRef<HostFrame> frame(hostFrame_);
    roomInvitationMonitor_.SetMessageHandler(
        [this, frame, decoder](const std::string& message)
        {
            if (!frame) return;
            const auto userId = sessionStore_.Current().userId.value;
            frame->CallAfter([this, frame, decoder, message, userId]()
            {
                if (!frame || closing_ || !sessionStore_.HasActiveSession() ||
                    sessionStore_.Current().userId.value != userId) return;
                const auto event = decoder->Decode(message, static_cast<int>(userId));
                if (event.refreshAssets) audioService_.RefreshAssets();
                if (event.cue) audioService_.Play(*event.cue);
            });
        });
}
}
