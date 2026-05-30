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
  icons: {
    16: "src/icons/icon16.png",
    32: "src/icons/icon32.png",
    48: "src/icons/icon48.png",
    128: "src/icons/icon128.png",
  },
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  action: {
    default_popup: "src/popup/index.html",
    default_title: "Requestly Clone",
    default_icon: {
      16: "src/icons/icon16.png",
      32: "src/icons/icon32.png",
      48: "src/icons/icon48.png",
      128: "src/icons/icon128.png",
    },
  },
  options_page: "src/options/index.html",
});
