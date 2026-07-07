package com.instaswipe.service;

import com.instaswipe.config.RabbitMQConfig;
import com.instaswipe.event.ImageProcessingEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Service;

/**
 * Consumes {@link ImageProcessingEvent}s off the image queue and hands them to
 * {@link ImageFinalizationService}. The queue/exchange/binding (and its dead-letter
 * routing) are declared as beans in {@link RabbitMQConfig}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ImageProcessingConsumer {

    private final ImageFinalizationService imageFinalizationService;

    @RabbitListener(queues = RabbitMQConfig.IMAGE_QUEUE)
    public void onImageProcessing(ImageProcessingEvent event) {
        log.info("Received image processing event: target={} user={} rawKey={}",
                event.target(), event.userId(), event.rawKey());
        imageFinalizationService.finalizeImage(event);
    }
}
