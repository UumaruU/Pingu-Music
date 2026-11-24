import { apiClient } from "./apiClient";
import {
  AdminRequestOptions,
  createAdminObservatoryClient,
} from "./adminObservatoryClient";
import { adminTokenService } from "./adminTokenService";

export const adminObservatoryService = createAdminObservatoryClient(
  <T>(endpoint: string, options: AdminRequestOptions) => apiClient.request<T>(endpoint, options),
  () => adminTokenService.getToken(),
);
