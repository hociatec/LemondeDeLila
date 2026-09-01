#include "modules/options/infrastructure/OptionsJsonDocumentCodec.h"
#include "modules/options/infrastructure/OptionsStateJsonMapper.h"

#include "shared/errors/catalog/CoreErrorMessages.h"

#include <stdexcept>

namespace lila::modules::options::infrastructure::json
{
domain::OptionsState Parse(const nlohmann::json& document)
{
    if (!document.is_object())
    {
        throw std::runtime_error(lila::shared::errors::InvalidOptionsFile);
    }

    const auto version = document.find(std::string(keys::SchemaVersion));
    if (version == document.end() || !version->is_number_integer() ||
        version->get<int>() != domain::OptionsState::SchemaVersion)
    {
        throw std::runtime_error(lila::shared::errors::InvalidOptionsFile);
    }
    return ParseStateFromDocument(document);
}

nlohmann::json Serialize(const domain::OptionsState& state)
{
    return BuildStateDocument(state);
}
}
