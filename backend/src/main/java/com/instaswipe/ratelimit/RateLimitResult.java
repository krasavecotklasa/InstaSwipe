package com.instaswipe.ratelimit;

public record RateLimitResult(
        boolean allowed,
        long remaining,
        long retryAfterSeconds
) {
}
