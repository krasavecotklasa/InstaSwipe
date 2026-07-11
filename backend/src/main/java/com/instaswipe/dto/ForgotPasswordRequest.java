package com.instaswipe.dto;

import com.instaswipe.ratelimit.EmailKeyed;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record ForgotPasswordRequest (
    @NotBlank
    @Email
    String email
) implements EmailKeyed {}
