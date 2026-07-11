package com.instaswipe.repository;

import java.util.Optional;

import com.instaswipe.model.EmailVerificationToken;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface EmailVerificationTokenRepository extends MongoRepository<EmailVerificationToken, String> {

    Optional<EmailVerificationToken> findTopByEmailAndUsedFalseOrderByExpiresAtDesc(String email);

    void deleteAllByEmail(String email);
}
