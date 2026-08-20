export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return {
      url: "data:text/javascript,export const env=globalThis.process.env",
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
