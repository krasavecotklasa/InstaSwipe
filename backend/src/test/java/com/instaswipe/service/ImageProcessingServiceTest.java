package com.instaswipe.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import javax.imageio.ImageIO;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import com.instaswipe.exception.InvalidRequestException;
import com.instaswipe.service.ImageProcessingService.ProcessedImage;

/**
 * Pure unit test (no Spring context, no Testcontainers) covering image validation,
 * downscaling, and JPEG re-encoding.
 */
class ImageProcessingServiceTest {

    private final ImageProcessingService service =
            new ImageProcessingService(1080, 0.82, "10MB");

    @Test
    void downscalesImagesLargerThanMaxDimension() throws IOException {
        byte[] input = image(2000, 1500, "png", false);

        ProcessedImage result = service.process(
                new MockMultipartFile("file", "big.png", "image/png", input));

        assertThat(result.contentType()).isEqualTo("image/jpeg");
        assertThat(result.extension()).isEqualTo(".jpg");
        BufferedImage decoded = decode(result.data());
        assertThat(Math.max(decoded.getWidth(), decoded.getHeight())).isEqualTo(1080);
        // aspect ratio preserved: 2000x1500 -> 1080x810
        assertThat(decoded.getWidth()).isEqualTo(1080);
        assertThat(decoded.getHeight()).isEqualTo(810);
    }

    @Test
    void doesNotUpscaleSmallImages() throws IOException {
        byte[] input = image(400, 300, "jpg", false);

        ProcessedImage result = service.process(
                new MockMultipartFile("file", "small.jpg", "image/jpeg", input));

        BufferedImage decoded = decode(result.data());
        assertThat(decoded.getWidth()).isEqualTo(400);
        assertThat(decoded.getHeight()).isEqualTo(300);
    }

    @Test
    void acceptsPngWithAlphaAndProducesValidJpeg() throws IOException {
        byte[] input = image(500, 500, "png", true);

        ProcessedImage result = service.process(
                new MockMultipartFile("file", "alpha.png", "image/png", input));

        assertThat(decode(result.data())).isNotNull();
    }

    @Test
    void rejectsNonImageContentType() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "note.txt", "text/plain", "hello".getBytes());

        assertThatThrownBy(() -> service.process(file))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void rejectsBytesThatAreNotADecodableImage() {
        // content-type claims PNG, but the bytes are not an image
        MockMultipartFile file = new MockMultipartFile(
                "file", "fake.png", "image/png", "not really a png".getBytes());

        assertThatThrownBy(() -> service.process(file))
                .isInstanceOf(InvalidRequestException.class);
    }

    @Test
    void rejectsFilesOverTheSizeLimit() throws IOException {
        ImageProcessingService tinyLimit =
                new ImageProcessingService(1080, 0.82, "1KB");
        byte[] input = image(800, 800, "png", false);

        MockMultipartFile file = new MockMultipartFile("file", "big.png", "image/png", input);

        assertThatThrownBy(() -> tinyLimit.process(file))
                .isInstanceOf(InvalidRequestException.class);
    }

    private static byte[] image(int width, int height, String format, boolean withAlpha) throws IOException {
        int type = withAlpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;
        BufferedImage img = new BufferedImage(width, height, type);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(30, 144, 255, withAlpha ? 128 : 255));
        g.fillRect(0, 0, width, height);
        g.dispose();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, format, out);
        return out.toByteArray();
    }

    private static BufferedImage decode(byte[] data) throws IOException {
        return ImageIO.read(new ByteArrayInputStream(data));
    }
}
