import { loadRuntimeSecrets } from "./config/secrets";

try {
  await loadRuntimeSecrets();
} catch (error) {
  console.error("Failed to load runtime secrets", error);
}

try {
  await import("./observability");
} catch (error) {
  console.error("Failed to start observability", error);
}

const { server } = await import("./server");
console.log(`Server running at ${server.url}`);
