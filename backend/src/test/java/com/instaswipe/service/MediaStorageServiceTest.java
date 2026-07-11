package com.instaswipe.service;

import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Unit coverage of {@link MediaStorageService#ensurePresignedUrl(String)} for the
 * public-bucket path. A stored URL bakes in whatever host was configured when the
 * object was uploaded; the read path must serve it from the CURRENT public endpoint
 * so a container-only host (e.g. host.docker.internal) never leaks to browsers.
 */
class MediaStorageServiceTest {

    private final S3Client s3Client = mock(S3Client.class);
    private final S3Presigner s3Presigner = mock(S3Presigner.class);

    private MediaStorageService publicBucketService(String publicEndpoint) {
        return new MediaStorageService(s3Client, s3Presigner, "media", publicEndpoint, 60, true);
    }

    @Test
    void rewritesStaleHostToCurrentPublicEndpoint() {
        MediaStorageService service = publicBucketService("http://localhost:9000");

        String result = service.ensurePresignedUrl(
                "http://host.docker.internal:9000/media/user1/posts/abc.jpg");

        assertThat(result).isEqualTo("http://localhost:9000/media/user1/posts/abc.jpg");
        verifyNoInteractions(s3Presigner); // public bucket serves unsigned; no presign needed
    }

    @Test
    void leavesForeignUrlUnchanged() {
        MediaStorageService service = publicBucketService("http://localhost:9000");

        String result = service.ensurePresignedUrl("https://example.com/pic.jpg");

        assertThat(result).isEqualTo("https://example.com/pic.jpg");
    }

    @Test
    void doesNotRewriteWhenBucketNameOnlyAppearsInHost() {
        MediaStorageService service = publicBucketService("http://localhost:9000");

        String result = service.ensurePresignedUrl("https://media.cdn.example.com/pic.jpg");

        assertThat(result).isEqualTo("https://media.cdn.example.com/pic.jpg");
    }

    @Test
    void nullUrlStaysNull() {
        assertThat(publicBucketService("http://localhost:9000").ensurePresignedUrl(null)).isNull();
    }

    @Test
    void doesNotDuplicatePathWhenHostAlsoStartsWithBucketName() {
        // Regression: a public endpoint host of "media.instaswipe.app" also contains the
        // bucket name "media", so a naive indexOf(bucket) matches inside the host instead
        // of the real "/media/" path segment, corrupting the extracted key.
        MediaStorageService service = publicBucketService("https://media.instaswipe.app");
        String storedUrl = "https://media.instaswipe.app/media/user1/profile/abc.jpg";

        String result = service.ensurePresignedUrl(storedUrl);

        assertThat(result).isEqualTo(storedUrl);
    }

    @Test
    void extractKeyFromUrlIgnoresBucketNameInsideHost() {
        MediaStorageService service = publicBucketService("https://media.instaswipe.app");

        String key = service.extractKeyFromUrl("https://media.instaswipe.app/media/user1/profile/abc.jpg");

        assertThat(key).isEqualTo("user1/profile/abc.jpg");
    }
}
