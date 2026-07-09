package com.instaswipe.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record VerifyOtpTokenRequest (
    @NotBlank
    @Email
    String email,

    @NotBlank
    String code
) {}
