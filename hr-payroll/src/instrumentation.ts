export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootstrapDatabase } = await import("./lib/bootstrap");
  try {
    await bootstrapDatabase();
  } catch (e) {
    console.error("✖ bootstrap:", e);
  }
}
