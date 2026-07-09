package com.instaswipe.repository;

import com.instaswipe.dto.UserSearchCriteria;
import com.instaswipe.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface UserSearchRepository {
    Page<User> searchDiscoverable(UserSearchCriteria criteria, Pageable pageable);

    /**
     * Free-text search over visible, onboarded users by display name. Unlike
     * {@link #searchDiscoverable}, this does NOT exclude already liked/passed users:
     * it is a plain people-search, not the matching feed.
     *
     * @param query         case-insensitive substring matched against {@code profile.name}
     * @param excludeUserId user to omit from results (typically the requester), or {@code null}
     */
    Page<User> searchByDisplayName(String query, String excludeUserId, Pageable pageable);
}
