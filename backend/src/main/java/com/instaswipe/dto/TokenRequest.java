package com.instaswipe.dto;

import jakarta.validation.constraints.NotBlank;

public record TokenRequest(
        @NotBlank String refreshToken) {
}
