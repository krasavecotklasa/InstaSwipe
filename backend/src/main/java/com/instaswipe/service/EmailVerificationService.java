package com.instaswipe.service;

import java.time.Instant;
import java.util.Locale;
import java.util.Optional;

import com.instaswipe.dto.EmailResponse;
import com.instaswipe.model.EmailVerificationToken;
import com.instaswipe.model.User;
import com.instaswipe.repository.EmailVerificationTokenRepository;
import com.instaswipe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailVerificationService {

    private static final int MAX_VERIFICATION_ATTEMPTS = 5;

    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final PbkdfOneTimeCodeHasher codeHasher;

    @Value("${otp.expiry-minutes:10}")
    private int expiryMinutes;

    @Value("${otp.length:6}")
    private int otpLength;

    public void sendVerification(String email) {
        String normalized = normalizeEmail(email);
        emailVerificationTokenRepository.deleteAllByEmail(normalized);

        String code = codeHasher.generateCode(otpLength);
        Instant expiresAt = Instant.now().plusSeconds(expiryMinutes * 60L);

        EmailVerificationToken token = EmailVerificationToken.builder()
                .email(normalized)
                .tokenHash(codeHasher.hash(normalized + ":" + code))
                .expiresAt(expiresAt)
                .build();

        emailVerificationTokenRepository.save(token);

        EmailResponse response = emailService.sendVerificationEmail(normalized, code);
        if (!response.success()) {
            log.warn("Failed to send verification email to {}: {}", normalized, response.error());
        }
    }

    /** Re-sends a verification code for an existing, not-yet-verified account. Silently does
     * nothing for an unknown or already-verified email so this can't be used to enumerate accounts. */
    public void resendVerification(String email) {
        String normalized = normalizeEmail(email);
        userRepository.findByEmail(normalized)
                .filter(user -> !user.isEmailVerified())
                .ifPresent(user -> sendVerification(normalized));
    }

    public boolean verify(String email, String code) {
        String normalized = normalizeEmail(email);
        EmailVerificationToken token = findValidToken(normalized, code);
        if (token == null) {
            return false;
        }

        User user = userRepository.findByEmail(normalized).orElse(null);
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
        boolean matches = codeHasher.verify(email + ":" + code, token.getTokenHash());

        if (matches && notExpired) {
            return token;
        }

        if (!matches) {
            token.setAttempts(token.getAttempts() + 1);
            emailVerificationTokenRepository.save(token);
        }

        return null;
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
