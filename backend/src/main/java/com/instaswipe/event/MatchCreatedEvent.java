package com.instaswipe.event;

/** Published once, in-process, when a new mutual match is created. */
public record MatchCreatedEvent(String matchId, String userOneId, String userTwoId) {
}
