package com.instaswipe.dto;

import com.instaswipe.model.Gender;
import com.instaswipe.model.Role;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

public record AdminUserDetailResponse(
        String id,
        String email,
        Set<Role> roles,
        boolean enabled,
        boolean emailVerified,
        String displayName,
        String bio,
        LocalDate birthDate,
        String country,
        Gender gender,
        List<String> interests,
        String profilePictureUrl,
        int likedCount,
        int passedCount,
        Instant createdAt,
        Instant updatedAt
) {
}
