package com.instaswipe.service;

import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.security.MessageDigest;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.stereotype.Service;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.instaswipe.model.PasswordResetToken;
import com.instaswipe.model.User;
import com.instaswipe.repository.PasswordResetTokenRepository;
import com.instaswipe.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;

@Service
@RequiredArgsConstructor
@Slf4j
public class OtpService {

    private static final int PBKDF2_ITERATIONS = 120_000;
    private static final int SALT_LENGTH_BYTES = 16;
    private static final int KEY_LENGTH_BITS = 256;

    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${otp.expiry-minutes:10}")
    private int expiryMinutes;

    @Value("${otp.length:6}")
    private int otpLength;

    public void sendOtp(String email) {
        passwordResetTokenRepository.deleteAllByEmail(email);

        String code = generateCode();
        Instant expiresAt = Instant.now().plusSeconds(expiryMinutes * 60L);

        log.warn(code);

        PasswordResetToken token = PasswordResetToken.builder()
                .email(email)
                // .code(code)
                .tokenHash(hash(email + ":" + code))
                .expiresAt(expiresAt)
                .used(false)
                .build();

        passwordResetTokenRepository.save(token);
        emailService.sendPasswordResetEmail(email, code);
    }

    private PasswordResetToken findValidToken(String email, String code) {
        Optional<PasswordResetToken> tokenOpt = passwordResetTokenRepository
                .findTopByEmailAndUsedFalseOrderByExpiresAtDesc(email);
        if (tokenOpt.isEmpty())
            return null;

        PasswordResetToken token = tokenOpt.get();
        boolean valid = verify(email + ":" + code, token.getTokenHash())
                && Instant.now().isBefore(token.getExpiresAt());

        return valid ? token : null;
    }

    public boolean verifyOtp(String email, String code) {
        return findValidToken(email, code) != null;
    }

    public void resetPassword(String email, String code, String password) {
        PasswordResetToken token = findValidToken(email, code);
        if (token == null) {
            throw new IllegalArgumentException("Invalid or expired OTP");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found for password reset"));

        user.setPasswordHash(passwordEncoder.encode(password));
        userRepository.save(user);

        token.setUsed(true);
        passwordResetTokenRepository.save(token);
    }

    private String generateCode() {
        SecureRandom random = new SecureRandom();
        int max = (int) Math.pow(10, otpLength);
        return String.format("%0" + otpLength + "d", random.nextInt(max));
    }

    private String hash(String value) {
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

    private boolean verify(String rawValue, String stored) {
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
            log.warn("Unable to verify OTP hash", e);
            return false;
        }
    }
}
