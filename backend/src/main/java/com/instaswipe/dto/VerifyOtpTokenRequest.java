package com.instaswipe.dto;

import com.instaswipe.ratelimit.EmailKeyed;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record VerifyOtpTokenRequest (
    @NotBlank
    @Email
    String email,

    @NotBlank
    String code
) implements EmailKeyed {}
