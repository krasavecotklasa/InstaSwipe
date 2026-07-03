package com.instaswipe.controller;

import com.instaswipe.dto.OnboardingStatusResponse;
import com.instaswipe.dto.ProfilePictureResponse;
import com.instaswipe.dto.ProfileUpdateRequest;
import com.instaswipe.repository.UserRepository;
import com.instaswipe.service.ProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.instaswipe.dto.OwnProfileResponse;
import com.instaswipe.dto.PublicProfileResponse;

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

    @PutMapping(value = "/update", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<String> updateProfile(
            @AuthenticationPrincipal String userId,
            @Valid @ModelAttribute ProfileUpdateRequest request) {

        profileService.updateProfile(userId, request);
        return ResponseEntity.ok("Profile updated successfully.");
    }

    @PostMapping(value = "/picture", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ProfilePictureResponse> uploadProfilePicture(
            @AuthenticationPrincipal String userId,
            @RequestParam("file") MultipartFile file) {

        String url = profileService.updateProfilePicture(userId, file);
        return ResponseEntity.ok(new ProfilePictureResponse(url));
    }

    @GetMapping("/me")
    public ResponseEntity<OwnProfileResponse> getOwnProfile(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(profileService.getOwnProfile(userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PublicProfileResponse> getPublicProfile(
            @AuthenticationPrincipal String requesterId,
            @PathVariable("id") String targetUserId) {
        return ResponseEntity.ok(profileService.getPublicProfile(requesterId, targetUserId));
    }
}
