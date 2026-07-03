package com.instaswipe.service;

import com.instaswipe.model.Media;
import com.instaswipe.model.MediaType;
import com.instaswipe.service.ImageProcessingService.ProcessedImage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Validates + compresses an uploaded image, stores it in object storage, and
 * returns a populated {@link Media}. Shared by post creation and profile
 * pictures so the upload pipeline lives in one place.
 */
@Service
@RequiredArgsConstructor
public class MediaUploadService {

    private final ImageProcessingService imageProcessingService;
    private final MediaStorageService mediaStorageService;

    public Media storeImage(MultipartFile file, String userId) {
        ProcessedImage image = imageProcessingService.process(file);
        String url = mediaStorageService.upload(image.data(), image.contentType(), image.extension(), userId);

        return Media.builder()
                .type(MediaType.IMAGE)
                .url(url)
                .filename(file.getOriginalFilename())
                .size(image.data().length)
                .build();
    }
}
