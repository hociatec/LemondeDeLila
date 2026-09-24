#pragma once
#include <deque>
#include <optional>
#include <string>
#include <unordered_set>
#include "modules/audio/domain/SoundCue.h"

namespace lila::modules::audio::infrastructure
{
struct NotificationAudioEvent final
{
    std::optional<domain::SoundCue> cue;
    bool refreshAssets = false;
};

class NotificationAudioDecoder final
{
public:
    NotificationAudioEvent Decode(const std::string& message, int selfId);
    void Reset() { seen_.clear(); order_.clear(); }
private:
    std::unordered_set<std::string> seen_;
    std::deque<std::string> order_;
};
}
