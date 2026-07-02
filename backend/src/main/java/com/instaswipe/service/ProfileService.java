package com.instaswipe.service;

import com.instaswipe.dto.OnboardingStatusResponse;
import com.instaswipe.dto.ProfileUpdateRequest;
import com.instaswipe.model.User;
import com.instaswipe.model.UserProfile;
import com.instaswipe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;

    public OnboardingStatusResponse getStatus(String userId) {
        User user = getUserOrThrow(userId);

        // If profile is null or specific mandatory fields are missing, they need onboarding
        boolean needsOnboarding = (
                    user.getProfile() == null ||
                    user.getProfile().getName() == null ||
                    user.getProfile().getBio() == null ||
                    user.getProfile().getBirthDate() == null ||
                    user.getProfile().getGender() == null ||
                    user.getProfile().getCountry() == null ||
                    user.getProfile().getProfilePictureUrl() == null
        );

        return new OnboardingStatusResponse(
                user.getEmail(),
                needsOnboarding,
                user.isEmailVerified()
        );
    }

    public void updateProfile(String userId, ProfileUpdateRequest request) {
        User user = getUserOrThrow(userId);

        // Get existing profile or initialize a new skeleton
        UserProfile profile = user.getProfile();
        if (profile == null) {
            profile = new UserProfile();
        }

        // Map the fields from the incoming DTO to the embedded document
        profile.setName(request.displayName());
        profile.setBio(request.bio());
        profile.setCountry(request.country());
        profile.setBirthDate(request.birthDate());
        profile.setGender(request.gender());
        profile.setInterests(request.interests());
        profile.setProfilePictureUrl(request.profilePictureUrl());

        user.setProfile(profile);
        userRepository.save(user);
    }

    private User getUserOrThrow(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found with email: " + userId));
    }
}
