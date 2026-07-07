package com.instaswipe.dto;

import java.time.Instant;

public record MatchResponse(String matchId, String otherUserId, Instant matchedAt) {
}
