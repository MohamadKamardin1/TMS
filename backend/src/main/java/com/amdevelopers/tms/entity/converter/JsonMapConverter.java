package com.amdevelopers.tms.entity.converter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Map;

/**
 * Persists an arbitrary {@code Map<String, Object>} as a JSON text column and
 * restores it on read. Keeps the DB schema portable (plain TEXT works on both
 * MySQL and H2) while the entity/API surface stays a real JSON object.
 */
@Converter
public class JsonMapConverter implements AttributeConverter<Map<String, Object>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };

    @Override
    public String convertToDatabaseColumn(Map<String, Object> attribute) {
        if (attribute == null || attribute.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(attribute);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not serialize measurements to JSON", e);
        }
    }

    @Override
    public Map<String, Object> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return null;
        }
        try {
            return MAPPER.readValue(dbData, MAP_TYPE);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Stored measurements are not valid JSON", e);
        }
    }

    /**
     * Parses a client-supplied JSON string into a measurements map. The value
     * must be a JSON object (not an array or scalar), otherwise an
     * {@link IllegalArgumentException} is raised so callers surface a 400.
     */
    public static Map<String, Object> parseClientJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return MAPPER.readValue(json, MAP_TYPE);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("measurements must be a JSON object (e.g. {\"chest\":\"40\"})", e);
        }
    }
}
