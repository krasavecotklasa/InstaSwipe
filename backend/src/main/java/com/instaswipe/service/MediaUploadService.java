package com.instaswipe.service;

import com.instaswipe.config.RabbitMQConfig;
import com.instaswipe.event.ImageProcessingEvent;
import com.instaswipe.event.ImageTarget;
import com.instaswipe.exception.InvalidRequestException;
import com.instaswipe.model.Media;
import com.instaswipe.model.MediaStatus;
import com.instaswipe.model.MediaType;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * Producer side of the image pipeline. Cheaply validates an upload, stores the
 * raw bytes under {@code <userId>/tmp/...}, and hands the heavy resize/re-encode
 * work to the processing queue. Shared by post creation and profile pictures.
 *
 * <p>Callers persist the returned {@link Media} (in {@link MediaStatus#PROCESSING})
 * on its owning entity and only then call {@link #enqueue}, so the worker never
 * races the initial save.
 */
@Service
@RequiredArgsConstructor
public class MediaUploadService {

    private static final String RAW_FOLDER = "tmp";

    private final ImageProcessingService imageProcessingService;
    private final MediaStorageService mediaStorageService;
    private final RabbitTemplate rabbitTemplate;

    /** A stored raw upload plus the pending Media that represents it. */
    public record AcceptedImage(Media pendingMedia, String rawKey) {
    }

    /**
     * Validates and stores the raw bytes. Does not publish; the caller persists
     * {@link AcceptedImage#pendingMedia()} first, then calls {@link #enqueue}.
     */
    public AcceptedImage accept(MultipartFile file, String userId) {
        imageProcessingService.validateBasics(file);

        byte[] rawBytes;
        try {
            rawBytes = file.getBytes();
        } catch (IOException e) {
            throw new InvalidRequestException("Failed to read uploaded file");
        }

        String rawKey = mediaStorageService.upload(
                rawBytes, file.getContentType(), rawExtension(file.getContentType()), userId, RAW_FOLDER);

        Media pending = Media.builder()
                .type(MediaType.IMAGE)
                .url(mediaStorageService.publicUrl(rawKey))
                .filename(file.getOriginalFilename())
                .size(rawBytes.length)
                .status(MediaStatus.PROCESSING)
                .build();

        return new AcceptedImage(pending, rawKey);
    }

    /**
     * Publishes the processing event for an already-persisted pending upload.
     * {@code previousKey} is the object this upload replaces (deleted after finalize);
     * pass {@code null} when there is nothing to replace.
     */
    public void enqueue(String rawKey, String userId, ImageTarget target, String entityId, String previousKey) {
        rabbitTemplate.convertAndSend(
                RabbitMQConfig.IMAGE_EXCHANGE,
                RabbitMQConfig.IMAGE_ROUTING,
                new ImageProcessingEvent(rawKey, userId, target, entityId, previousKey));
    }

    private static String rawExtension(String contentType) {
        return "image/png".equalsIgnoreCase(contentType) ? ".png" : ".jpg";
    }
}
