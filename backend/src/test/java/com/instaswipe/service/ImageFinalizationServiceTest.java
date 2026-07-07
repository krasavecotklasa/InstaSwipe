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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Worker-side unit test: downloads raw, resizes/re-encodes, attaches the finalized
 * media, and cleans up the raw + replaced objects. All I/O collaborators are mocked.
 */
@ExtendWith(MockitoExtension.class)
class ImageFinalizationServiceTest {

    private static final String RAW_KEY = "u1/tmp/raw.jpg";
    private static final String FINAL_URL = "http://cdn.test/media/u1/profile/new.jpg";

    @Mock private ImageProcessingService imageProcessingService;
    @Mock private MediaStorageService mediaStorageService;
    @Mock private UserRepository userRepository;
    @Mock private PostRepository postRepository;

    @InjectMocks private ImageFinalizationService service;

    private static Media pending() {
        return Media.builder()
                .type(MediaType.IMAGE).url("http://cdn.test/tmp/raw.jpg")
                .filename("pic.jpg").size(3).status(MediaStatus.PROCESSING)
                .build();
    }

    @Test
    void finalizesProfilePictureReplacesOldAndDeletesRaw() {
        String previousKey = "u1/profile/old.jpg";
        ImageProcessingEvent event = new ImageProcessingEvent(RAW_KEY, "u1", ImageTarget.PROFILE, null, previousKey);

        User user = User.builder().id("u1")
                .profile(UserProfile.builder().profilePicture(pending()).build())
                .build();

        when(mediaStorageService.download(RAW_KEY)).thenReturn(new byte[]{1, 2, 3});
        when(imageProcessingService.process(any())).thenReturn(new ProcessedImage(new byte[]{9, 9}, "image/jpeg", ".jpg"));
        when(mediaStorageService.upload(any(), any(), any(), any(), any())).thenReturn("u1/profile/new.jpg");
        when(mediaStorageService.publicUrl("u1/profile/new.jpg")).thenReturn(FINAL_URL);
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));

        service.finalizeImage(event);

        Media finalized = user.getProfile().getProfilePicture();
        assertThat(finalized.getStatus()).isEqualTo(MediaStatus.READY);
        assertThat(finalized.getUrl()).isEqualTo(FINAL_URL);
        assertThat(finalized.getFilename()).isEqualTo("pic.jpg"); // preserved from placeholder
        assertThat(finalized.getSize()).isEqualTo(2);
        verify(userRepository).save(user);
        verify(mediaStorageService).delete(RAW_KEY);
        verify(mediaStorageService).delete(previousKey);
    }

    @Test
    void finalizesPostImage() {
        ImageProcessingEvent event = new ImageProcessingEvent(RAW_KEY, "u1", ImageTarget.POST, "post1", null);

        Post post = Post.builder().id("post1").userId("u1").media(pending()).build();

        when(mediaStorageService.download(RAW_KEY)).thenReturn(new byte[]{1});
        when(imageProcessingService.process(any())).thenReturn(new ProcessedImage(new byte[]{9}, "image/jpeg", ".jpg"));
        when(mediaStorageService.upload(any(), any(), any(), any(), any())).thenReturn("u1/posts/new.jpg");
        when(mediaStorageService.publicUrl("u1/posts/new.jpg")).thenReturn("http://cdn.test/media/u1/posts/new.jpg");
        when(postRepository.findById("post1")).thenReturn(Optional.of(post));

        service.finalizeImage(event);

        assertThat(post.getMedia().getStatus()).isEqualTo(MediaStatus.READY);
        assertThat(post.getMedia().getUrl()).isEqualTo("http://cdn.test/media/u1/posts/new.jpg");
        verify(postRepository).save(post);
        verify(mediaStorageService).delete(RAW_KEY);
    }

    @Test
    void unprocessableImageIsMarkedFailedRawDroppedAndNotUploaded() {
        ImageProcessingEvent event = new ImageProcessingEvent(RAW_KEY, "u1", ImageTarget.PROFILE, null, null);

        User user = User.builder().id("u1")
                .profile(UserProfile.builder().profilePicture(pending()).build())
                .build();

        when(mediaStorageService.download(RAW_KEY)).thenReturn(new byte[]{0});
        when(imageProcessingService.process(any())).thenThrow(new InvalidRequestException("not an image"));
        when(userRepository.findById("u1")).thenReturn(Optional.of(user));

        service.finalizeImage(event);

        assertThat(user.getProfile().getProfilePicture().getStatus()).isEqualTo(MediaStatus.FAILED);
        verify(userRepository).save(user);
        verify(mediaStorageService).delete(RAW_KEY);
        verify(mediaStorageService, never()).upload(any(), any(), any(), any(), any());
        verify(mediaStorageService, never()).publicUrl(any());
    }
}
