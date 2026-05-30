export const IMAGE_ONLY_COMMENT_BODY = "(Vedhæftede billeder)";

export const IMAGE_ONLY_COMMENT_BODY_EMAIL =
  "(Vedhæftede billeder — se vedhæftninger på sagen)";

export function isImageOnlyCommentBody(body: string): boolean {
  const trimmed = body.trim();
  return (
    trimmed === IMAGE_ONLY_COMMENT_BODY ||
    trimmed === IMAGE_ONLY_COMMENT_BODY_EMAIL
  );
}
