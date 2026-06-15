// Mirrors the backend ratings module. Reviews are anonymous: stars + text + date.
export interface Review {
  _id: string;
  stars: number;
  comment: string | null;
  createdAt: string;
}

export interface ReviewList {
  reviews: Review[];
  total: number;
}

export interface CreateRatingInput {
  stars: number;
  comment: string | null;
}
