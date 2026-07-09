// Canonical interest options for the profile form. The backend requires between
// MIN and MAX selections (see ProfileUpdateRequest), each at most 30 characters.
export const MIN_INTERESTS = 3;
export const MAX_INTERESTS = 20;

export const INTEREST_OPTIONS: string[] = [
  'Travel', 'Music', 'Movies', 'Reading', 'Cooking', 'Fitness', 'Gaming', 'Photography',
  'Art', 'Dancing', 'Hiking', 'Camping', 'Yoga', 'Running', 'Cycling', 'Swimming',
  'Football', 'Basketball', 'Tennis', 'Coffee', 'Wine', 'Foodie', 'Fashion', 'Technology',
  'Science', 'History', 'Nature', 'Animals', 'Volunteering', 'Meditation', 'Writing',
  'Podcasts', 'Board Games', 'Gardening', 'Astronomy', 'Fishing',
];
