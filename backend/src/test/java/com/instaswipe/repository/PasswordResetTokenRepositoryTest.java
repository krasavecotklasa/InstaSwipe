package com.instaswipe.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import com.instaswipe.model.PasswordResetToken;
import com.instaswipe.support.AbstractMongoRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.index.IndexInfo;

class PasswordResetTokenRepositoryTest extends AbstractMongoRepositoryTest {

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @BeforeEach
    void clean() {
        passwordResetTokenRepository.deleteAll();
    }

    @Test
    void savesAndFindsByTokenHash() {
        PasswordResetToken saved = passwordResetTokenRepository.save(PasswordResetToken.builder()
                .userId("user-1")
                .tokenHash("reset-abc")
                .expiresAt(Instant.now().plus(30, ChronoUnit.MINUTES))
                .build());

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.isUsed()).isFalse();
        assertThat(passwordResetTokenRepository.findByTokenHash("reset-abc")).isPresent();
    }

    @Test
    void findsLatestActiveTokenByEmail() {
        passwordResetTokenRepository.save(PasswordResetToken.builder()
                .email("otp@example.com")
                .tokenHash("reset-xyz")
                .expiresAt(Instant.now().plus(10, ChronoUnit.MINUTES))
                .used(false)
                .build());

        PasswordResetToken found = passwordResetTokenRepository
                .findTopByEmailAndUsedFalseOrderByExpiresAtDesc("otp@example.com")
                .orElseThrow();

        assertThat(found.getEmail()).isEqualTo("otp@example.com");
        assertThat(found.getTokenHash()).isEqualTo("reset-xyz");
    }

    @Test
    void createsTtlIndexOnExpiresAt() {
        List<IndexInfo> indexes = mongoTemplate.indexOps(PasswordResetToken.class).getIndexInfo();

        IndexInfo ttlIndex = indexes.stream()
                .filter(i -> i.getIndexFields().stream()
                        .anyMatch(f -> f.getKey().equals("expiresAt")))
                .findFirst()
                .orElseThrow(() -> new AssertionError("no index on expiresAt"));

        assertThat(ttlIndex.getExpireAfter()).isPresent();
    }
}
