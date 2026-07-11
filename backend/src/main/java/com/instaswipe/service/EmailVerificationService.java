package com.instaswipe.service;

import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

import com.instaswipe.model.EmailVerificationToken;
import com.instaswipe.model.User;
import com.instaswipe.repository.EmailVerificationTokenRepository;
import com.instaswipe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailVerificationService {

    private static final int PBKDF2_ITERATIONS = 120_000;
    private static final int SALT_LENGTH_BYTES = 16;
    private static final int KEY_LENGTH_BITS = 256;
    private static final int DEFAULT_OTP_LENGTH = 6;
    private static final int MAX_OTP_LENGTH = 9;
    private static final int MAX_VERIFICATION_ATTEMPTS = 5;

    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${otp.expiry-minutes:10}")
    private int expiryMinutes;

    @Value("${otp.length:6}")
    private int otpLength;

    public void sendVerification(String email) {
        emailVerificationTokenRepository.deleteAllByEmail(email);

        String code = generateCode();
        Instant expiresAt = Instant.now().plusSeconds(expiryMinutes * 60L);

        EmailVerificationToken token = EmailVerificationToken.builder()
                .email(email)
                .tokenHash(hash(email + ":" + code))
                .expiresAt(expiresAt)
                .code(code)
                .used(false)
                .build();

        emailVerificationTokenRepository.save(token);
        emailService.sendVerificationEmail(email, code);
    }

    public boolean verify(String email, String code) {
        EmailVerificationToken token = findValidToken(email, code);
        if (token == null) {
            return false;
        }

        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return false;
        }

        user.setEmailVerified(true);
        userRepository.save(user);
        token.setUsed(true);
        emailVerificationTokenRepository.save(token);
        return true;
    }

    private EmailVerificationToken findValidToken(String email, String code) {
        Optional<EmailVerificationToken> tokenOpt = emailVerificationTokenRepository
                .findTopByEmailAndUsedFalseOrderByExpiresAtDesc(email);
        if (tokenOpt.isEmpty()) {
            return null;
        }

        EmailVerificationToken token = tokenOpt.get();
        if (token.getAttempts() >= MAX_VERIFICATION_ATTEMPTS) {
            return null;
        }

        boolean notExpired = Instant.now().isBefore(token.getExpiresAt());
        boolean matches = verifyHash(email + ":" + code, token.getTokenHash());

        if (matches && notExpired) {
            return token;
        }

        if (!matches) {
            token.setAttempts(token.getAttempts() + 1);
            emailVerificationTokenRepository.save(token);
        }

        return null;
    }

    private String generateCode() {
        int length = otpLength > 0 ? Math.min(otpLength, MAX_OTP_LENGTH) : DEFAULT_OTP_LENGTH;
        int bound = (int) Math.pow(10, length);
        return String.format("%0" + length + "d", secureRandom.nextInt(bound));
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

    private boolean verifyHash(String rawValue, String stored) {
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

            return MessageDigest.isEqual(actual, expected);
        } catch (IllegalArgumentException | GeneralSecurityException e) {
            log.warn("Unable to verify email token hash", e);
            return false;
        }
    }
}
