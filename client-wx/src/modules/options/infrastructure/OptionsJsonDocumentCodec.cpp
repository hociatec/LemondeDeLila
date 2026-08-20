#include "modules/options/infrastructure/OptionsJsonDocumentCodec.h"
#include "modules/options/infrastructure/OptionsJsonSchemaMigrator.h"
#include "modules/options/infrastructure/OptionsStateJsonMapper.h"

#include "shared/errors/ErrorMessages.h"

#include <stdexcept>

namespace lila::modules::options::infrastructure::json
{
domain::OptionsState Parse(const nlohmann::json& document)
{
    if (!document.is_object())
    {
        throw std::runtime_error(lila::shared::errors::InvalidOptionsFile);
    }

    return ParseStateFromDocument(MigrateToCurrentSchema(document));
}

nlohmann::json Serialize(const domain::OptionsState& state)
{
    return BuildStateDocument(state);
}
}
