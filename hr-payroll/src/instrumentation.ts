export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { preferIpv4 } = await import("./lib/prefer-ipv4");
  preferIpv4();
  const { bootstrapDatabase } = await import("./lib/bootstrap");
  try {
    await bootstrapDatabase();
  } catch (e) {
    console.error("✖ bootstrap:", e);
  }
}
