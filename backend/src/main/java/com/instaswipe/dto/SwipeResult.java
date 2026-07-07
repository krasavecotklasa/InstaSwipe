package com.instaswipe.dto;

public record SwipeResult(SwipeStatus status, String matchId) {

    public static SwipeResult passed() {
        return new SwipeResult(SwipeStatus.PASSED, null);
    }

    public static SwipeResult liked() {
        return new SwipeResult(SwipeStatus.LIKED, null);
    }

    public static SwipeResult matched(String matchId) {
        return new SwipeResult(SwipeStatus.MATCHED, matchId);
    }
}
