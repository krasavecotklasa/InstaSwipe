package com.instaswipe.dto;

import com.instaswipe.model.Gender;

import java.util.List;

public record PublicProfileResponse(
        String id,
        String displayName,
        String bio,
        int age,
        String country,
        Gender gender,
        List<String> interests,
        String profilePictureUrl
) {
}
