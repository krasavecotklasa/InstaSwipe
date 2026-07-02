package com.instaswipe.dto;

public record OnboardingStatusResponse(String email, boolean needsOnboarding, boolean emailVerified) {
}
