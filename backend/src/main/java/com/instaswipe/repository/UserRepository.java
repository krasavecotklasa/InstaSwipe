package com.instaswipe.repository;

import java.util.Optional;

import com.instaswipe.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserRepository extends MongoRepository<User, String>, UserSearchRepository, UserMatchRepository {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    /** Cheaper than loading the full User just to read one boolean. */
    boolean existsByIdAndEmailVerifiedTrue(String id);

    /** True if the user with {@code id} has {@code userId} in their liked set (collection membership). */
    boolean existsByIdAndLikedUserIdsContains(String id, String userId);
}
