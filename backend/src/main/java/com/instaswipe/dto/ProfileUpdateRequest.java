package com.instaswipe.dto;

import com.instaswipe.model.Gender;
import com.instaswipe.validation.MinAge;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;

/**
 * Bound from multipart/form-data so the profile picture can be uploaded inline.
 * The picture is optional on update: when omitted, the existing picture is kept.
 */
public record ProfileUpdateRequest(
        @NotBlank(message = "Display name cannot be blank")
        String displayName,
        @NotBlank(message = "Bio cannot be blank")
        String bio,
        @NotNull(message = "Birth date is required")
        @Past(message = "Birth date must be in the past")
        @MinAge
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
        LocalDate birthDate,
        @NotBlank(message = "Country cannot be blank")
        String country,
        @NotNull(message = "Gender selection is required")
        Gender gender,
        @NotNull(message = "Interests selection is required")
        @Size(min = 3, message = "You must select at least 3 interests")
        List<String> interests,
        MultipartFile profilePicture
) {
}
