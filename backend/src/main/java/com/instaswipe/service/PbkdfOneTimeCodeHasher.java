package com.instaswipe.service;

import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Shared PBKDF2 code generation/hashing for one-time codes (password reset, email verification).
 * Centralized so a security fix here (iteration count, encoding format) applies to every OTP flow
 * instead of drifting across independent copies.
 */
@Slf4j
@Component
class PbkdfOneTimeCodeHasher {

    private static final int PBKDF2_ITERATIONS = 120_000;
    private static final int SALT_LENGTH_BYTES = 16;
    private static final int KEY_LENGTH_BITS = 256;
    private static final int DEFAULT_CODE_LENGTH = 6;
    private static final int MAX_CODE_LENGTH = 9;

    private final SecureRandom secureRandom = new SecureRandom();

    /** Guards against an unset/misconfigured length (0 would build the invalid pattern "%00d")
     * and caps it so 10^length stays within int range. */
    String generateCode(int configuredLength) {
        int length = configuredLength > 0 ? Math.min(configuredLength, MAX_CODE_LENGTH) : DEFAULT_CODE_LENGTH;
        int bound = (int) Math.pow(10, length);
        return String.format("%0" + length + "d", secureRandom.nextInt(bound));
    }

    String hash(String value) {
        byte[] salt = new byte[SALT_LENGTH_BYTES];
        secureRandom.nextBytes(salt);

        try {
            PBEKeySpec spec = new PBEKeySpec(value.toCharArray(), salt, PBKDF2_ITERATIONS, KEY_LENGTH_BITS);
            SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            byte[] hashed = factory.generateSecret(spec).getEncoded();
            return PBKDF2_ITERATIONS + ":"
                    + Base64.getEncoder().encodeToString(salt) + ":"
                    + Base64.getEncoder().encodeToString(hashed);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("PBKDF2WithHmacSHA256 not available", e);
        }
    }

    boolean verify(String rawValue, String stored) {
        try {
            String[] parts = stored.split(":");
            if (parts.length != 3) {
                return false;
            }

            int iterations = Integer.parseInt(parts[0]);
            byte[] salt = Base64.getDecoder().decode(parts[1]);
            byte[] expected = Base64.getDecoder().decode(parts[2]);

            PBEKeySpec spec = new PBEKeySpec(rawValue.toCharArray(), salt, iterations, expected.length * 8);
            SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            byte[] actual = factory.generateSecret(spec).getEncoded();

            return MessageDigest.isEqual(actual, expected); // constant-time comparison
        } catch (IllegalArgumentException | GeneralSecurityException e) {
            log.warn("Unable to verify one-time code hash", e);
            return false;
        }
    }
}
