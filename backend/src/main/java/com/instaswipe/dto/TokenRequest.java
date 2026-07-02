package com.instaswipe.dto;

import jakarta.validation.constraints.NotBlank;

public record TokenRequest(
        @NotBlank(message = "Refresh token is required")
        String refreshToken
) {
}
