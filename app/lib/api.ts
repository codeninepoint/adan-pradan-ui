const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function parseDetail(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: unknown };
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail
        .map((item) =>
          typeof item === "object" && item && "msg" in item
            ? String((item as { msg: string }).msg)
            : JSON.stringify(item),
        )
        .join("; ");
    }
  } catch {
    /* ignore */
  }
  return res.statusText || "Request failed";
}

export async function api<T>(
  path: string,
  init?: RequestInit & { token?: string; tenantId?: string },
): Promise<T> {
  const { token, tenantId, headers: initHeaders, ...rest } = init ?? {};
  const headers = new Headers(initHeaders);
  if (!headers.has("Content-Type") && rest.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (tenantId) {
    headers.set("X-Tenant-Id", tenantId);
  }

  const res = await fetch(`${API_URL}${path}`, { ...rest, headers });
  if (!res.ok) {
    throw new ApiError(res.status, await parseDetail(res));
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export type RegisterResponse = {
  user_id: string;
  org_id: string;
  tenant_id: string;
  status: string;
  verification_email_sent: boolean;
  dev_otp?: string | null;
};

export type VerifyEmailResponse = {
  user_id: string;
  status: string;
  message: string;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  session_id: string;
  user_id: string;
  principal_id: string;
};

export type RefreshResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  session_id: string;
};

export type MeOrganization = {
  org_id: string;
  name: string;
  org_type: string;
  participation?: string;
  keycloak_realm_ref?: string | null;
  membership_role: string;
  status: string;
};

export type MeTenant = {
  tenant_id: string;
  org_id: string;
  name: string;
  slug: string;
  status: string;
  membership_status: string;
};

export type MeResponse = {
  user_id: string;
  principal_id: string;
  email: string;
  display_name: string;
  status: string;
  is_platform_operator?: boolean;
  organizations: MeOrganization[];
  tenants: MeTenant[];
};

export const authApi = {
  register: (body: {
    email: string;
    password: string;
    display_name: string;
    agreed_to_terms: boolean;
  }) =>
    api<RegisterResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  verifyEmail: (body: { email: string; otp_code: string }) =>
    api<VerifyEmailResponse>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    api<TokenResponse>("/auth/token", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  refresh: (body: { refresh_token: string; session_id: string }) =>
    api<RefreshResponse>("/auth/token/refresh", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: (token: string) =>
    api<MeResponse>("/auth/me", {
      method: "GET",
      token,
    }),

  logout: (token: string) =>
    api<{ message: string }>("/auth/session", {
      method: "DELETE",
      token,
    }),

  passwordResetRequest: (body: { email: string }) =>
    api<{ message: string; dev_reset_token?: string | null }>(
      "/auth/password/reset-request",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),

  passwordReset: (body: { reset_token: string; new_password: string }) =>
    api<{ message: string; sessions_revoked?: number | null }>(
      "/auth/password/reset",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    ),
};

export type ResourceItem = {
  id: string;
  tenant_id: string;
  name: string;
  resource_type: string;
  status: string;
};

export type ListResourcesResponse = {
  items: ResourceItem[];
};

/** Authenticated API call: refreshes access token, sends Bearer + optional X-Tenant-Id. */
export async function apiAuthed<T>(
  path: string,
  opts: {
    ensureAccessToken: (force?: boolean) => Promise<string | null>;
    tenantId?: string | null;
    method?: string;
    body?: unknown;
  },
): Promise<T> {
  const token = await opts.ensureAccessToken();
  if (!token) {
    throw new ApiError(401, "not signed in");
  }
  try {
    return await api<T>(path, {
      method: opts.method ?? "GET",
      token,
      tenantId: opts.tenantId ?? undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    const retried = await opts.ensureAccessToken(true);
    if (!retried) throw err;
    return api<T>(path, {
      method: opts.method ?? "GET",
      token: retried,
      tenantId: opts.tenantId ?? undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  }
}

export const resourcesApi = {
  list: (
    tenantId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<ListResourcesResponse>(`/api/v1/tenants/${tenantId}/resources`, {
      ensureAccessToken,
      tenantId,
      method: "GET",
    }),

  create: (
    tenantId: string,
    body: { name: string; resource_type: string; external_ref?: string | null },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<ResourceItem>(`/api/v1/tenants/${tenantId}/resources`, {
      ensureAccessToken,
      tenantId,
      method: "POST",
      body,
    }),
};

export type RoleItem = {
  role_id: string;
  name: string;
  is_system_role: boolean;
  status: string;
};

export type BindingItem = {
  binding_id: string;
  role_id: string;
  role_name: string;
  status: string;
  granted_at: string;
  expires_at?: string | null;
  justification?: string | null;
};

export type MemberItem = {
  user_id: string;
  principal_id: string;
  email: string;
  display_name: string;
  membership_status: string;
  bindings: BindingItem[];
};

export type GrantBindingResponse = {
  binding_id: string;
  principal_id: string;
  user_id?: string | null;
  role_id: string;
  role: string;
  status: string;
  granted_by: string;
  granted_at: string;
  expires_at?: string | null;
};

export const membersApi = {
  listRoles: (
    tenantId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ items: RoleItem[] }>(`/api/v1/tenants/${tenantId}/roles`, {
      ensureAccessToken,
      tenantId,
      method: "GET",
    }),

  listMembers: (
    tenantId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ items: MemberItem[] }>(`/api/v1/tenants/${tenantId}/members`, {
      ensureAccessToken,
      tenantId,
      method: "GET",
    }),

  grant: (
    tenantId: string,
    roleId: string,
    body: { user_id?: string; principal_id?: string; justification?: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<GrantBindingResponse>(
      `/api/v1/tenants/${tenantId}/roles/${roleId}/bindings`,
      {
        ensureAccessToken,
        tenantId,
        method: "POST",
        body,
      },
    ),

    revoke: (
    tenantId: string,
    roleId: string,
    bindingId: string,
    reason: string | undefined,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ binding_id: string; status: string; revoked_at: string; effective: string }>(
      `/api/v1/tenants/${tenantId}/roles/${roleId}/bindings/${bindingId}`,
      {
        ensureAccessToken,
        tenantId,
        method: "DELETE",
        body: reason ? { reason } : {},
      },
    ),
};

export type OrgRegisterResponse = {
  request_id: string;
  status: string;
  org_id: string;
  estimated_ms: number;
  keycloak_realm_ref?: string | null;
  realm_url?: string | null;
  error_message?: string | null;
};

export type ServiceAccountItem = {
  service_account_id: string;
  principal_id: string;
  name: string;
  description?: string | null;
  status: string;
  key_prefix?: string | null;
};

export type CreateServiceAccountResponse = {
  service_account_id: string;
  principal_id: string;
  name: string;
  api_key: string;
  key_prefix: string;
  key_id: string;
  status: string;
  role_assigned?: string | null;
};

export type VendorEligibilityResponse = {
  eligible: boolean;
  reasons: string[];
  requirements: string[];
};

export type VendorRegisterResponse = {
  vendor_id: string;
  org_id: string;
  status: string;
  verification_id: string;
};

export const orgApi = {
  register: (
    body: {
      name: string;
      slug: string;
      contact_name: string;
      contact_email: string;
      country: string;
    },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<OrgRegisterResponse>("/api/v1/organizations/register", {
      ensureAccessToken,
      method: "POST",
      body,
    }),

  getRegistration: (
    requestId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<OrgRegisterResponse>(`/api/v1/organizations/register/${requestId}`, {
      ensureAccessToken,
      method: "GET",
    }),

  inviteMember: (
    orgId: string,
    body: { email: string; org_role?: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ invite_id: string; email: string; org_role: string; status: string }>(
      `/api/v1/organizations/${orgId}/members`,
      {
        ensureAccessToken,
        method: "POST",
        body,
      },
    ),

  acceptInvite: (
    orgId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{
      invite_id: string;
      email: string;
      org_role: string;
      status: string;
      user_id?: string | null;
    }>(`/api/v1/organizations/${orgId}/members/accept`, {
      ensureAccessToken,
      method: "POST",
    }),
};

export const serviceAccountsApi = {
  list: (
    tenantId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ items: ServiceAccountItem[] }>(
      `/api/v1/tenants/${tenantId}/service-accounts`,
      { ensureAccessToken, tenantId, method: "GET" },
    ),

  create: (
    tenantId: string,
    body: { name: string; description?: string; initial_role?: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<CreateServiceAccountResponse>(
      `/api/v1/tenants/${tenantId}/service-accounts`,
      { ensureAccessToken, tenantId, method: "POST", body },
    ),

  rotate: (
    tenantId: string,
    saId: string,
    reason: string | undefined,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{
      old_key_prefix: string;
      new_api_key: string;
      new_key_prefix: string;
      new_key_id: string;
    }>(`/api/v1/tenants/${tenantId}/service-accounts/${saId}/api-keys/rotate`, {
      ensureAccessToken,
      tenantId,
      method: "POST",
      body: reason ? { reason } : {},
    }),
};

export const vendorApi = {
  eligibility: (
    orgId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorEligibilityResponse>(
      `/api/v1/organizations/${orgId}/vendor-eligibility`,
      { ensureAccessToken, method: "GET" },
    ),

  register: (
    orgId: string,
    body: {
      legal_name: string;
      tax_id: string;
      payout_bank_account: string;
      contact_email: string;
      business_doc_url: string;
    },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorRegisterResponse>(
      `/api/v1/organizations/${orgId}/vendor/register`,
      { ensureAccessToken, method: "POST", body },
    ),

  listVerifications: (ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{
      items: {
        verification_id: string;
        vendor_id: string;
        legal_name: string;
        contact_email: string;
        org_id: string;
        status: string;
        submitted_at: string;
        business_doc_url?: string | null;
      }[];
    }>("/api/v1/admin/vendor-verifications", {
      ensureAccessToken,
      method: "GET",
    }),

  decide: (
    verificationId: string,
    body: { decision: "approved" | "rejected"; notes?: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{
      verification_id: string;
      vendor_id: string;
      status: string;
    }>(`/api/v1/admin/vendor-verifications/${verificationId}/decision`, {
      ensureAccessToken,
      method: "POST",
      body,
    }),

  verification: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{
      vendor_id: string;
      status: string;
      submitted_at: string;
      verification_id?: string | null;
      verification_status?: string | null;
      notes?: string | null;
    }>(`/api/v1/vendors/${vendorId}/verification`, {
      ensureAccessToken,
      method: "GET",
    }),
};

export const tenantMembersApi = {
  invite: (
    tenantId: string,
    body: { user_id: string; role: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{
      membership_id: string;
      tenant_id: string;
      user_id: string;
      role: string;
      status: string;
    }>(`/api/v1/tenants/${tenantId}/members`, {
      ensureAccessToken,
      tenantId,
      method: "POST",
      body,
    }),
};
