package com.instaswipe.controller;

import com.instaswipe.dto.AuthResponse;
import com.instaswipe.dto.ForgotPasswordRequest;
import com.instaswipe.dto.LoginRequest;
import com.instaswipe.dto.RegisterRequest;
import com.instaswipe.dto.ResetPasswordRequest;
import com.instaswipe.dto.TokenRequest;
import com.instaswipe.dto.UserResponse;
import com.instaswipe.dto.VerifyOtpTokenRequest;
import com.instaswipe.ratelimit.KeyStrategy;
import com.instaswipe.ratelimit.RateLimited;
import com.instaswipe.ratelimit.RateLimits;
import com.instaswipe.service.AuthService;
import com.instaswipe.service.AuthSession;
import com.instaswipe.service.EmailVerificationService;
import com.instaswipe.service.OtpService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final OtpService otpService;
    private final EmailVerificationService emailVerificationService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @RateLimited(bucket = "register", keyBy = KeyStrategy.IP, limit = 10, windowSeconds = 3600)
    public UserResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    @RateLimited(bucket = "login", keyBy = KeyStrategy.IP, limit = 20, windowSeconds = 600)
    @RateLimited(bucket = "login", keyBy = KeyStrategy.EMAIL, limit = 5, windowSeconds = 600)
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        AuthSession session = authService.login(request);
        return toResponse(session);
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody TokenRequest request) {
        AuthSession session = authService.refresh(request.refreshToken());
        return toResponse(session);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody TokenRequest request) {
        authService.logout(request.refreshToken());
    }

    @PostMapping("/password/forgot")
    @ResponseStatus(HttpStatus.OK)
    @RateLimited(bucket = "forgot-password", keyBy = KeyStrategy.IP, limit = 10, windowSeconds = 3600)
    @RateLimited(bucket = "forgot-password", keyBy = KeyStrategy.EMAIL, limit = 3, windowSeconds = 3600)
    public void sendPasswordResetToken(@RequestBody @Valid ForgotPasswordRequest request) {
        otpService.sendOtp(request.email());
    }

    @PostMapping("/password/verify")
    public ResponseEntity<Void> verifyOtp(@RequestBody @Valid VerifyOtpTokenRequest request) {
        if (otpService.verifyOtp(request.email(), request.code())) {
            return ResponseEntity.ok().build();
        } else {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }

    @PostMapping("/verify-email")
    public ResponseEntity<Void> verifyEmail(@RequestBody @Valid VerifyOtpTokenRequest request) {
        if (emailVerificationService.verify(request.email(), request.code())) {
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }

    @PostMapping("/password/reset")
    public ResponseEntity<Void> resetPasswordWithOtp(@RequestBody @Valid ResetPasswordRequest request) {
        try {
            otpService.resetPassword(request.email(), request.code(), request.newPassword());
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    private AuthResponse toResponse(AuthSession session) {
        return new AuthResponse(session.accessToken(), session.refreshToken(), session.user());
    }
}
