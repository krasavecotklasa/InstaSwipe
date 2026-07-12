package com.instaswipe.dto;

import com.instaswipe.model.Gender;
import com.instaswipe.model.MediaStatus;

import java.time.LocalDate;
import java.util.List;

public record OwnProfileResponse(
        String id,
        String email,
        String displayName,
        String bio,
        LocalDate birthDate,
        String country,
        Gender gender,
        List<String> interests,
        String profilePictureUrl,
        MediaStatus profilePictureStatus
) {
}
