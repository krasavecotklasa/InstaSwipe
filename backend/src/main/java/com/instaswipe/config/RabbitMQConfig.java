package com.instaswipe.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

    public static final String PUSH_QUEUE    = "offline.push.queue";
    public static final String PUSH_EXCHANGE = "offline.push.exchange";
    public static final String PUSH_ROUTING  = "push.message";

    public static final String IMAGE_QUEUE        = "image.processing.queue";
    public static final String IMAGE_EXCHANGE     = "image.processing.exchange";
    public static final String IMAGE_ROUTING      = "image.process";
    public static final String IMAGE_DLQ          = "image.processing.dlq";
    public static final String IMAGE_DLX          = "image.processing.dlx";
    public static final String IMAGE_DEAD_ROUTING = "image.process.dead";

    // --- Offline push infrastructure ---

    @Bean
    public Queue offlinePushQueue() {
        return QueueBuilder.durable(PUSH_QUEUE).build();
    }

    @Bean
    public DirectExchange offlinePushExchange() {
        return new DirectExchange(PUSH_EXCHANGE);
    }

    @Bean
    public Binding offlinePushBinding(Queue offlinePushQueue, DirectExchange offlinePushExchange) {
        return BindingBuilder.bind(offlinePushQueue).to(offlinePushExchange).with(PUSH_ROUTING);
    }

    // --- Image processing infrastructure (main queue dead-letters failures to a DLQ) ---

    @Bean
    public Queue imageProcessingQueue() {
        return QueueBuilder.durable(IMAGE_QUEUE)
                .deadLetterExchange(IMAGE_DLX)
                .deadLetterRoutingKey(IMAGE_DEAD_ROUTING)
                .build();
    }

    @Bean
    public DirectExchange imageProcessingExchange() {
        return new DirectExchange(IMAGE_EXCHANGE);
    }

    @Bean
    public Binding imageProcessingBinding(Queue imageProcessingQueue, DirectExchange imageProcessingExchange) {
        return BindingBuilder.bind(imageProcessingQueue).to(imageProcessingExchange).with(IMAGE_ROUTING);
    }

    @Bean
    public DirectExchange imageProcessingDlx() {
        return new DirectExchange(IMAGE_DLX);
    }

    @Bean
    public Queue imageProcessingDlq() {
        return QueueBuilder.durable(IMAGE_DLQ).build();
    }

    @Bean
    public Binding imageProcessingDlqBinding(Queue imageProcessingDlq, DirectExchange imageProcessingDlx) {
        return BindingBuilder.bind(imageProcessingDlq).to(imageProcessingDlx).with(IMAGE_DEAD_ROUTING);
    }

    // --- JSON Message Converter ---

    @SuppressWarnings("deprecation")
    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    // --- RabbitTemplate (used by ChatController to publish) ---

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter());
        return template;
    }

    // --- Listener Container Factory (used by @RabbitListener in PushNotificationService) ---

    // Default factory (used by the offline push listener): keeps Spring's default requeue
    // behavior. The push queue has no DLQ, so dropping-on-reject here would silently lose
    // messages on transient errors.
    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(jsonMessageConverter());
        return factory;
    }

    // Dedicated factory for the image processing listener: on a listener exception, reject
    // without requeue so a poison message dead-letters to the image DLQ instead of hot-looping.
    // Scoped here so it does not affect the offline push listener.
    @Bean
    public SimpleRabbitListenerContainerFactory imageListenerContainerFactory(ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(jsonMessageConverter());
        factory.setDefaultRequeueRejected(false);
        return factory;
    }
}
