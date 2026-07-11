package com.instaswipe.service;

import java.time.Instant;
import java.util.Optional;

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

    private static final int MAX_VERIFICATION_ATTEMPTS = 5;

    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final PbkdfOneTimeCodeHasher codeHasher;

    @Value("${otp.expiry-minutes:10}")
    private int expiryMinutes;

    @Value("${otp.length:6}")
    private int otpLength;

    public void sendOtp(String email) {
        passwordResetTokenRepository.deleteAllByEmail(email);

        String code = codeHasher.generateCode(otpLength);
        Instant expiresAt = Instant.now().plusSeconds(expiryMinutes * 60L);

        PasswordResetToken token = PasswordResetToken.builder()
                .email(email)
                .tokenHash(codeHasher.hash(email + ":" + code))
                .expiresAt(expiresAt)
                .used(false)
                .build();

        passwordResetTokenRepository.save(token);
        emailService.sendPasswordResetEmail(email, code, expiryMinutes);
    }

    private PasswordResetToken findValidToken(String email, String code) {
        Optional<PasswordResetToken> tokenOpt = passwordResetTokenRepository
                .findTopByEmailAndUsedFalseOrderByExpiresAtDesc(email);
        if (tokenOpt.isEmpty())
            return null;

        PasswordResetToken token = tokenOpt.get();

        // Lock the token out once too many wrong codes have been tried, so a
        // 6-digit OTP can't be brute-forced within its validity window.
        if (token.getAttempts() >= MAX_VERIFICATION_ATTEMPTS) {
            return null;
        }

        boolean notExpired = Instant.now().isBefore(token.getExpiresAt());
        boolean matches = codeHasher.verify(email + ":" + code, token.getTokenHash());

        if (matches && notExpired) {
            return token;
        }

        // Only wrong codes count against the attempt budget; an expired-but-correct
        // code is already dead and doesn't need to burn attempts.
        if (!matches) {
            token.setAttempts(token.getAttempts() + 1);
            passwordResetTokenRepository.save(token);
        }

        return null;
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

}
