package com.instaswipe.repository;

import com.instaswipe.dto.UserSearchCriteria;
import com.instaswipe.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface UserSearchRepository {
    Page<User> searchDiscoverable(UserSearchCriteria criteria, Pageable pageable);
}
