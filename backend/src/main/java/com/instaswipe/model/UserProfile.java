package com.instaswipe.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfile {

    private String name;
    private String bio;
    private Gender gender;
    private String country;
    private LocalDate birthDate;
    private List<String> interests;
    private String profilePictureUrl;
}
