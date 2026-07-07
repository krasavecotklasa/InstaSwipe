package com.instaswipe.service;

import com.instaswipe.event.ImageProcessingEvent;
import com.instaswipe.event.ImageTarget;
import com.instaswipe.exception.InvalidRequestException;
import com.instaswipe.model.Media;
import com.instaswipe.model.MediaStatus;
import com.instaswipe.model.MediaType;
import com.instaswipe.model.Post;
import com.instaswipe.model.User;
import com.instaswipe.model.UserProfile;
import com.instaswipe.repository.PostRepository;
import com.instaswipe.repository.UserRepository;
import com.instaswipe.service.ImageProcessingService.ProcessedImage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Worker side of the image pipeline. Downloads a raw upload, resizes/re-encodes it,
 * writes the final object to the target's folder, attaches it to its owning entity,
 * and cleans up the raw temp object and the replaced (previous) object.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ImageFinalizationService {

    private static final String PROFILE_FOLDER = "profile";
    private static final String POSTS_FOLDER = "posts";

    private final ImageProcessingService imageProcessingService;
    private final MediaStorageService mediaStorageService;
    private final UserRepository userRepository;
    private final PostRepository postRepository;

    public void finalizeImage(ImageProcessingEvent event) {
        // Download can fail transiently (S3 unavailable) -> propagate so the message
        // dead-letters and can be inspected/replayed.
        byte[] rawBytes = mediaStorageService.download(event.rawKey());

        ProcessedImage processed;
        try {
            processed = imageProcessingService.process(rawBytes);
        } catch (InvalidRequestException e) {
            // Permanently unprocessable upload (not a decodable image). Record FAILED,
            // drop the raw, and ack — retrying would only fail again.
            log.warn("Discarding unprocessable image for user {} (target {}): {}",
                    event.userId(), event.target(), e.getMessage());
            markFailed(event);
            return;
        }

        String finalKey = mediaStorageService.upload(
                processed.data(), processed.contentType(), processed.extension(),
                event.userId(), folderFor(event.target()));
        String finalUrl = mediaStorageService.publicUrl(finalKey);
        int size = processed.data().length;

        switch (event.target()) {
            case PROFILE -> attachToProfile(event.userId(), finalUrl, size);
            case POST -> attachToPost(event.entityId(), finalUrl, size);
        }

        // Success: remove the raw temp object and the image this upload replaced.
        mediaStorageService.delete(event.rawKey());
        mediaStorageService.delete(event.previousKey());

        log.info("Finalized {} image for user {} -> {}", event.target(), event.userId(), finalKey);
    }

    private void attachToProfile(String userId, String finalUrl, int size) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("User " + userId + " not found for image finalize"));

        UserProfile profile = user.getProfile();
        if (profile == null) {
            profile = new UserProfile();
            user.setProfile(profile);
        }
        profile.setProfilePicture(finalized(profile.getProfilePicture(), finalUrl, size));
        userRepository.save(user);
    }

    private void attachToPost(String postId, String finalUrl, int size) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalStateException("Post " + postId + " not found for image finalize"));

        post.setMedia(finalized(post.getMedia(), finalUrl, size));
        postRepository.save(post);
    }

    /** Builds the READY media, preserving the original filename from the pending placeholder. */
    private Media finalized(Media pending, String finalUrl, int size) {
        return Media.builder()
                .type(MediaType.IMAGE)
                .url(finalUrl)
                .filename(pending != null ? pending.getFilename() : null)
                .size(size)
                .status(MediaStatus.READY)
                .build();
    }

    /** Flags the owning entity's media FAILED (best-effort) and drops the raw upload. */
    private void markFailed(ImageProcessingEvent event) {
        try {
            switch (event.target()) {
                case PROFILE -> userRepository.findById(event.userId()).ifPresent(user -> {
                    UserProfile profile = user.getProfile();
                    if (profile != null && profile.getProfilePicture() != null) {
                        profile.getProfilePicture().setStatus(MediaStatus.FAILED);
                        userRepository.save(user);
                    }
                });
                case POST -> postRepository.findById(event.entityId()).ifPresent(post -> {
                    if (post.getMedia() != null) {
                        post.getMedia().setStatus(MediaStatus.FAILED);
                        postRepository.save(post);
                    }
                });
            }
        } catch (Exception e) {
            log.error("Could not mark media FAILED for user {} (target {})", event.userId(), event.target(), e);
        }
        mediaStorageService.delete(event.rawKey());
    }

    private String folderFor(ImageTarget target) {
        return switch (target) {
            case PROFILE -> PROFILE_FOLDER;
            case POST -> POSTS_FOLDER;
        };
    }
}
