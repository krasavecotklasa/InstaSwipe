package com.instaswipe.service;

import com.instaswipe.model.PasswordResetToken;
import com.instaswipe.model.User;
import com.instaswipe.repository.PasswordResetTokenRepository;
import com.instaswipe.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Method;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OtpServiceTest {

    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private OtpService otpService;

    @BeforeEach
    void setUp() {
        // @Value fields are not populated by @InjectMocks; set the same defaults
        // the container would inject so generateCode()/expiry behave like production.
        ReflectionTestUtils.setField(otpService, "otpLength", 6);
        ReflectionTestUtils.setField(otpService, "expiryMinutes", 10);
    }

    @Test
    void sendOtpStoresSaltedPasswordHashForToken() {
        ArgumentCaptor<PasswordResetToken> tokenCaptor = ArgumentCaptor.forClass(PasswordResetToken.class);
        ArgumentCaptor<String> codeCaptor = ArgumentCaptor.forClass(String.class);

        otpService.sendOtp("user@example.com");

        verify(passwordResetTokenRepository).save(tokenCaptor.capture());
        verify(emailService).sendPasswordResetEmail(eq("user@example.com"), codeCaptor.capture(), eq(10));

        String code = codeCaptor.getValue();
        String tokenHash = tokenCaptor.getValue().getTokenHash();
        String[] parts = tokenHash.split(":");

        assertNotEquals("user@example.com:" + code, tokenHash);
        assertEquals(3, parts.length);
        assertTrue(Integer.parseInt(parts[0]) >= 120_000);
        assertTrue(Base64.getDecoder().decode(parts[1]).length > 0);
        assertTrue(Base64.getDecoder().decode(parts[2]).length > 0);
    }

    @Test
    void resetPasswordUpdatesStoredPasswordWhenOtpIsValid() throws Exception {
        String email = "user@example.com";
        String code = "123456";
        String newPassword = "newPassword123";
        String encodedPassword = "$2a$10$encoded";
        User user = User.builder().email(email).passwordHash("oldHash").build();

        Method hashMethod = OtpService.class.getDeclaredMethod("hash", String.class);
        hashMethod.setAccessible(true);
        String tokenHash = (String) hashMethod.invoke(otpService, email + ":" + code);

        when(passwordResetTokenRepository.findTopByEmailAndUsedFalseOrderByExpiresAtDesc(email))
                .thenReturn(Optional.of(PasswordResetToken.builder()
                        .email(email)
                        .tokenHash(tokenHash)
                        .expiresAt(Instant.now().plusSeconds(60))
                        .used(false)
                        .build()));
        when(userRepository.findByEmail(email)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode(newPassword)).thenReturn(encodedPassword);

        otpService.resetPassword(email, code, newPassword);

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        assertEquals(encodedPassword, userCaptor.getValue().getPasswordHash());
    }
}
