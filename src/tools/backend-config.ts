/**
 * Backend URL configuration
 * Centralized logic for determining which backend URL to use
 */

// Switch between "test" and "prod" to change the backend URL
// Change this value to switch environments
const ENVIRONMENT = "test" as "test" | "prod";

export const getBackendUrl = (): string => {
  // Use environment variable if set, otherwise use the ENVIRONMENT constant
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl;
  }

  return ENVIRONMENT === "test"
    ? "http://localhost:5000"
    : "https://api.usesolari.ai";
};
