package com.instaswipe.dto;

import com.instaswipe.model.Gender;

import java.time.LocalDate;
import java.util.List;

public record UserSearchCriteria(
        LocalDate birthDateFrom,
        LocalDate birthDateTo,
        Gender gender,
        String country,
        List<String> interests,
        List<String> excludeUserIds
) {
}
