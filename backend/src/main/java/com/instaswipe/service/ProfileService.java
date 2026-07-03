package com.instaswipe.service;

import com.instaswipe.dto.OnboardingStatusResponse;
import com.instaswipe.dto.OwnProfileResponse;
import com.instaswipe.dto.ProfileUpdateRequest;
import com.instaswipe.dto.PublicProfileResponse;
import com.instaswipe.model.Media;
import com.instaswipe.model.User;
import com.instaswipe.model.UserProfile;
import com.instaswipe.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.Period;

@Service
@RequiredArgsConstructor
public class ProfileService {

    private final UserRepository userRepository;
    private final MediaUploadService mediaUploadService;

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
                    user.getProfile().getProfilePicture() == null
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
        // The picture is optional on update; keep the existing one when no file is sent.
        MultipartFile picture = request.profilePicture();
        if (picture != null && !picture.isEmpty()) {
            profile.setProfilePicture(mediaUploadService.storeImage(picture, userId));
        }

        user.setProfile(profile);
        userRepository.save(user);
    }

    /** Uploads a new profile picture, persists it, and returns its public URL. */
    public String updateProfilePicture(String userId, MultipartFile file) {
        User user = getUserOrThrow(userId);
        Media media = mediaUploadService.storeImage(file, userId);

        UserProfile profile = user.getProfile();
        if (profile == null) {
            profile = new UserProfile();
        }
        profile.setProfilePicture(media);

        user.setProfile(profile);
        userRepository.save(user);
        return media.getUrl();
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
                pictureUrl(profile)
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
                pictureUrl(profile)
        );
    }

    private boolean isDiscoverable(UserProfile profile) {
        return profile != null
                && profile.getName() != null
                && profile.getBirthDate() != null
                && profile.getGender() != null
                && profile.getProfilePicture() != null;
    }

    private String pictureUrl(UserProfile profile) {
        return profile.getProfilePicture() == null ? null : profile.getProfilePicture().getUrl();
    }

    private User getUserOrThrow(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }
}
