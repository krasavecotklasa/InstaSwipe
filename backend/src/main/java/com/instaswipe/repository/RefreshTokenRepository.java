package com.instaswipe.repository;

import java.util.List;
import java.util.Optional;

import com.instaswipe.model.RefreshToken;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface RefreshTokenRepository extends MongoRepository<RefreshToken, String> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    List<RefreshToken> findByUserId(String userId);
}
