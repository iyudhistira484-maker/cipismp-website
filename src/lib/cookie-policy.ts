/**
 * Preview tertanam lintas situs memerlukan cookie terpartisi. Aktifkan hanya
 * secara eksplisit di lingkungan development HTTPS, tidak pada deployment normal.
 */
export function cookiePolicy(nodeEnv: string | undefined, partitionedPreview: string | undefined) {
  const preview = nodeEnv === "development" && partitionedPreview === "1";
  return {
    httpOnly: true,
    secure: nodeEnv === "production" || preview,
    sameSite: preview ? ("none" as const) : ("lax" as const),
    ...(preview ? { partitioned: true } : {}),
    path: "/",
  };
}
