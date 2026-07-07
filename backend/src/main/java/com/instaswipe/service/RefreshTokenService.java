package com.instaswipe.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

import com.instaswipe.config.JwtProperties;
import com.instaswipe.model.RefreshToken;
import com.instaswipe.repository.RefreshTokenRepository;
import org.springframework.stereotype.Service;

/**
 * Issues opaque refresh tokens: a random raw value is returned to the caller
 * while only its SHA-256 hash is persisted.
 */
@Service
public class RefreshTokenService {

    private static final int TOKEN_BYTES = 32;

    private final RefreshTokenRepository refreshTokenRepository;
    private final Duration refreshExpiration;
    private final SecureRandom secureRandom = new SecureRandom();

    public RefreshTokenService(RefreshTokenRepository refreshTokenRepository, JwtProperties properties) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.refreshExpiration = properties.refreshExpiration();
    }

    /** Creates and stores a refresh token for the user, returning the raw token. */
    public String issue(String userId) {
        String rawToken = generateRawToken();
        refreshTokenRepository.save(RefreshToken.builder()
                .userId(userId)
                .tokenHash(hash(rawToken))
                .expiresAt(Instant.now().plus(refreshExpiration))
                .build());
        return rawToken;
    }

    public TokenRotation rotate(String rawToken) {
        RefreshToken current = requireValid(rawToken);
        current.setRevoked(true);
        refreshTokenRepository.save(current);
        return new TokenRotation(current.getUserId(), issue(current.getUserId()));
    }

    public String userIdForValidToken(String rawToken) {
        return requireValid(rawToken).getUserId();
    }

    public void revoke(String rawToken) {
        refreshTokenRepository.findByTokenHash(hash(rawToken))
                .ifPresent(token -> {
                    token.setRevoked(true);
                    refreshTokenRepository.save(token);
                });
    }

    private RefreshToken requireValid(String rawToken) {
        RefreshToken token = refreshTokenRepository.findByTokenHash(hash(rawToken))
                .orElseThrow(IllegalArgumentException::new);
        if (token.isRevoked() || token.getExpiresAt() == null || !token.getExpiresAt().isAfter(Instant.now())) {
            throw new IllegalArgumentException();
        }
        return token;
    }

    private String generateRawToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    public record TokenRotation(String userId, String refreshToken) {
    }
}
