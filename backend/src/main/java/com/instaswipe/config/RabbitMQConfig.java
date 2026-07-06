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

    // --- Infrastructure Beans ---

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

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(jsonMessageConverter());
        return factory;
    }
}
