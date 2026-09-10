import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.wonderfact.kids",
  appName: "WonderFact Kids",
  webDir: "public",
  server: process.env.CAPACITOR_SERVER_URL
    ? {
        url: process.env.CAPACITOR_SERVER_URL,
        cleartext: true,
      }
    : undefined,
};

export default config;
