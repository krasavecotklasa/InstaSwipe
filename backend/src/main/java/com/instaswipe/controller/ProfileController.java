package com.instaswipe.controller;

import com.instaswipe.dto.OnboardingStatusResponse;
import com.instaswipe.dto.ProfileUpdateRequest;
import com.instaswipe.repository.UserRepository;
import com.instaswipe.service.ProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final UserRepository userRepository;
    private final ProfileService profileService;

    @GetMapping("/status")
    public ResponseEntity<OnboardingStatusResponse> getOnboardingStatus(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(profileService.getStatus(userId));
    }

    @PutMapping("/update")
    public ResponseEntity<String> updateProfile(
            @AuthenticationPrincipal String userId,
            @Valid @RequestBody ProfileUpdateRequest request) {

        profileService.updateProfile(userId, request);
        return ResponseEntity.ok("Profile updated successfully.");
    }
}
