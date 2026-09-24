#include <algorithm>
#include <atomic>
#include "modules/rooms/application/RoomInvitationMonitor.h"
#include <chrono>
#include <condition_variable>
#include <deque>
#include <iostream>
#include <memory>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

#include "modules/audio/application/IAudioService.h"
#include "modules/audio/application/IAudioBackend.h"
#include "modules/audio/application/IAudioSettingsProvider.h"
#include "modules/chat/application/ChatService.h"
#include "modules/chat/application/IChatGateway.h"
#include "modules/chat/infrastructure/ChatProtocol.h"
#include "modules/gameplay/session/application/GameSessionService.h"
#include "modules/gameplay/session/application/IGameSessionGateway.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/options/domain/IOptionsRepository.h"
#include "modules/options/domain/OptionsState.h"
#include "modules/rooms/application/IRoomSessionGateway.h"
#include "modules/rooms/application/RoomSessionService.h"
#include "modules/session/application/SessionStore.h"
#include "modules/session/domain/ISessionRepository.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/domain/identifiers/DomainTypes.h"
#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/application/websocket/IWebSocketClient.h"
#include "modules/presence/application/PresenceMonitor.h"
#include "shared/network/application/realtime/AuthenticatedRealtimeApiHelpers.h"

#include "network_protocol/Support.Session.inc"
#include "network_protocol/Support.Audio.inc"
#include "network_protocol/Support.RoomSession.inc"
#include "network_protocol/Support.Chat.inc"
#include "network_protocol/ServiceResilienceTests.inc"
#include "network_protocol/ChatTicketResilienceTests.inc"
#include "network_protocol/GameSessionReconnectTests.inc"
#include "network_protocol/RoomSessionConcurrencyTests.inc"
#include "network_protocol/PresenceMonitorTests.inc"
#include "network_protocol/NotificationMonitorTests.inc"

int main()
{
    try
    {
        TestPresenceActivityAndReconnect();
        TestNotificationMonitorReconnect();
        TestEnsureSuccessOrThrowClearsExpiredSession();
        TestChatServiceCloseInterruptsReceiveLoop();
        TestChatServiceReconnectsAfterTransientFailure();
        TestChatServiceOpenIsIdempotent();
        TestChatServiceKeepsSessionOnTransientTicketFailure();
        TestChatServiceSendReportsTransportFailure();
        TestRoomSessionServiceReconnectsAndRepublishesState();
        TestGameSessionServiceReconnectsAndRepublishesState();
        TestRoomSessionServiceSerializesOpenTransitions();
        std::cout << "Service resilience tests passed.\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "[TEST FAILED] " << error.what() << '\n';
        return 1;
    }
}
