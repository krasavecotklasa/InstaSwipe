package com.instaswipe.service;

import com.instaswipe.dto.OnboardingStatusResponse;
import com.instaswipe.dto.OwnProfileResponse;
import com.instaswipe.dto.ProfileUpdateRequest;
import com.instaswipe.dto.PublicProfileResponse;
import com.instaswipe.model.User;
import com.instaswipe.model.UserProfile;
import com.instaswipe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.Period;

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

    public OwnProfileResponse getOwnProfile(String userId) {
        User user = getUserOrThrow(userId);
        UserProfile profile = user.getProfile();

        if (profile == null) {
            throw new IllegalArgumentException("Profile has not been set up yet.");
        }

        return new OwnProfileResponse(
                user.getEmail(),
                profile.getName(),
                profile.getBio(),
                profile.getBirthDate(),
                profile.getCountry(),
                profile.getGender(),
                profile.getInterests(),
                profile.getProfilePictureUrl()
        );
    }

    public PublicProfileResponse getPublicProfile(String requesterId, String targetUserId) {
        User targetUser = getUserOrThrow(targetUserId);
        UserProfile profile = targetUser.getProfile();

        boolean self = targetUser.getId().equals(requesterId);
        // Only expose enabled, fully-onboarded (discoverable) profiles to other users. A uniform
        // "not found" for missing / banned / incomplete targets avoids leaking who exists.
        if (profile == null || (!self && (!targetUser.isEnabled() || !isDiscoverable(profile)))) {
            throw new IllegalArgumentException("Profile not available");
        }

        // Calculate age dynamically from birthdate (the raw birth date is never exposed publicly)
        int age = 0;
        if (profile.getBirthDate() != null) {
            age = Period.between(profile.getBirthDate(), LocalDate.now()).getYears();
        }

        return new PublicProfileResponse(
                targetUser.getId(),
                profile.getName(),
                profile.getBio(),
                age,
                profile.getCountry(),
                profile.getGender(),
                profile.getInterests(),
                profile.getProfilePictureUrl()
        );
    }

    private boolean isDiscoverable(UserProfile profile) {
        return profile != null
                && profile.getName() != null
                && profile.getBirthDate() != null
                && profile.getGender() != null
                && profile.getProfilePictureUrl() != null;
    }

    private User getUserOrThrow(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }
}
