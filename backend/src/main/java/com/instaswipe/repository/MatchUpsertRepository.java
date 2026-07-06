package com.instaswipe.repository;

/**
 * Race-safe match creation. Keyed by the deterministic match id so concurrent
 * mutual likes converge on a single document.
 */
public interface MatchUpsertRepository {

    /** Inserts the match if absent. Returns {@code true} only when THIS call created it. */
    boolean createIfAbsent(String matchId, String userOneId, String userTwoId);
}
