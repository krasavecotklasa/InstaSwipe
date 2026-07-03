package com.instaswipe.service;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Set;

import javax.imageio.ImageIO;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;

import com.instaswipe.exception.InvalidRequestException;

import net.coobird.thumbnailator.Thumbnails;

/**
 * Validates that an upload is a real image, then downscales it to a maximum
 * dimension and re-encodes it as compressed JPEG. All uploads are normalised to
 * JPEG regardless of the input format.
 */
@Service
public class ImageProcessingService {

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of("image/jpeg", "image/jpg", "image/png");
    private static final String OUTPUT_CONTENT_TYPE = "image/jpeg";
    private static final String OUTPUT_EXTENSION = ".jpg";

    private final int maxDimension;
    private final double jpegQuality;
    private final long maxBytes;

    public ImageProcessingService(
            @Value("${media.max-dimension:1080}") int maxDimension,
            @Value("${media.jpeg-quality:0.82}") double jpegQuality,
            @Value("${media.max-image-size:10MB}") String maxImageSize) {
        this.maxDimension = maxDimension;
        this.jpegQuality = jpegQuality;
        this.maxBytes = DataSize.parse(maxImageSize).toBytes();
    }

    public ProcessedImage process(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new InvalidRequestException("An image file is required");
        }
        if (file.getSize() > maxBytes) {
            throw new InvalidRequestException("Image exceeds the maximum allowed size");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new InvalidRequestException("Unsupported image type; allowed types: JPEG, PNG");
        }

        try {
            // Decoding is also the real content check: a spoofed content-type over
            // non-image bytes yields null here rather than a corrupt post.
            BufferedImage source = ImageIO.read(new ByteArrayInputStream(file.getBytes()));
            if (source == null) {
                throw new InvalidRequestException("File is not a valid image");
            }

            int longestSide = Math.max(source.getWidth(), source.getHeight());
            double scale = Math.min(1.0, (double) maxDimension / longestSide); // never upscale

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            Thumbnails.of(source)
                    .scale(scale)
                    .outputFormat("jpg")
                    .outputQuality(jpegQuality)
                    .toOutputStream(out);

            return new ProcessedImage(out.toByteArray(), OUTPUT_CONTENT_TYPE, OUTPUT_EXTENSION);
        } catch (IOException e) {
            throw new InvalidRequestException("Failed to process image");
        }
    }

    public record ProcessedImage(byte[] data, String contentType, String extension) {
    }
}
