package com.instaswipe.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import com.instaswipe.model.RefreshToken;
import com.instaswipe.support.AbstractMongoRepositoryTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.index.IndexInfo;

class RefreshTokenRepositoryTest extends AbstractMongoRepositoryTest {

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @BeforeEach
    void clean() {
        refreshTokenRepository.deleteAll();
    }

    @Test
    void savesAndFindsByTokenHash() {
        RefreshToken saved = refreshTokenRepository.save(RefreshToken.builder()
                .userId("user-1")
                .tokenHash("hash-abc")
                .expiresAt(Instant.now().plus(30, ChronoUnit.DAYS))
                .build());

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.isRevoked()).isFalse();
        assertThat(refreshTokenRepository.findByTokenHash("hash-abc")).isPresent();
    }

    @Test
    void findsAllTokensForUser() {
        refreshTokenRepository.save(RefreshToken.builder().userId("user-2").tokenHash("h1")
                .expiresAt(Instant.now().plus(1, ChronoUnit.DAYS)).build());
        refreshTokenRepository.save(RefreshToken.builder().userId("user-2").tokenHash("h2")
                .expiresAt(Instant.now().plus(1, ChronoUnit.DAYS)).build());

        assertThat(refreshTokenRepository.findByUserId("user-2")).hasSize(2);
    }

    @Test
    void createsTtlIndexOnExpiresAt() {
        List<IndexInfo> indexes = mongoTemplate.indexOps(RefreshToken.class).getIndexInfo();

        IndexInfo ttlIndex = indexes.stream()
                .filter(i -> i.getIndexFields().stream()
                        .anyMatch(f -> f.getKey().equals("expiresAt")))
                .findFirst()
                .orElseThrow(() -> new AssertionError("no index on expiresAt"));

        assertThat(ttlIndex.getExpireAfter()).isPresent();
    }
}
