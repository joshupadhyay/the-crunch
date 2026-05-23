import { loadRuntimeSecrets } from "./config/secrets";

await loadRuntimeSecrets();
await import("./observability");
const { server } = await import("./server");
console.log(`Server running at ${server.url}`);
