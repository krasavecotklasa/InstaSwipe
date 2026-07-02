package com.instaswipe.service;

import java.util.Locale;

import com.instaswipe.dto.LoginRequest;
import com.instaswipe.dto.RegisterRequest;
import com.instaswipe.dto.UserResponse;
import com.instaswipe.exception.EmailAlreadyUsedException;
import com.instaswipe.exception.InvalidCredentialsException;
import com.instaswipe.model.User;
import com.instaswipe.model.UserProfile;
import com.instaswipe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;

    // A valid BCrypt hash compared against on login misses so response time does not reveal
    // whether an account exists (mitigates user enumeration via a timing side channel).
    private static final String DUMMY_PASSWORD_HASH =
            "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

    /** Creates a new account. Fails if the email is already registered. */
    public UserResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyUsedException();
        }
        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(request.password()))
                .profile(UserProfile.builder().name(request.name()).build())
                .build();
        User saved = userRepository.save(user);
        return new UserResponse(saved.getId(), saved.getEmail());
    }

    /** Authenticates and issues an access token plus a persisted refresh token. */
    public AuthSession login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            // Run a comparison anyway so timing does not reveal whether the email exists.
            passwordEncoder.matches(request.password(), DUMMY_PASSWORD_HASH);
            throw new InvalidCredentialsException();
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash()) || !user.isEnabled()) {
            throw new InvalidCredentialsException();
        }
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = refreshTokenService.issue(user.getId());
        return new AuthSession(accessToken, refreshToken, new UserResponse(user.getId(), user.getEmail()));
    }

    public AuthSession refresh(String refreshToken) {
        try {
            String userId = refreshTokenService.userIdForValidToken(refreshToken);
            User user = userRepository.findById(userId)
                    .orElseThrow(InvalidCredentialsException::new);
            RefreshTokenService.TokenRotation rotation = refreshTokenService.rotate(refreshToken);
            String accessToken = jwtService.generateAccessToken(user);
            return new AuthSession(accessToken, rotation.refreshToken(),
                    new UserResponse(user.getId(), user.getEmail()));
        } catch (IllegalArgumentException ex) {
            throw new InvalidCredentialsException();
        }
    }

    public void logout(String refreshToken) {
        refreshTokenService.revoke(refreshToken);
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
