package com.instaswipe.dto;

public record AuthResponse(String accessToken, String refreshToken, UserResponse user) {
}
