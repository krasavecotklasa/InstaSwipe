package com.instaswipe.service;

import com.instaswipe.dto.UserResponse;

public record AuthSession(String accessToken, String refreshToken, UserResponse user) {
}
