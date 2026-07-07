package com.instaswipe.dto;

import com.instaswipe.model.Role;

import java.time.Instant;
import java.util.Set;

public record AdminUserSummaryResponse(
        String id,
        String email,
        Set<Role> roles,
        boolean enabled,
        boolean emailVerified,
        String displayName,
        Instant createdAt
) {
}
