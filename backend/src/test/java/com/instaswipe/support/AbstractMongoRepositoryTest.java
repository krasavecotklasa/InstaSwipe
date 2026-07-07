package com.instaswipe.support;

import com.instaswipe.TestcontainersConfiguration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.TestPropertySource;

/**
 * Base for MongoDB repository tests. Provides a live MongoDB via Testcontainers
 * and enables index auto-creation (kept in committed test config because the
 * production application.yaml is gitignored as secrets). MongoAuditingConfig is
 * picked up by component scan, so auditing is active.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = "spring.data.mongodb.auto-index-creation=true")
public abstract class AbstractMongoRepositoryTest {

    @Autowired
    protected MongoTemplate mongoTemplate;
}
