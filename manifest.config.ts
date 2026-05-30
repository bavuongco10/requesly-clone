import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Requestly Clone",
  version: "0.1.0",
  description: "Intercept and modify network requests via user-managed rules.",
  permissions: [
    "declarativeNetRequest",
    "declarativeNetRequestFeedback",
    "storage",
    "scripting",
    "tabs",
  ],
  host_permissions: ["<all_urls>"],
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  action: {
    default_popup: "src/popup/index.html",
    default_title: "Requestly Clone",
  },
  options_page: "src/options/index.html",
});
