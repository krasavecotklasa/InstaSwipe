package com.instaswipe.dto;

import java.time.Instant;

import com.instaswipe.model.Media;

import lombok.Builder;
import lombok.Data;

@Builder
public record PostResponse(
        String id,
        String userId,
        String displayName,
        String profilePictureUrl,
        String caption,
        int likeCount,
        Media media,
        Instant createdAt,
        boolean likedByMe
) {}