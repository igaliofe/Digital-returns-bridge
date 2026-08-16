package com.drb.server.service;

import com.drb.server.service.exception.ValidationException;
import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * Parses enum values coming from untrusted request data.
 *
 * <p>A raw {@code Enum.valueOf(...)} throws {@link IllegalArgumentException}, which the REST layer
 * maps to a 500. Bad user input must be a 400, so this helper throws the mapped
 * {@link ValidationException} instead.
 */
public final class EnumParser {

    private EnumParser() {
    }

    /**
     * @param type      the enum type to parse into
     * @param value     the raw request value; null or blank yields null
     * @param fieldName the request field name, used in the error message
     * @return the parsed constant, or null when the value is null or blank
     * @throws ValidationException with code "INVALID_ENUM" when the value is not a legal constant
     */
    public static <E extends Enum<E>> E parse(Class<E> type, String value, String fieldName) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        for (E constant : type.getEnumConstants()) {
            if (constant.name().equals(trimmed)) {
                return constant;
            }
        }
        throw new ValidationException("INVALID_ENUM",
            "Invalid value '" + trimmed + "' for field '" + fieldName + "'. Allowed values: "
                + allowedValues(type));
    }

    private static <E extends Enum<E>> String allowedValues(Class<E> type) {
        return Arrays.stream(type.getEnumConstants())
            .map(Enum::name)
            .collect(Collectors.joining(", "));
    }
}
