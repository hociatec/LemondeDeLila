#pragma once

#include <cstdint>
#include <stdexcept>
#include <string>
#include <string_view>

#include "shared/errors/catalog/CoreErrorMessages.h"

namespace lila::shared::text
{
[[nodiscard]] inline std::wstring Utf8ToWide(std::string_view value)
{
    std::wstring result;
    result.reserve(value.size());
    for (std::size_t index = 0; index < value.size();)
    {
        const auto first = static_cast<unsigned char>(value[index++]);
        std::uint32_t codePoint = first;
        std::size_t continuationCount = 0;
        std::uint32_t minimum = 0;
        if ((first & 0xE0U) == 0xC0U)
        {
            codePoint = first & 0x1FU;
            continuationCount = 1;
            minimum = 0x80;
        }
        else if ((first & 0xF0U) == 0xE0U)
        {
            codePoint = first & 0x0FU;
            continuationCount = 2;
            minimum = 0x800;
        }
        else if ((first & 0xF8U) == 0xF0U)
        {
            codePoint = first & 0x07U;
            continuationCount = 3;
            minimum = 0x10000;
        }
        else if (first >= 0x80U)
            throw std::runtime_error(lila::shared::errors::Utf8ToWideConversionFailed);

        if (index + continuationCount > value.size())
            throw std::runtime_error(lila::shared::errors::Utf8ToWideConversionFailed);
        for (std::size_t continuation = 0; continuation < continuationCount; ++continuation)
        {
            const auto byte = static_cast<unsigned char>(value[index++]);
            if ((byte & 0xC0U) != 0x80U)
                throw std::runtime_error(lila::shared::errors::Utf8ToWideConversionFailed);
            codePoint = (codePoint << 6U) | (byte & 0x3FU);
        }
        if (codePoint < minimum || codePoint > 0x10FFFFU ||
            (codePoint >= 0xD800U && codePoint <= 0xDFFFU))
            throw std::runtime_error(lila::shared::errors::Utf8ToWideConversionFailed);

        if constexpr (sizeof(wchar_t) == 2)
        {
            if (codePoint <= 0xFFFFU) result.push_back(static_cast<wchar_t>(codePoint));
            else
            {
                codePoint -= 0x10000U;
                result.push_back(static_cast<wchar_t>(0xD800U + (codePoint >> 10U)));
                result.push_back(static_cast<wchar_t>(0xDC00U + (codePoint & 0x3FFU)));
            }
        }
        else result.push_back(static_cast<wchar_t>(codePoint));
    }
    return result;
}
}
