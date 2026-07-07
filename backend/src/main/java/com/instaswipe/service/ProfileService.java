package com.instaswipe.service;

import com.instaswipe.dto.OnboardingStatusResponse;
import com.instaswipe.dto.OwnProfileResponse;
import com.instaswipe.dto.ProfileUpdateRequest;
import com.instaswipe.dto.PublicProfileResponse;
import com.instaswipe.event.ImageTarget;
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
    private final MediaStorageService mediaStorageService;

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
        // A new picture is accepted (raw stored + queued) and only enqueued after the save.
        MediaUploadService.AcceptedImage accepted = null;
        String previousKey = null;
        MultipartFile picture = request.profilePicture();
        if (picture != null && !picture.isEmpty()) {
            previousKey = currentPictureKey(profile);
            accepted = mediaUploadService.accept(picture, userId);
            profile.setProfilePicture(accepted.pendingMedia());
        }

        user.setProfile(profile);
        userRepository.save(user);

        if (accepted != null) {
            mediaUploadService.enqueue(accepted.rawKey(), userId, ImageTarget.PROFILE, null, previousKey);
        }
    }

    /**
     * Accepts a new profile picture: stores the raw bytes, persists a PROCESSING
     * placeholder on the profile, and queues the resize/finalize work. Returns the
     * pending {@link Media} (raw preview URL + PROCESSING status).
     */
    public Media updateProfilePicture(String userId, MultipartFile file) {
        User user = getUserOrThrow(userId);

        UserProfile profile = user.getProfile();
        if (profile == null) {
            profile = new UserProfile();
        }
        String previousKey = currentPictureKey(profile);

        MediaUploadService.AcceptedImage accepted = mediaUploadService.accept(file, userId);
        profile.setProfilePicture(accepted.pendingMedia());

        user.setProfile(profile);
        userRepository.save(user);

        mediaUploadService.enqueue(accepted.rawKey(), userId, ImageTarget.PROFILE, null, previousKey);
        return accepted.pendingMedia();
    }

    /** Object key of the profile's current picture, or null if there isn't one. */
    private String currentPictureKey(UserProfile profile) {
        if (profile.getProfilePicture() == null) {
            return null;
        }
        return mediaStorageService.extractKeyFromUrl(profile.getProfilePicture().getUrl());
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
        if (profile.getProfilePicture() == null) {
            return null;
        }
        // Ensure the URL is converted to presigned URL
        return mediaStorageService.ensurePresignedUrl(profile.getProfilePicture().getUrl());
    }

    private User getUserOrThrow(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }
}
