package com.instaswipe.repository;

import com.instaswipe.model.User;

/**
 * Custom {@link UserRepository} fragment for swipe interactions. Writes go
 * through atomic {@code $addToSet} updates instead of read-modify-write on the
 * whole document, so concurrent swipes cannot clobber each other.
 */
public interface UserMatchRepository {

    /** Records that {@code userId} liked {@code targetUserId}; returns the updated user, or {@code null} if the user does not exist. */
    User recordLike(String userId, String targetUserId);

    /** Records that {@code userId} passed {@code targetUserId}; returns the updated user, or {@code null} if the user does not exist. */
    User recordPass(String userId, String targetUserId);
}
