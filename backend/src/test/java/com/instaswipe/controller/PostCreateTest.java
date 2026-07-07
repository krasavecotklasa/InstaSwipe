package com.instaswipe.controller;

import com.instaswipe.config.RabbitMQConfig;
import com.instaswipe.dto.PostResponse;
import com.instaswipe.event.ImageProcessingEvent;
import com.instaswipe.event.ImageTarget;
import com.instaswipe.model.Gender;
import com.instaswipe.model.MediaStatus;
import com.instaswipe.model.User;
import com.instaswipe.repository.PostRepository;
import com.instaswipe.service.MediaStorageService;
import com.instaswipe.support.AbstractWebIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.util.MultiValueMap;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * End-to-end coverage of the unified POST /api/posts endpoint under the async
 * pipeline: text-only, image-only, image+caption, the empty-post guard, and auth.
 * Image posts store a PROCESSING placeholder and queue finalization. S3 and RabbitMQ
 * are mocked; validation runs for real against the generated JPEG.
 */
class PostCreateTest extends AbstractWebIntegrationTest {

    private static final String RAW_KEY = "author/tmp/raw.jpg";
    private static final String PREVIEW_URL = "https://cdn.test/tmp/raw.jpg";

    @Autowired
    private PostRepository postRepository;

    @MockitoBean
    private MediaStorageService mediaStorageService;

    @MockitoBean
    private RabbitTemplate rabbitTemplate;

    @BeforeEach
    void setUp() {
        postRepository.deleteAll();
        when(mediaStorageService.upload(any(), any(), any(), any(), any())).thenReturn(RAW_KEY);
        when(mediaStorageService.publicUrl(any())).thenReturn(PREVIEW_URL);
        // Presigning is exercised elsewhere; here treat it as identity so we can assert the URL.
        when(mediaStorageService.ensurePresignedUrl(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private User author() {
        return createDiscoverableUser("author@x.com", Gender.MALE, "US",
                LocalDate.now().minusYears(25), List.of("music"));
    }

    private static Resource jpegPart() {
        return new ByteArrayResource(jpegBytes()) {
            @Override
            public String getFilename() {
                return "photo.jpg";
            }
        };
    }

    private ResponseEntity<PostResponse> create(String token, MultiValueMap<String, ?> body) {
        return client(token).post().uri("/api/posts")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body)
                .retrieve().toEntity(PostResponse.class);
    }

    @Test
    void createsTextOnlyPost() {
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("caption", "just words");

        ResponseEntity<PostResponse> response = create(tokenFor(author()), body.build());

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody().caption()).isEqualTo("just words");
        assertThat(response.getBody().media()).isNull();
        assertThat(response.getBody().likeCount()).isZero();
    }

    @Test
    void createsImageOnlyPostAsPendingAndQueues() {
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("file", jpegPart()).contentType(MediaType.IMAGE_JPEG);

        ResponseEntity<PostResponse> response = create(tokenFor(author()), body.build());

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody().media()).isNotNull();
        assertThat(response.getBody().media().getUrl()).isEqualTo(PREVIEW_URL);
        assertThat(response.getBody().media().getStatus()).isEqualTo(MediaStatus.PROCESSING);

        // Finalization event published for the POST target, carrying the new post's id
        ArgumentCaptor<ImageProcessingEvent> event = ArgumentCaptor.forClass(ImageProcessingEvent.class);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitMQConfig.IMAGE_EXCHANGE), eq(RabbitMQConfig.IMAGE_ROUTING), (Object) event.capture());
        assertThat(event.getValue().target()).isEqualTo(ImageTarget.POST);
        assertThat(event.getValue().entityId()).isEqualTo(response.getBody().id());
        assertThat(event.getValue().rawKey()).isEqualTo(RAW_KEY);
    }

    @Test
    void createsImageWithCaption() {
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("caption", "look at this");
        body.part("file", jpegPart()).contentType(MediaType.IMAGE_JPEG);

        ResponseEntity<PostResponse> response = create(tokenFor(author()), body.build());

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getBody().caption()).isEqualTo("look at this");
        assertThat(response.getBody().media().getUrl()).isEqualTo(PREVIEW_URL);
        assertThat(response.getBody().media().getStatus()).isEqualTo(MediaStatus.PROCESSING);
    }

    @Test
    void rejectsEmptyPost() {
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("caption", "   "); // blank caption, no file

        ResponseEntity<Void> response = client(tokenFor(author())).post().uri("/api/posts")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body.build())
                .retrieve().toBodilessEntity();

        assertThat(response.getStatusCode().value()).isEqualTo(400);
    }

    @Test
    void anonymousIsRejected() {
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("caption", "hi");

        ResponseEntity<Void> response = client().post().uri("/api/posts")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(body.build())
                .retrieve().toBodilessEntity();

        assertThat(response.getStatusCode().value()).isIn(401, 403);
    }
}
