package com.amdevelopers.tms.dto;

/**
 * Standard API envelope used by every controller response.
 *
 * @param success whether the request succeeded
 * @param message human-readable status/context message
 * @param data    the payload, null for error-only responses
 */
public record ApiResponse<T>(boolean success, String message, T data) {

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, "Success", data);
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<>(true, message, data);
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(false, message, null);
    }

    public static <T> ApiResponse<T> error(String message, T data) {
        return new ApiResponse<>(false, message, data);
    }
}