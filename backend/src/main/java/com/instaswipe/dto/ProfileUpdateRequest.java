package com.instaswipe.dto;

import com.instaswipe.model.Gender;
import com.instaswipe.validation.MinAge;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;

import java.time.LocalDate;

public record ProfileUpdateRequest(
        @NotBlank(message = "Display name cannot be blank")
        String displayName,
        @NotBlank(message = "Bio cannot be blank")
        String bio,
        @NotNull(message = "Birth date is required")
        @Past(message = "Birth date must be in the past")
        @MinAge
        LocalDate birthDate,
        @NotBlank(message = "Country cannot be blank")
        String country,
        @NotNull(message = "Gender selection is required")
        Gender gender
) {
}
