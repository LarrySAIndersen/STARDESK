import { describe, expect, it } from "vitest";

import {
  IMAGE_ONLY_COMMENT_BODY,
  IMAGE_ONLY_COMMENT_BODY_EMAIL,
  isImageOnlyCommentBody,
} from "./comment-bodies";

describe("isImageOnlyCommentBody", () => {
  it("recognises image-only placeholder bodies", () => {
    expect(isImageOnlyCommentBody(IMAGE_ONLY_COMMENT_BODY)).toBe(true);
    expect(isImageOnlyCommentBody(`  ${IMAGE_ONLY_COMMENT_BODY_EMAIL}  `)).toBe(true);
    expect(isImageOnlyCommentBody("Normal kommentar")).toBe(false);
  });
});
