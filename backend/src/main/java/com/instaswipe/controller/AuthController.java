package com.instaswipe.controller;

import com.instaswipe.dto.AuthResponse;
import com.instaswipe.dto.LoginRequest;
import com.instaswipe.dto.RegisterRequest;
import com.instaswipe.dto.TokenRequest;
import com.instaswipe.dto.UserResponse;
import com.instaswipe.service.AuthService;
import com.instaswipe.service.AuthSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
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

    private AuthResponse toResponse(AuthSession session) {
        return new AuthResponse(session.accessToken(), session.refreshToken(), session.user());
    }
}
