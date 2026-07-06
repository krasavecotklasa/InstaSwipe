package com.instaswipe.repository;

import java.util.Optional;

import com.instaswipe.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserRepository extends MongoRepository<User, String>, UserSearchRepository, UserMatchRepository {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);
}
