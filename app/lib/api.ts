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
  last_login_at?: string | null;
  mfa_enabled?: boolean;
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
  account_type?: string;
  last_used_at?: string | null;
  expires_at?: string | null;
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

export type VendorSettings = {
  vendor_id: string;
  status: string;
  legal_name: string;
  tax_id: string | null;
  support_email: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  notify_install: boolean;
  notify_payout: boolean;
  default_currency: string;
};

export const vendorApi = {
  forOrg: (orgId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{ vendor_id: string; org_id: string; status: string; legal_name: string }>(
      `/api/v1/organizations/${orgId}/vendor`,
      { ensureAccessToken, method: "GET" },
    ),

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

  settings: (vendorId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<VendorSettings>(`/api/v1/vendors/${vendorId}/settings`, { ensureAccessToken, method: "GET" }),

  updateSettings: (
    vendorId: string,
    body: Partial<Omit<VendorSettings, "vendor_id" | "status" | "legal_name" | "tax_id">>,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorSettings>(`/api/v1/vendors/${vendorId}/settings`, {
      ensureAccessToken,
      method: "PATCH",
      body,
    }),

  supportRequests: (vendorId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{
      requests: { request_id: string; subject: string; message: string; status: string; created_at: string }[];
    }>(`/api/v1/vendors/${vendorId}/support-requests`, { ensureAccessToken, method: "GET" }),

  createSupportRequest: (
    vendorId: string,
    body: { subject: string; message: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ request_id: string; status: string }>(`/api/v1/vendors/${vendorId}/support-requests`, {
      ensureAccessToken,
      method: "POST",
      body,
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

export type CartLine = {
  line_id: string;
  offering_id: string;
  product_id: string;
  product_name: string;
  plan_name: string;
  quantity: number;
  unit_price: number;
  currency: string;
  fulfilment_type: string;
  billing_period: string;
  vendor_id: string;
  vendor_name: string;
};

export type CartResponse = { cart_id: string | null; status: string; lines: CartLine[] };

export type AddressItem = {
  address_id: string;
  label: string;
  contact_name: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
};

export type OrderVendorSummary = {
  vendor_id: string;
  vendor_name: string;
  status: string;
};

export type OrderSummary = {
  order_id: string;
  status: string;
  payment_method: string;
  placed_at: string;
  line_count: number;
  total: number;
  vendors: OrderVendorSummary[];
};

export type OrderLineDetail = {
  line_id: string;
  offering_id?: string;
  product_name: string;
  plan_name: string;
  quantity: number;
  fulfilment_type: string;
  billing_period?: string;
  unit_price: number;
  currency: string;
  status: string;
  vendor_id: string;
  vendor_name: string;
};

export type OrderVendorSlice = {
  vendor_id: string;
  vendor_name: string;
  status: string;
  courier: string;
  tracking_number: string;
  refund_status: string;
  refund_amount: number | null;
  lines: OrderLineDetail[];
};

export type OrderTimelineStep = {
  label: string;
  at: string;
  done: boolean;
};

export type OrderDetail = {
  order_id: string;
  status: string;
  payment_method: string;
  address_id: string | null;
  placed_at: string;
  lines: OrderLineDetail[];
  vendors: OrderVendorSlice[];
  address: AddressItem | null;
  timeline: OrderTimelineStep[];
};

export type CheckoutSession = {
  order_id: string;
  payment_intent_id: string;
  payment_session_id: string;
  merchant_order_id: string;
  amount: number;
  currency: string;
  status: string;
  cf_env: string;
  provider: string;
  cashfree_app_id: string;
  return_url: string;
};

export type OrderPaymentStatus = {
  order_id: string;
  order_status: string;
  payment_status: string;
  payment_session_id: string | null;
  amount: number;
  currency: string;
  provider: string;
  cf_payment_id: string | null;
};

export type CustomerHubChatMessage = {
  kind: string;
  label?: string;
  text: string;
};

export type CustomerHubOrder = {
  id: string;
  order_ref: string;
  vendor_name: string;
  zone: string;
  placed_label: string;
  status: string;
  total: number;
  summary: string;
  is_active: boolean;
  window_seconds: number | null;
  window_closes_label: string;
  timeline: { key: string; title: string; detail: string; state: string }[];
  bill_lines: { label: string; amount: number; total?: boolean }[];
  chat: CustomerHubChatMessage[];
  chat_locked: boolean;
  return_id: string | null;
  return_status: string | null;
  meta: Record<string, unknown>;
};

export type CustomerHubReturn = {
  id: string;
  order_id: string;
  order_ref: string;
  category: string;
  category_label: string;
  description: string;
  photo_name: string;
  amount_at_stake: number;
  status: string;
  refund_amount: number | null;
  refund_method: string | null;
  refund_reference: string | null;
  expected_by: string | null;
  vendor_name: string;
};

export type CustomerOrderHub = {
  customer_name: string;
  active: CustomerHubOrder[];
  past: CustomerHubOrder[];
  categories: { key: string; label: string }[];
};

export type CustomerOrderHubChat = {
  info: string;
  threads: {
    order_id: string;
    order_ref: string;
    vendor_name: string;
    online: boolean;
    locked: boolean;
    lock_label: string | null;
    messages: CustomerHubChatMessage[];
  }[];
};

export type CustomerOrderHubPayments = {
  summary: { orders_paid: number; refunds: number; net: number };
  items: {
    order_ref: string;
    label: string;
    amount: number;
    status: string;
    vendor_name: string;
  }[];
};

export type VendorProductItem = {
  product_id: string;
  name: string;
  status: string;
  fulfilment_type: string;
  category: string;
  content: { variants?: { name: string; sku: string }[] };
  pa_status: string;
  pa_reject_reason: string;
  mrp_inr: number;
  image_count: number;
  cities: string[];
  stock_status: string;
  visibility: string;
  brand: string;
  net_weight: string;
  sku: string;
  image_urls: string[];
  description?: string;
  currency: string;
};

export type ServiceCityItem = {
  city_id: string;
  city_name: string;
  warehouse_id: string;
  pincodes: string[];
  currency: string | null;
  resolved_currency: string;
};

export type VendorReturnItem = {
  return_id: string;
  order_id: string;
  line_id: string;
  product_name: string;
  reason: string;
  notes: string;
  status: string;
  created_at: string;
  customer_name: string;
  quantity: number;
  amount: number;
  currency: string;
  refund_amount: number | null;
  refund_currency: string;
  refund_method: string | null;
  vendor_notes: string;
  decided_at: string;
  refunded_at: string;
};

export type ProductCityAssignmentItem = {
  product_id: string;
  product_name: string;
  category: string;
  cities: string[];
  status: string;
};

export type SubmitProductListingBody = {
  product_id?: string;
  name: string;
  description: string;
  category: string;
  sku: string;
  mrp_inr: number;
  currency?: string;
  net_weight: string;
  brand: string;
  image_urls: string[];
  authenticity_attested: boolean;
  city_ids: string[];
  fulfilment_type?: "SHIP_PHYSICAL";
};

export type InventoryRowItem = {
  inventory_id: string;
  product_id: string;
  product_name: string;
  warehouse_id: string;
  warehouse_name: string;
  sku: string;
  available: number;
  reserved: number;
  reorder_threshold: number;
  city_name: string | null;
  status: string | null;
};

export type CityInventoryRowItem = {
  inventory_id: string;
  product_id: string;
  product_name: string;
  city_id: string;
  city_name: string;
  sku: string;
  available: number;
  reserved: number;
  reorder_threshold: number;
  status: string;
};

export type CatalogItem = {
  offering_id: string;
  product_id: string;
  product_name: string;
  vendor: string;
  vendor_id: string;
  plan_name: string;
  price: number;
  currency: string;
  price_usd: number;
  billing_period: string;
  fulfilment_type: string;
  category: string;
  avg_rating?: number;
  review_count?: number;
  in_stock?: boolean;
};

export type CatalogVendorFacet = {
  vendor_id: string;
  name: string;
};

export type VendorPluginItem = {
  plugin_id: string;
  name: string;
  slug: string;
  status: string;
  latest_version: string | null;
  latest_version_status: string | null;
  category: string;
  short_description: string;
  review_notes: string;
  submitted_at: string;
  changelog: string;
};

export type VendorStandardPluginItem = {
  plugin_id: string;
  name: string;
  slug: string;
  category: string;
  short_description: string;
  version: string | null;
  tags: string[];
  vendor_count: number;
  activation_status: string;
};

export type SubmitPluginBundleBody = {
  name: string;
  version: string;
  category: string;
  description?: string;
  artifact_url: string;
  sbom_url?: string;
  plugin_id?: string;
  slug?: string;
};

export const marketplaceApi = {
  plugins: (vendorId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{ plugins: VendorPluginItem[] }>(`/api/v1/vendors/${vendorId}/plugins`, {
      ensureAccessToken,
      method: "GET",
    }),

  vendorPlugins: (vendorId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{ plugins: VendorPluginItem[] }>(`/api/v1/vendors/${vendorId}/plugins`, {
      ensureAccessToken,
      method: "GET",
    }),

  offerings: (vendorId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{
      offerings: {
        offering_id: string;
        product_id: string;
        product_name: string;
        plan_name: string;
        status: string;
        price_usd: number;
      }[];
    }>(`/api/v1/vendors/${vendorId}/offerings`, { ensureAccessToken, method: "GET" }),

  vendorProducts: (vendorId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{
      products: VendorProductItem[];
    }>(`/api/v1/vendors/${vendorId}/products`, { ensureAccessToken, method: "GET" }),

  serviceCities: (vendorId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{ cities: ServiceCityItem[] }>(`/api/v1/vendors/${vendorId}/service-cities`, {
      ensureAccessToken,
      method: "GET",
    }),

  addServiceCity: (
    vendorId: string,
    body: { city_name: string; currency?: string | null },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<ServiceCityItem>(`/api/v1/vendors/${vendorId}/service-cities`, {
      ensureAccessToken,
      method: "POST",
      body,
    }),

  updateServiceCity: (
    vendorId: string,
    cityId: string,
    body: { currency?: string | null },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<ServiceCityItem>(`/api/v1/vendors/${vendorId}/service-cities/${cityId}`, {
      ensureAccessToken,
      method: "PATCH",
      body,
    }),

  deleteServiceCity: (
    vendorId: string,
    cityId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<void>(`/api/v1/vendors/${vendorId}/service-cities/${cityId}`, {
      ensureAccessToken,
      method: "DELETE",
    }),

  setCityPincodes: (
    vendorId: string,
    cityId: string,
    pincodes: string[],
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<ServiceCityItem>(`/api/v1/vendors/${vendorId}/service-cities/${cityId}/pincodes`, {
      ensureAccessToken,
      method: "PUT",
      body: { pincodes },
    }),

  productCityAssignments: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ items: ProductCityAssignmentItem[] }>(
      `/api/v1/vendors/${vendorId}/product-city-assignments`,
      { ensureAccessToken, method: "GET" },
    ),

  setProductServiceCities: (
    productId: string,
    city_ids: string[],
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<ProductCityAssignmentItem>(`/api/v1/products/${productId}/service-cities`, {
      ensureAccessToken,
      method: "PUT",
      body: { city_ids },
    }),

  submitProductListing: (
    vendorId: string,
    body: SubmitProductListingBody,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorProductItem>(`/api/v1/vendors/${vendorId}/products/submit`, {
      ensureAccessToken,
      method: "POST",
      body,
    }),

  resubmitProduct: (productId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<VendorProductItem>(`/api/v1/products/${productId}/resubmit`, {
      ensureAccessToken,
      method: "POST",
    }),

  vendorWarehouses: (vendorId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{
      warehouses: {
        warehouse_id: string;
        name: string;
        location: string;
        capacity: number;
        units_stored: number;
        sku_count: number;
      }[];
    }>(`/api/v1/vendors/${vendorId}/warehouses`, { ensureAccessToken, method: "GET" }),

  createWarehouse: (
    vendorId: string,
    body: { name: string; location: string; capacity: number },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{
      warehouse_id: string;
      name: string;
      location: string;
      capacity: number;
      units_stored: number;
      sku_count: number;
    }>(`/api/v1/vendors/${vendorId}/warehouses`, { ensureAccessToken, method: "POST", body }),

  updateWarehouse: (
    vendorId: string,
    warehouseId: string,
    body: { name: string; location: string; capacity: number },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{
      warehouse_id: string;
      name: string;
      location: string;
      capacity: number;
      units_stored: number;
      sku_count: number;
    }>(`/api/v1/vendors/${vendorId}/warehouses/${warehouseId}`, { ensureAccessToken, method: "PATCH", body }),

  vendorInventory: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
    view?: "by_city",
  ) => {
    const query = view ? `?view=${encodeURIComponent(view)}` : "";
    return apiAuthed<{
      rows: InventoryRowItem[];
      city_rows: CityInventoryRowItem[];
    }>(`/api/v1/vendors/${vendorId}/inventory${query}`, { ensureAccessToken, method: "GET" });
  },

  addInventory: (
    vendorId: string,
    body: {
      product_id: string;
      warehouse_id: string;
      sku: string;
      available: number;
      reorder_threshold?: number;
    },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ inventory_id: string; available: number }>(`/api/v1/vendors/${vendorId}/inventory`, {
      ensureAccessToken,
      method: "POST",
      body,
    }),

  adjustInventory: (
    vendorId: string,
    inventoryId: string,
    available: number,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
    reorder_threshold?: number,
  ) =>
    apiAuthed<{ inventory_id: string; available: number }>(
      `/api/v1/vendors/${vendorId}/inventory/${inventoryId}`,
      {
        ensureAccessToken,
        method: "PATCH",
        body: { available, ...(reorder_threshold !== undefined ? { reorder_threshold } : {}) },
      },
    ),

  vendorReturns: (vendorId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{ returns: VendorReturnItem[] }>(`/api/v1/vendors/${vendorId}/returns`, {
      ensureAccessToken,
      method: "GET",
    }),

  decideReturn: (
    vendorId: string,
    returnId: string,
    body: {
      decision: "approved" | "rejected";
      refund_amount?: number;
      refund_method?: string;
      vendor_notes?: string;
    },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorReturnItem>(`/api/v1/vendors/${vendorId}/returns/${returnId}`, {
      ensureAccessToken,
      method: "PATCH",
      body,
    }),

  issueReturnRefund: (
    vendorId: string,
    returnId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorReturnItem>(`/api/v1/vendors/${vendorId}/returns/${returnId}/refund`, {
      ensureAccessToken,
      method: "POST",
    }),

  vendorCustomers: (vendorId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{
      customers: {
        tenant_id: string;
        customer_name: string;
        order_count: number;
        total: number;
        last_order_at: string;
        city: string;
        currency: string;
        segment: string;
      }[];
    }>(`/api/v1/vendors/${vendorId}/customers`, { ensureAccessToken, method: "GET" }),

  vendorReviews: (vendorId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{
      reviews: {
        id: string;
        customer_name: string;
        product_name: string;
        rating: number;
        comment: string;
        created_at: string;
      }[];
    }>(`/api/v1/vendors/${vendorId}/reviews`, { ensureAccessToken, method: "GET" }),

  vendorPayouts: (vendorId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{
      currency: string;
      this_period: {
        settlement_id: string;
        period: string;
        gross: number;
        platform_fee: number;
        net: number;
        status: string;
      } | null;
      summary: {
        earned_this_month: number;
        next_settlement: number | null;
        next_settlement_due_days: number | null;
        commission_this_month: number;
        commission_rate_pct: number;
        total_settled: number;
      };
      payouts: {
        settlement_id: string;
        period: string;
        gross: number;
        platform_fee: number;
        net: number;
        status: string;
      }[];
    }>(`/api/v1/vendors/${vendorId}/payouts`, { ensureAccessToken, method: "GET" }),

  vendorOrders: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
    status?: string,
  ) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return apiAuthed<{
      lines: {
        order_id: string;
        line_id: string;
        product_name: string;
        quantity: number;
        fulfilment_type: string;
        unit_price: number;
        total: number;
        currency: string;
        status: string;
        placed_at: string;
        customer_name: string;
        line1: string;
        city: string;
        state: string;
        pincode: string;
        phone: string;
        courier: string;
        tracking_number: string;
        refund_status: string;
        refund_amount: number | null;
      }[];
    }>(`/api/v1/vendors/${vendorId}/orders${query}`, { ensureAccessToken, method: "GET" });
  },

  advanceVendorOrder: (
    vendorId: string,
    orderId: string,
    body: { status: string; courier?: string; tracking_number?: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ order_id: string; status: string; courier: string; tracking_number: string }>(
      `/api/v1/vendors/${vendorId}/orders/${orderId}`,
      { ensureAccessToken, method: "PATCH", body },
    ),

  issueVendorRejectRefund: (
    vendorId: string,
    orderId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{
      order_id: string;
      vendor_id: string;
      status: string;
      refund_status: string;
      refund_amount: number | null;
    }>(`/api/v1/vendors/${vendorId}/orders/${orderId}/refund-slice`, {
      ensureAccessToken,
      method: "POST",
    }),

  vendorInstallations: (vendorId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{
      installations: {
        installation_id: string;
        tenant_name: string;
        product_name: string;
        fulfilment_type: string;
        status: string;
        since: string;
      }[];
    }>(`/api/v1/vendors/${vendorId}/installations`, { ensureAccessToken, method: "GET" }),

  portal: (vendorId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{
      vendor_id: string;
      status: string;
      product_count: number;
      offering_count: number;
      active_installs: number;
      pending_plugin_reviews: number;
    }>(`/api/v1/vendors/${vendorId}/portal`, { ensureAccessToken, method: "GET" }),

  vendorStandardPlugins: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
    params?: { q?: string; category?: string },
  ) => {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.category) search.set("category", params.category);
    const query = search.toString();
    return apiAuthed<{ items: VendorStandardPluginItem[] }>(
      `/api/v1/vendors/${vendorId}/standard-plugins${query ? `?${query}` : ""}`,
      { ensureAccessToken, method: "GET" },
    );
  },

  activateStandardPlugin: (
    vendorId: string,
    pluginId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorStandardPluginItem>(
      `/api/v1/vendors/${vendorId}/standard-plugins/${pluginId}/activate`,
      { ensureAccessToken, method: "POST" },
    ),

  deactivateStandardPlugin: (
    vendorId: string,
    pluginId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorStandardPluginItem>(
      `/api/v1/vendors/${vendorId}/standard-plugins/${pluginId}/deactivate`,
      { ensureAccessToken, method: "POST" },
    ),

  vendorGrowthPlugins: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ items: VendorGrowthPluginItem[] }>(`/api/v1/vendors/${vendorId}/growth-plugins`, {
      ensureAccessToken,
      method: "GET",
    }),

  importGrowthPlugin: (
    vendorId: string,
    pluginKey: string,
    body: {
      consents: Record<string, boolean>;
      connection: Record<string, string | boolean>;
      modules?: { key: string; label: string; enabled: boolean }[];
    },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorGrowthPluginItem>(`/api/v1/vendors/${vendorId}/growth-plugins/${pluginKey}/import`, {
      ensureAccessToken,
      method: "POST",
      body,
    }),

  updateVendorGrowthPlugin: (
    vendorId: string,
    pluginKey: string,
    body: {
      modules?: { key: string; label: string; enabled: boolean }[];
      status?: string;
      connection?: Record<string, string | boolean>;
    },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorGrowthPluginItem>(`/api/v1/vendors/${vendorId}/growth-plugins/${pluginKey}`, {
      ensureAccessToken,
      method: "PATCH",
      body,
    }),

  salesPipelineBoard: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<SalesBoard>(`/api/v1/vendors/${vendorId}/growth-plugins/sales-pipeline/board`, {
      ensureAccessToken,
      method: "GET",
    }),

  createSalesDeal: (
    vendorId: string,
    body: { company: string; contact_name?: string; stage?: string; value_inr?: number },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<SalesDeal>(`/api/v1/vendors/${vendorId}/growth-plugins/sales-pipeline/deals`, {
      ensureAccessToken,
      method: "POST",
      body,
    }),

  updateSalesDeal: (
    vendorId: string,
    dealId: string,
    body: { stage?: string; company?: string; contact_name?: string; value_inr?: number },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<SalesDeal>(`/api/v1/vendors/${vendorId}/growth-plugins/sales-pipeline/deals/${dealId}`, {
      ensureAccessToken,
      method: "PATCH",
      body,
    }),

  createSalesFollowUp: (
    vendorId: string,
    body: { title: string; detail?: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<SalesFollowUp>(`/api/v1/vendors/${vendorId}/growth-plugins/sales-pipeline/followups`, {
      ensureAccessToken,
      method: "POST",
      body,
    }),

  completeSalesFollowUp: (
    vendorId: string,
    followupId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<SalesFollowUp>(
      `/api/v1/vendors/${vendorId}/growth-plugins/sales-pipeline/followups/${followupId}/complete`,
      { ensureAccessToken, method: "POST" },
    ),

  digitalMarketingBoard: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<MarketingBoard>(`/api/v1/vendors/${vendorId}/growth-plugins/digital-marketing/board`, {
      ensureAccessToken,
      method: "GET",
    }),

  createMarketingCampaign: (
    vendorId: string,
    body: { name: string; channel?: string; spend_inr?: number; status?: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<MarketingCampaign>(`/api/v1/vendors/${vendorId}/growth-plugins/digital-marketing/campaigns`, {
      ensureAccessToken,
      method: "POST",
      body,
    }),

  updateMarketingCampaign: (
    vendorId: string,
    campaignId: string,
    body: { status?: string; name?: string; channel?: string; spend_inr?: number },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<MarketingCampaign>(
      `/api/v1/vendors/${vendorId}/growth-plugins/digital-marketing/campaigns/${campaignId}`,
      { ensureAccessToken, method: "PATCH", body },
    ),

  publicityBoard: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<PublicityBoard>(`/api/v1/vendors/${vendorId}/growth-plugins/publicity/board`, {
      ensureAccessToken,
      method: "GET",
    }),

  createPressRelease: (
    vendorId: string,
    body: { headline?: string; template?: string; distribution?: string; body?: string; status?: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<PressRelease>(`/api/v1/vendors/${vendorId}/growth-plugins/publicity/releases`, {
      ensureAccessToken,
      method: "POST",
      body,
    }),

  updatePressRelease: (
    vendorId: string,
    releaseId: string,
    body: { headline?: string; template?: string; distribution?: string; body?: string; status?: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<PressRelease>(`/api/v1/vendors/${vendorId}/growth-plugins/publicity/releases/${releaseId}`, {
      ensureAccessToken,
      method: "PATCH",
      body,
    }),

  publicityAiDraft: (
    vendorId: string,
    body: { template: string; topic?: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ headline: string; body: string; template: string }>(
      `/api/v1/vendors/${vendorId}/growth-plugins/publicity/ai-draft`,
      { ensureAccessToken, method: "POST", body },
    ),

  vendorSettlementEarnings: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorSettlementEarnings>(`/api/v1/vendors/${vendorId}/settlement/earnings`, {
      ensureAccessToken,
      method: "GET",
    }),

  vendorSettlementReturns: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorSettlementReturns>(`/api/v1/vendors/${vendorId}/settlement/returns`, {
      ensureAccessToken,
      method: "GET",
    }),

  respondVendorSettlementReturn: (
    vendorId: string,
    returnId: string,
    body: { action: "accept" | "contest" | "timeout"; reason?: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ message: string; toast?: string; item: VendorSettlementReturn }>(
      `/api/v1/vendors/${vendorId}/settlement/returns/${returnId}/respond`,
      { ensureAccessToken, method: "POST", body },
    ),

  vendorSettlementOrders: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorSettlementOrders>(`/api/v1/vendors/${vendorId}/settlement/orders`, {
      ensureAccessToken,
      method: "GET",
    }),

  vendorSettlementHistory: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorSettlementHistory>(`/api/v1/vendors/${vendorId}/settlement/history`, {
      ensureAccessToken,
      method: "GET",
    }),

  vendorSettlementChat: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorSettlementChat>(`/api/v1/vendors/${vendorId}/settlement/chat`, {
      ensureAccessToken,
      method: "GET",
    }),

  vendorSettlementBank: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorSettlementBank>(`/api/v1/vendors/${vendorId}/settlement/bank`, {
      ensureAccessToken,
      method: "GET",
    }),

  updateVendorSettlementBank: (
    vendorId: string,
    body: { bank_name: string; account_number: string; ifsc: string; branch?: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorSettlementBank & { message: string }>(
      `/api/v1/vendors/${vendorId}/settlement/bank`,
      { ensureAccessToken, method: "PATCH", body },
    ),

  vendorCommunicationsHub: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorCommunicationsHub>(`/api/v1/vendors/${vendorId}/communications/hub`, {
      ensureAccessToken,
      method: "GET",
    }),

  vendorCommunicationTemplates: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
    params?: { channel?: string },
  ) => {
    const search = new URLSearchParams();
    if (params?.channel) search.set("channel", params.channel);
    const query = search.toString();
    return apiAuthed<{ items: VendorCommunicationTemplate[] }>(
      `/api/v1/vendors/${vendorId}/communications/templates${query ? `?${query}` : ""}`,
      { ensureAccessToken, method: "GET" },
    );
  },

  sendVendorCommunication: (
    vendorId: string,
    body: {
      template_id: string;
      audience?: string;
      variables?: Record<string, string>;
      contact_name?: string;
      schedule?: string;
    },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{
      log_id: string;
      status: string;
      sent: number;
      delivered: number;
      estimated_cost_inr: number;
    }>(`/api/v1/vendors/${vendorId}/communications/send`, {
      ensureAccessToken,
      method: "POST",
      body,
    }),

  vendorCommunicationLogs: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<VendorCommunicationLogs>(`/api/v1/vendors/${vendorId}/communications/logs`, {
      ensureAccessToken,
      method: "GET",
    }),

  requestVendorCommunicationTemplate: (
    vendorId: string,
    body: { name: string; channel?: string; notes?: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ id: string; status: string }>(
      `/api/v1/vendors/${vendorId}/communications/template-requests`,
      { ensureAccessToken, method: "POST", body },
    ),

  submitPluginBundle: (
    vendorId: string,
    body: SubmitPluginBundleBody,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ plugin_id: string; version_id: string; slug: string; version: string; status: string }>(
      `/api/v1/vendors/${vendorId}/plugins/submit`,
      { ensureAccessToken, method: "POST", body },
    ),

  registerPlugin: (
    vendorId: string,
    body: { name: string; slug: string; category: string; short_description: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ plugin_id: string; slug: string; status: string }>(
      `/api/v1/vendors/${vendorId}/plugins`,
      { ensureAccessToken, method: "POST", body },
    ),

  submitVersion: (
    pluginId: string,
    body: { version: string; artifact_url: string; changelog: string; sbom_url: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ version_id: string; status: string }>(`/api/v1/plugins/${pluginId}/versions`, {
      ensureAccessToken,
      method: "POST",
      body,
    }),

  declareCapabilities: (
    versionId: string,
    capabilities: { scope: string; justification: string }[],
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ capability_count: number }>(
      `/api/v1/plugins/versions/${versionId}/capabilities`,
      { ensureAccessToken, method: "PUT", body: { capabilities } },
    ),

  pendingReviews: (
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
    params?: { status?: string; claimed?: boolean; risk?: string; q?: string },
  ) => {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.claimed !== undefined) search.set("claimed", String(params.claimed));
    if (params?.risk) search.set("risk", params.risk);
    if (params?.q) search.set("q", params.q);
    const query = search.toString();
    return apiAuthed<{
      items: {
        version_id: string;
        plugin_id: string;
        plugin_slug: string;
        version: string;
        status: string;
        vendor_id: string | null;
        vendor_name: string;
        claimed_by: string | null;
        submitted_at?: string;
        risk_level?: string;
        decided_by?: string | null;
        decided_at?: string | null;
        review_notes?: string;
      }[];
    }>(`/api/v1/admin/plugin-reviews${query ? `?${query}` : ""}`, {
      ensureAccessToken,
      method: "GET",
    });
  },

  decideVersion: (
    versionId: string,
    decision: "approved" | "rejected",
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ status: string }>(`/api/v1/admin/plugin-reviews/${versionId}/decision`, {
      ensureAccessToken,
      method: "POST",
      body: { decision },
    }),

  createProduct: (
    vendorId: string,
    body: {
      name: string;
      description: string;
      plugin_id: string;
      fulfilment_type: string;
      category?: string;
      content?: Record<string, unknown>;
    },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ product_id: string; status: string }>(`/api/v1/vendors/${vendorId}/products`, {
      ensureAccessToken,
      method: "POST",
      body,
    }),

  updateProduct: (
    productId: string,
    body: { name?: string; description?: string; category?: string; content?: Record<string, unknown> },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ product_id: string; name: string; status: string }>(`/api/v1/products/${productId}`, {
      ensureAccessToken,
      method: "PATCH",
      body,
    }),

  updateOfferingPrice: (
    offeringId: string,
    priceUsd: number,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ offering_id: string; price_usd: number }>(`/api/v1/offerings/${offeringId}`, {
      ensureAccessToken,
      method: "PATCH",
      body: { price_usd: priceUsd },
    }),

  archiveProduct: (productId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{ product_id: string; status: string }>(`/api/v1/products/${productId}/archive`, {
      ensureAccessToken,
      method: "POST",
    }),

  createOffering: (
    productId: string,
    body: { plan_name: string; billing_period: string; price_usd: number },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ offering_id: string; status: string }>(`/api/v1/products/${productId}/offerings`, {
      ensureAccessToken,
      method: "POST",
      body,
    }),

  publishOffering: (
    offeringId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ status: string }>(`/api/v1/offerings/${offeringId}/publish`, {
      ensureAccessToken,
      method: "POST",
    }),

  catalog: (params?: {
    q?: string;
    category?: string;
    sort?: string;
    verified_only?: boolean;
    price_min?: string;
    price_max?: string;
    vendor_ids?: string;
    pincode?: string;
    in_stock?: boolean;
    fulfilment?: string;
  }) => {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.category) search.set("category", params.category);
    if (params?.sort) search.set("sort", params.sort);
    if (params?.verified_only) search.set("verified_only", "true");
    if (params?.price_min) search.set("price_min", params.price_min);
    if (params?.price_max) search.set("price_max", params.price_max);
    if (params?.vendor_ids) search.set("vendor_ids", params.vendor_ids);
    if (params?.pincode) search.set("pincode", params.pincode);
    if (params?.in_stock) search.set("in_stock", "true");
    if (params?.fulfilment) search.set("fulfilment", params.fulfilment);
    const query = search.toString();
    return api<{
      results: CatalogItem[];
      total: number;
      facets?: { vendors: CatalogVendorFacet[] };
    }>(`/api/v1/marketplace/catalog${query ? `?${query}` : ""}`);
  },

  product: (productId: string) =>
    api<{
      product_id: string;
      name: string;
      description: string;
      fulfilment_type: string;
      vendor: string;
      category: string;
      content?: Record<string, unknown>;
      capabilities: string[];
      offerings: {
        offering_id: string;
        plan_name: string;
        price: number;
        currency: string;
        price_usd: number;
        billing_period: string;
      }[];
    }>(`/api/v1/marketplace/products/${productId}`),

  productReviews: (productId: string) =>
    api<{
      reviews: {
        rating: number;
        comment: string;
        customer_name: string;
        created_at: string;
      }[];
      avg_rating: number;
      review_count: number;
    }>(`/api/v1/marketplace/products/${productId}/reviews`),

  review: (versionId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{
      plugin: string;
      version: string;
      status: string;
      scan_status: string;
      requested_capabilities: string[];
      sbom_url: string;
      changelog: string;
      review_notes: string;
    }>(`/api/v1/plugins/versions/${versionId}/review`, { ensureAccessToken, method: "GET" }),

  claimReview: (versionId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{ claimed_by: string }>(`/api/v1/admin/plugin-reviews/${versionId}/claim`, {
      ensureAccessToken,
      method: "POST",
    }),

  requestChanges: (
    versionId: string,
    notes: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ status: string }>(`/api/v1/plugins/versions/${versionId}/request-changes`, {
      ensureAccessToken,
      method: "POST",
      body: { notes },
    }),

  adminVendors: (
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
    params?: { status?: string; q?: string },
  ) => {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.q) search.set("q", params.q);
    const query = search.toString();
    return apiAuthed<{
      results: {
        vendor_id: string;
        legal_name: string;
        status: string;
        product_count: number;
        active_installs: number;
        plugin_count: number;
        warehouse_count: number;
        kyc_status: string;
        gmv_mtd: number;
      }[];
    }>(`/api/v1/admin/vendors${query ? `?${query}` : ""}`, {
      ensureAccessToken,
      method: "GET",
    });
  },

  suspendVendor: (
    vendorId: string,
    reason: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ status: string; offerings_unpublished: number }>(
      `/api/v1/admin/vendors/${vendorId}/suspend`,
      { ensureAccessToken, method: "POST", body: { reason } },
    ),

  reinstateVendor: (
    vendorId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ status: string }>(`/api/v1/admin/vendors/${vendorId}/reinstate`, {
      ensureAccessToken,
      method: "POST",
    }),

  install: (
    tenantId: string,
    body: { offering_id: string; accepted_capabilities: string[] },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ installation_id: string; status: string }>(
      `/api/v1/tenants/${tenantId}/installations`,
      { ensureAccessToken, tenantId, method: "POST", body },
    ),

  home: () =>
    api<{ categories: string[]; rails: Record<string, CatalogItem[]> }>("/api/v1/marketplace/home"),

  wishlist: (tenantId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{
      items: { product_id: string; name: string; vendor_name: string; fulfilment_type: string }[];
    }>(`/api/v1/tenants/${tenantId}/wishlist`, { ensureAccessToken, tenantId, method: "GET" }),

  saveWishlist: (
    tenantId: string,
    productId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ items: { product_id: string }[] }>(`/api/v1/tenants/${tenantId}/wishlist`, {
      ensureAccessToken,
      tenantId,
      method: "POST",
      body: { product_id: productId },
    }),

  removeWishlist: (
    tenantId: string,
    productId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ status: string }>(`/api/v1/tenants/${tenantId}/wishlist/${productId}`, {
      ensureAccessToken,
      tenantId,
      method: "DELETE",
    }),

  cart: (tenantId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<CartResponse>(`/api/v1/tenants/${tenantId}/cart`, {
      ensureAccessToken,
      tenantId,
      method: "GET",
    }),

  addCartLine: (
    tenantId: string,
    body: { offering_id: string; quantity: number },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<CartResponse>(`/api/v1/tenants/${tenantId}/cart/lines`, {
      ensureAccessToken,
      tenantId,
      method: "POST",
      body,
    }),

  updateCartLine: (
    tenantId: string,
    lineId: string,
    quantity: number,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<CartResponse>(`/api/v1/tenants/${tenantId}/cart/lines/${lineId}`, {
      ensureAccessToken,
      tenantId,
      method: "PATCH",
      body: { quantity },
    }),

  removeCartLine: (
    tenantId: string,
    lineId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<CartResponse>(`/api/v1/tenants/${tenantId}/cart/lines/${lineId}`, {
      ensureAccessToken,
      tenantId,
      method: "DELETE",
    }),

  addresses: (tenantId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{ addresses: AddressItem[] }>(`/api/v1/tenants/${tenantId}/addresses`, {
      ensureAccessToken,
      tenantId,
      method: "GET",
    }),

  createAddress: (
    tenantId: string,
    body: Omit<AddressItem, "address_id">,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<AddressItem>(`/api/v1/tenants/${tenantId}/addresses`, {
      ensureAccessToken,
      tenantId,
      method: "POST",
      body,
    }),

  updateAddress: (
    tenantId: string,
    addressId: string,
    body: Omit<AddressItem, "address_id">,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<AddressItem>(`/api/v1/tenants/${tenantId}/addresses/${addressId}`, {
      ensureAccessToken,
      tenantId,
      method: "PATCH",
      body,
    }),

  deleteAddress: (
    tenantId: string,
    addressId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ status: string }>(`/api/v1/tenants/${tenantId}/addresses/${addressId}`, {
      ensureAccessToken,
      tenantId,
      method: "DELETE",
    }),

  placeOrder: (
    tenantId: string,
    body: { address_id?: string; payment_method: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ order_id: string; status: string; line_count: number }>(
      `/api/v1/tenants/${tenantId}/orders`,
      { ensureAccessToken, tenantId, method: "POST", body },
    ),

  paymentsConfig: () =>
    api<{ provider: string; cf_env: string; cashfree_app_id: string }>("/api/v1/payments/config"),

  createCheckoutSession: (
    tenantId: string,
    body: { address_id?: string; payment_method: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<CheckoutSession>(`/api/v1/tenants/${tenantId}/checkout/sessions`, {
      ensureAccessToken,
      tenantId,
      method: "POST",
      body,
    }),

  orderPayment: (
    tenantId: string,
    orderId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<OrderPaymentStatus>(`/api/v1/tenants/${tenantId}/orders/${orderId}/payment`, {
      ensureAccessToken,
      tenantId,
      method: "GET",
    }),

  simulateOrderPayment: (
    tenantId: string,
    orderId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<OrderPaymentStatus>(
      `/api/v1/tenants/${tenantId}/orders/${orderId}/payment/simulate`,
      { ensureAccessToken, tenantId, method: "POST" },
    ),

  reconcileOrderPayment: (
    tenantId: string,
    orderId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<OrderPaymentStatus>(
      `/api/v1/tenants/${tenantId}/orders/${orderId}/payment/reconcile`,
      { ensureAccessToken, tenantId, method: "POST" },
    ),

  orders: (tenantId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{ orders: OrderSummary[] }>(`/api/v1/tenants/${tenantId}/orders`, {
      ensureAccessToken,
      tenantId,
      method: "GET",
    }),

  orderHub: (tenantId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<CustomerOrderHub>(`/api/v1/tenants/${tenantId}/order-hub`, {
      ensureAccessToken,
      tenantId,
      method: "GET",
    }),

  orderHubOrder: (
    tenantId: string,
    orderId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<CustomerHubOrder>(`/api/v1/tenants/${tenantId}/order-hub/orders/${orderId}`, {
      ensureAccessToken,
      tenantId,
      method: "GET",
    }),

  orderHubSubmitReturn: (
    tenantId: string,
    orderId: string,
    body: { category: string; description: string; photo_name?: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ message: string; item: CustomerHubReturn; order: CustomerHubOrder }>(
      `/api/v1/tenants/${tenantId}/order-hub/orders/${orderId}/returns`,
      { ensureAccessToken, tenantId, method: "POST", body },
    ),

  orderHubSimulateAccept: (
    tenantId: string,
    orderId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ message: string; item: CustomerHubReturn; order: CustomerHubOrder }>(
      `/api/v1/tenants/${tenantId}/order-hub/orders/${orderId}/returns/simulate-accept`,
      { ensureAccessToken, tenantId, method: "POST" },
    ),

  orderHubCloseWindow: (
    tenantId: string,
    orderId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<CustomerHubOrder>(
      `/api/v1/tenants/${tenantId}/order-hub/orders/${orderId}/close-window`,
      { ensureAccessToken, tenantId, method: "POST" },
    ),

  orderHubChat: (
    tenantId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
    orderId?: string,
  ) => {
    const q = orderId ? `?order_id=${encodeURIComponent(orderId)}` : "";
    return apiAuthed<CustomerOrderHubChat>(`/api/v1/tenants/${tenantId}/order-hub/chat${q}`, {
      ensureAccessToken,
      tenantId,
      method: "GET",
    });
  },

  orderHubPayments: (
    tenantId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<CustomerOrderHubPayments>(`/api/v1/tenants/${tenantId}/order-hub/payments`, {
      ensureAccessToken,
      tenantId,
      method: "GET",
    }),

  order: (orderId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<OrderDetail>(`/api/v1/orders/${orderId}`, { ensureAccessToken, method: "GET" }),

  cancelOrder: (
    tenantId: string,
    orderId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<OrderDetail>(`/api/v1/tenants/${tenantId}/orders/${orderId}/cancel`, {
      ensureAccessToken,
      tenantId,
      method: "POST",
    }),

  requestReturn: (
    orderId: string,
    body: { line_id: string; reason: string; notes?: string },
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ return_id: string; status: string }>(`/api/v1/orders/${orderId}/returns`, {
      ensureAccessToken,
      method: "POST",
      body,
    }),

  returns: (tenantId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{
      returns: { return_id: string; order_id: string; product_name: string; reason: string; status: string }[];
    }>(`/api/v1/tenants/${tenantId}/returns`, { ensureAccessToken, tenantId, method: "GET" }),

  subscriptions: (tenantId: string, ensureAccessToken: (force?: boolean) => Promise<string | null>) =>
    apiAuthed<{
      subscriptions: {
        offering_id: string;
        product_name: string;
        plan_name: string;
        status: string;
        next_billing_at: string | null;
      }[];
      active_count: number;
    }>(`/api/v1/tenants/${tenantId}/subscriptions`, { ensureAccessToken, tenantId, method: "GET" }),

  cancelSubscription: (
    tenantId: string,
    offeringId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{ status: string }>(
      `/api/v1/tenants/${tenantId}/subscriptions/${offeringId}/cancel`,
      { ensureAccessToken, tenantId, method: "POST" },
    ),

  entitlements: (
    tenantId: string,
    ensureAccessToken: (force?: boolean) => Promise<string | null>,
  ) =>
    apiAuthed<{
      entitlements: {
        entitlement_id: string;
        offering: string;
        status: string;
        installation_status: string;
      }[];
    }>(`/api/v1/tenants/${tenantId}/entitlements`, {
      ensureAccessToken,
      tenantId,
      method: "GET",
    }),
};

export type GrowthPluginModule = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  badge: string | null;
};

export type GrowthPluginItem = {
  key: string;
  name: string;
  description: string;
  group_label: string;
  lifecycle: string;
  enabled: boolean;
  modules: GrowthPluginModule[];
  config: Record<string, string | number | boolean>;
  stats: {
    vendors_using?: number;
    total_vendors?: number;
    items?: { key: string; label: string; value: string }[];
  };
  guarantees: string[];
  updated_at: string | null;
};

export type VendorGrowthModule = {
  key: string;
  label: string;
  description: string;
  badge: string | null;
  platform_enabled: boolean;
  enabled: boolean;
};

export type VendorGrowthPluginItem = {
  key: string;
  name: string;
  description: string;
  group_label: string;
  lifecycle: string;
  platform_enabled: boolean;
  rating: number;
  price_label: string;
  vendors_using: number;
  total_vendors: number;
  guarantees: string[];
  modules: GrowthPluginModule[];
  installation_status: "active" | "inactive" | "not_imported";
  vendor_modules: VendorGrowthModule[];
  connection: Record<string, string | boolean>;
  imported_at: string | null;
  updated_at: string | null;
};

export type SalesDeal = {
  deal_id: string;
  company: string;
  contact_name: string;
  stage: string;
  value_inr: number;
  created_at: string;
  updated_at: string;
};

export type SalesFollowUp = {
  followup_id: string;
  deal_id: string | null;
  title: string;
  detail: string;
  status: string;
};

export type SalesBoard = {
  stages: { key: string; label: string }[];
  deals: SalesDeal[];
  followups: SalesFollowUp[];
  stats: {
    total_pipeline_inr: number;
    deals_open: number;
    closing_this_month_inr: number;
    avg_cycle_days: number;
  };
  active_modules: number;
  updated_at: string | null;
};

export type MarketingCampaign = {
  campaign_id: string;
  name: string;
  channel: string;
  spend_inr: number;
  ctr_percent: number;
  conversions: number;
  status: "live" | "paused" | "draft";
  created_at: string;
  updated_at: string;
};

export type MarketingBoard = {
  campaigns: MarketingCampaign[];
  stats: {
    total_ad_spend_inr: number;
    budget_inr: number;
    avg_ctr_percent: number;
    conversions: number;
    cost_per_conversion_inr: number;
    live_campaigns: number;
  };
  race_funnel: { stage: string; value: number }[];
  active_modules: number;
  daily_spend_cap_inr: number;
  updated_at: string | null;
};

export type PressRelease = {
  release_id: string;
  headline: string;
  template: string;
  template_label: string;
  distribution: string;
  distribution_label: string;
  body: string;
  status: "draft" | "sent";
  created_at: string;
  updated_at: string;
};

export type PublicityBoard = {
  releases: PressRelease[];
  stats: { releases_sent: number; drafts: number; total_releases: number };
  templates: { key: string; label: string }[];
  distributions: { key: string; label: string }[];
  active_modules: number;
  ai_tokens_per_month: number;
  media_kit_format: string;
  updated_at: string | null;
};

export type VendorCommunicationTemplate = {
  id: string;
  code: string;
  name: string;
  channel: string;
  plugin: string;
  message_type: string;
  body: string;
  approval_status: string;
  dlt_reference: string | null;
  vendors_using: number;
  messages_sent_month: number;
  variable_map: { index: number; label: string }[];
  meta: Record<string, unknown>;
  submitted_at: string | null;
};

export type VendorCommunicationLog = {
  id: string;
  occurred_at: string;
  channel: string;
  template_code: string;
  template_name: string;
  audience: string;
  contact_name: string | null;
  sent: number;
  delivered: number | null;
  read_count: number;
  replied_count: number;
  status: string;
};

export type VendorSettlementOrder = {
  id: string;
  order_ref: string;
  order_time: string;
  items: string;
  gross: number;
  net: number;
  status: string;
  window_label: string;
  settlement_label: string;
  return_label: string;
  in_tracker: boolean;
  in_today: boolean;
};

export type VendorSettlementEarnings = {
  as_of: string;
  zone: string;
  live: boolean;
  open_return_alerts: number;
  kpis: {
    settled_today: number;
    settled_today_sub: string;
    pending_window: number;
    pending_window_sub: string;
    on_hold: number;
    on_hold_sub: string;
    next_transfer_minutes: number;
    next_transfer_sub: string;
  };
  tracker: VendorSettlementOrder[];
  calculation: {
    title: string;
    lines: { label: string; amount: number; tone: string }[];
  };
};

export type VendorSettlementReturn = {
  id: string;
  order_ref: string;
  customer_name: string;
  complaint: string;
  reason_code: string;
  refund_requested: number;
  amount_on_hold: number;
  order_items: string;
  timeline: string;
  deadline_seconds: number | null;
  status: string;
  contest_reason: string;
  chat: { kind: string; label?: string; text: string }[];
  meta: Record<string, unknown>;
};

export type VendorSettlementReturns = {
  open_count: number;
  items: VendorSettlementReturn[];
};

export type VendorSettlementOrders = {
  total: number;
  items: VendorSettlementOrder[];
};

export type VendorSettlementHistory = {
  summary: {
    period: string;
    gross: number;
    total_deductions: number;
    net_received: number;
    tds_deducted: number;
    refund_adjustments: number;
    form_16a_next: string;
  };
  items: {
    id: string;
    settle_date: string;
    orders: number;
    gross: number;
    deductions: number;
    refund_adj: number;
    net: number;
    utr: string | null;
  }[];
};

export type VendorSettlementChat = {
  info: string;
  threads: {
    id: string;
    customer_name: string;
    order_ref: string;
    locked: boolean;
    lock_label: string;
    messages: { kind: string; label?: string; text: string }[];
  }[];
};

export type VendorSettlementBank = {
  bank_name: string;
  account_mask: string;
  ifsc: string;
  branch: string;
  verified: boolean;
  note: string;
};

export type VendorCommunicationsHub = {
  summary: {
    sent_this_month: number;
    delivery_rate: number;
    active_campaigns: number;
    templates_available: number;
    by_channel: Record<
      string,
      { sent: number; delivered: number; badge?: string | null; delivery_rate?: number }
    >;
  };
  recent: VendorCommunicationLog[];
};

export type VendorCommunicationLogs = {
  items: VendorCommunicationLog[];
  campaign: {
    title: string;
    targeted: number;
    sent: number;
    delivered: number;
    read: number;
    replied: number;
    opted_out: number;
  } | null;
  compliance: Record<string, string>;
};

export type PlatformAdminEnsure = (force?: boolean) => Promise<string | null>;

export const platformAdminApi = {
  reviewStats: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<{
      pending: number;
      in_review: number;
      published: number;
      rejected: number;
      standard_plugins: number;
    }>("/api/v1/admin/plugin-reviews/stats", { ensureAccessToken, method: "GET" }),

  standardPlugins: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<{
      items: {
        plugin_id: string | null;
        category: string;
        name: string | null;
        slug: string | null;
        status: string | null;
        short_description: string | null;
        version: string | null;
        requirements: unknown[];
        updated_at: string | null;
      }[];
    }>("/api/v1/admin/standard-plugins", { ensureAccessToken, method: "GET" }),

  createStandardPlugin: (
    body: {
      name: string;
      slug: string;
      category: string;
      short_description?: string;
      version: string;
      artifact_url: string;
      changelog?: string;
      requirements?: unknown[];
      publish?: boolean;
    },
    ensureAccessToken: PlatformAdminEnsure,
  ) =>
    apiAuthed<{ plugin_id: string; status: string }>("/api/v1/admin/standard-plugins", {
      ensureAccessToken,
      method: "POST",
      body,
    }),

  updateStandardPlugin: (
    pluginId: string,
    body: { name?: string; short_description?: string; requirements?: unknown[] },
    ensureAccessToken: PlatformAdminEnsure,
  ) =>
    apiAuthed(`/api/v1/admin/standard-plugins/${pluginId}`, {
      ensureAccessToken,
      method: "PATCH",
      body,
    }),

  publishStandardPlugin: (pluginId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed(`/api/v1/admin/standard-plugins/${pluginId}/publish`, {
      ensureAccessToken,
      method: "POST",
    }),

  unpublishStandardPlugin: (pluginId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed(`/api/v1/admin/standard-plugins/${pluginId}/unpublish`, {
      ensureAccessToken,
      method: "POST",
    }),

  deprecateStandardPlugin: (pluginId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed(`/api/v1/admin/standard-plugins/${pluginId}/deprecate`, {
      ensureAccessToken,
      method: "POST",
    }),

  deleteStandardPlugin: (pluginId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<void>(`/api/v1/admin/standard-plugins/${pluginId}`, {
      ensureAccessToken,
      method: "DELETE",
    }),

  growthPlugins: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<{
      items: GrowthPluginItem[];
      summary: {
        total_plugins: number;
        total_modules: number;
        enabled_plugins: number;
        vendors_using: number;
      };
    }>("/api/v1/admin/growth-plugins", { ensureAccessToken, method: "GET" }),

  updateGrowthPlugin: (
    pluginKey: string,
    body: {
      enabled?: boolean;
      modules?: GrowthPluginModule[];
      config?: Record<string, string | number | boolean>;
    },
    ensureAccessToken: PlatformAdminEnsure,
  ) =>
    apiAuthed<GrowthPluginItem>(`/api/v1/admin/growth-plugins/${pluginKey}`, {
      ensureAccessToken,
      method: "PATCH",
      body,
    }),

  users: (
    ensureAccessToken: PlatformAdminEnsure,
    params?: { q?: string; principal_type?: string; status?: string; page?: number },
  ) => {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.principal_type) search.set("principal_type", params.principal_type);
    if (params?.status) search.set("status", params.status);
    if (params?.page) search.set("page", String(params.page));
    const query = search.toString();
    return apiAuthed<{
      items: {
        user_id: string;
        principal_id: string;
        email: string;
        display_name: string;
        principal_type: string;
        status: string;
        tenant_id: string | null;
        tenant_name: string | null;
        org_name: string | null;
        role_label: string | null;
        is_platform_operator: boolean;
        last_active_at: string | null;
      }[];
      total: number;
      page: number;
      page_size: number;
    }>(`/api/v1/admin/users${query ? `?${query}` : ""}`, { ensureAccessToken, method: "GET" });
  },

  suspendUser: (userId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed(`/api/v1/admin/users/${userId}/suspend`, { ensureAccessToken, method: "POST" }),

  reinstateUser: (userId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed(`/api/v1/admin/users/${userId}/reinstate`, { ensureAccessToken, method: "POST" }),

  blockUser: (userId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed(`/api/v1/admin/users/${userId}/block`, { ensureAccessToken, method: "POST" }),

  resetMfa: (userId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed(`/api/v1/admin/users/${userId}/reset-mfa`, { ensureAccessToken, method: "POST" }),

  promoteOperator: (userId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed(`/api/v1/admin/users/${userId}/promote-operator`, {
      ensureAccessToken,
      method: "POST",
    }),

  permissions: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<{ items: { code: string; scope_type: string; description: string | null }[] }>(
      "/api/v1/admin/permissions",
      { ensureAccessToken, method: "GET" },
    ),

  roles: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<{
      items: {
        role_id: string | null;
        name: string;
        scope_type: string;
        is_system_role: boolean;
        tenant_id: string | null;
        status: string;
        permission_codes: string[];
      }[];
    }>("/api/v1/admin/roles", { ensureAccessToken, method: "GET" }),

  createRole: (
    body: {
      name: string;
      based_on: string;
      tenant_id: string;
      add_permissions?: string[];
      remove_permissions?: string[];
    },
    ensureAccessToken: PlatformAdminEnsure,
  ) =>
    apiAuthed("/api/v1/admin/roles", { ensureAccessToken, method: "POST", body }),

  roleBindings: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<{
      items: {
        binding_id: string;
        principal_id: string;
        user_email: string | null;
        role_id: string;
        role_name: string;
        scope_type: string;
        tenant_id: string | null;
        tenant_name: string | null;
        granted_by: string | null;
        since: string;
        status: string;
      }[];
    }>("/api/v1/admin/role-bindings", { ensureAccessToken, method: "GET" }),

  revokeBinding: (bindingId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed(`/api/v1/admin/role-bindings/${bindingId}`, {
      ensureAccessToken,
      method: "DELETE",
    }),

  vendorStats: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<{
      active: number;
      pending_verification: number;
      suspended: number;
      total_plugins: number;
    }>("/api/v1/admin/vendors/stats", { ensureAccessToken, method: "GET" }),

  reinstateVendor: (vendorId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<{ status: string }>(`/api/v1/admin/vendors/${vendorId}/reinstate`, {
      ensureAccessToken,
      method: "POST",
    }),

  vendors: (
    ensureAccessToken: PlatformAdminEnsure,
    params?: { status?: string; q?: string },
  ) => marketplaceApi.adminVendors(ensureAccessToken, params),

  suspendVendor: (
    vendorId: string,
    reason: string,
    ensureAccessToken: PlatformAdminEnsure,
  ) => marketplaceApi.suspendVendor(vendorId, reason, ensureAccessToken),

  tenants: (
    ensureAccessToken: PlatformAdminEnsure,
    params?: { q?: string; org_type?: string },
  ) => {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.org_type) search.set("org_type", params.org_type);
    const query = search.toString();
    return apiAuthed<{
      items: {
        tenant_id: string;
        tenant_name: string;
        org_id: string;
        org_name: string;
        org_type: string;
        participation: string;
        member_count: number;
        status: string;
      }[];
    }>(`/api/v1/admin/tenants${query ? `?${query}` : ""}`, { ensureAccessToken, method: "GET" });
  },

  tenantStats: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<{
      active: number;
      suspended: number;
      total: number;
      individual: number;
      organisation: number;
      vendor: number;
    }>("/api/v1/admin/tenants/stats", { ensureAccessToken, method: "GET" }),

  suspendTenant: (tenantId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed(`/api/v1/admin/tenants/${tenantId}/suspend`, {
      ensureAccessToken,
      method: "POST",
    }),

  reinstateTenant: (tenantId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed(`/api/v1/admin/tenants/${tenantId}/reinstate`, {
      ensureAccessToken,
      method: "POST",
    }),

  provisionTenant: (
    body: { email: string; org_name?: string; tenant_name?: string },
    ensureAccessToken: PlatformAdminEnsure,
  ) =>
    apiAuthed("/api/v1/admin/tenants", { ensureAccessToken, method: "POST", body }),

  products: (
    ensureAccessToken: PlatformAdminEnsure,
    params?: { pa_status?: string; q?: string; vendor_id?: string },
  ) => {
    const search = new URLSearchParams();
    if (params?.pa_status) search.set("pa_status", params.pa_status);
    if (params?.q) search.set("q", params.q);
    if (params?.vendor_id) search.set("vendor_id", params.vendor_id);
    const query = search.toString();
    return apiAuthed<{
      items: {
        product_id: string;
        name: string;
        vendor_id: string;
        vendor_name: string;
        category: string;
        status: string;
        pa_status: string;
        pa_reject_reason: string;
        fulfilment_type: string;
        submitted_at: string;
      }[];
    }>(`/api/v1/admin/products${query ? `?${query}` : ""}`, { ensureAccessToken, method: "GET" });
  },

  productStats: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<{
      pending_review: number;
      live: number;
      rejected: number;
      not_submitted: number;
      warehouse_locations: number;
    }>("/api/v1/admin/products/stats", { ensureAccessToken, method: "GET" }),

  approveProduct: (productId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed(`/api/v1/admin/products/${productId}/approve`, {
      ensureAccessToken,
      method: "POST",
    }),

  rejectProduct: (
    productId: string,
    reason: string,
    ensureAccessToken: PlatformAdminEnsure,
  ) =>
    apiAuthed(`/api/v1/admin/products/${productId}/reject`, {
      ensureAccessToken,
      method: "POST",
      body: { reason },
    }),

  locationsSummary: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<{
      items: {
        location: string;
        warehouse_count: number;
        vendor_count: number;
        units_stored: number;
      }[];
    }>("/api/v1/admin/locations/summary", { ensureAccessToken, method: "GET" }),

  dashboard: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<{
      tenant_count: number;
      active_tenants: number;
      vendor_count: number;
      verified_vendors: number;
      user_count: number;
      pending_plugin_reviews: number;
      pending_product_reviews: number;
      revenue_mtd: number;
      recent_events: {
        event_action?: string;
        actor_email?: string | null;
        created_at?: string;
      }[];
    }>("/api/v1/admin/dashboard", { ensureAccessToken, method: "GET" }),

  analytics: (ensureAccessToken: PlatformAdminEnsure, tab: string) =>
    apiAuthed<Record<string, unknown>>(
      `/api/v1/admin/analytics?tab=${encodeURIComponent(tab)}`,
      { ensureAccessToken, method: "GET" },
    ),

  auditLog: (
    ensureAccessToken: PlatformAdminEnsure,
    params?: { action?: string; actor?: string; from?: string; to?: string; q?: string; page?: number },
  ) => {
    const search = new URLSearchParams();
    if (params?.action) search.set("action", params.action);
    if (params?.actor) search.set("actor", params.actor);
    if (params?.from) search.set("from", params.from);
    if (params?.to) search.set("to", params.to);
    if (params?.q) search.set("q", params.q);
    if (params?.page) search.set("page", String(params.page));
    const query = search.toString();
    return apiAuthed<{
      items: {
        id: string;
        event_action: string;
        actor_user_id: string | null;
        actor_email: string | null;
        tenant_id: string | null;
        payload: Record<string, unknown>;
        created_at: string;
      }[];
      total: number;
      page: number;
      page_size: number;
    }>(`/api/v1/admin/audit-log${query ? `?${query}` : ""}`, { ensureAccessToken, method: "GET" });
  },

  policies: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<{
      items: {
        id: string;
        name: string;
        scope: string;
        enforcement: string;
        applies_to: string;
        status: string;
        body: Record<string, unknown>;
      }[];
    }>("/api/v1/admin/policies", { ensureAccessToken, method: "GET" }),

  createPolicy: (
    body: {
      name: string;
      scope: string;
      enforcement?: string;
      applies_to?: string;
      body?: Record<string, unknown>;
    },
    ensureAccessToken: PlatformAdminEnsure,
  ) =>
    apiAuthed("/api/v1/admin/policies", { ensureAccessToken, method: "POST", body }),

  updatePolicy: (
    policyId: string,
    body: {
      name?: string;
      status?: string;
      enforcement?: string;
      applies_to?: string;
      body?: Record<string, unknown>;
    },
    ensureAccessToken: PlatformAdminEnsure,
  ) =>
    apiAuthed(`/api/v1/admin/policies/${policyId}`, {
      ensureAccessToken,
      method: "PATCH",
      body,
    }),

  togglePolicy: (policyId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed(`/api/v1/admin/policies/${policyId}/toggle`, {
      ensureAccessToken,
      method: "POST",
    }),

  config: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<{ values: Record<string, unknown> }>("/api/v1/admin/config", {
      ensureAccessToken,
      method: "GET",
    }),

  patchConfig: (
    updates: Record<string, unknown>,
    ensureAccessToken: PlatformAdminEnsure,
  ) =>
    apiAuthed<{ values: Record<string, unknown> }>("/api/v1/admin/config", {
      ensureAccessToken,
      method: "PATCH",
      body: { updates },
    }),

  team: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<{
      items: {
        id: string;
        user_id: string | null;
        email: string;
        platform_role: string;
        status: string;
        mfa_enabled: boolean;
        invited_at: string;
        activated_at: string | null;
      }[];
    }>("/api/v1/admin/team", { ensureAccessToken, method: "GET" }),

  inviteTeam: (
    body: { email: string; platform_role: string; invite_note?: string },
    ensureAccessToken: PlatformAdminEnsure,
  ) =>
    apiAuthed("/api/v1/admin/team/invite", { ensureAccessToken, method: "POST", body }),

  updateTeamRole: (
    memberId: string,
    platform_role: string,
    ensureAccessToken: PlatformAdminEnsure,
  ) =>
    apiAuthed(`/api/v1/admin/team/${memberId}/role`, {
      ensureAccessToken,
      method: "PATCH",
      body: { platform_role },
    }),

  suspendTeamMember: (memberId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed(`/api/v1/admin/team/${memberId}/suspend`, {
      ensureAccessToken,
      method: "POST",
    }),

  reactivateTeamMember: (memberId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed(`/api/v1/admin/team/${memberId}/reactivate`, {
      ensureAccessToken,
      method: "POST",
    }),

  resetTeamMfa: (memberId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed(`/api/v1/admin/team/${memberId}/reset-mfa`, {
      ensureAccessToken,
      method: "POST",
    }),

  transferSuperAdmin: (
    body: { recipient_member_id: string; password: string },
    ensureAccessToken: PlatformAdminEnsure,
  ) =>
    apiAuthed("/api/v1/admin/team/super-admin/transfer", {
      ensureAccessToken,
      method: "POST",
      body,
    }),

  communicationTemplates: (
    ensureAccessToken: PlatformAdminEnsure,
    params?: { status?: string },
  ) => {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    const query = search.toString();
    return apiAuthed<{
      items: CommunicationTemplateItem[];
      summary: CommunicationTemplateSummary;
    }>(`/api/v1/admin/communications/templates${query ? `?${query}` : ""}`, {
      ensureAccessToken,
      method: "GET",
    });
  },

  communicationTemplate: (templateId: string, ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<CommunicationTemplateItem>(
      `/api/v1/admin/communications/templates/${templateId}`,
      { ensureAccessToken, method: "GET" },
    ),

  createCommunicationTemplate: (
    body: {
      name: string;
      channel: string;
      plugin?: string;
      message_type?: string;
      body: string;
      code?: string;
      buttons?: string;
    },
    ensureAccessToken: PlatformAdminEnsure,
  ) =>
    apiAuthed<CommunicationTemplateItem>("/api/v1/admin/communications/templates", {
      ensureAccessToken,
      method: "POST",
      body,
    }),

  communicationDlt: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<{
      entity: {
        entity_name: string;
        entity_id: string;
        registered_on: string;
        renewal: string;
        status: string;
        sender_header: string;
        sender_header_status: string;
        waba_status: string;
        bsp: string;
        free_conversations_month: number;
      };
      template_stats: {
        total_registered: number;
        promotional: number;
        transactional: number;
        pending: number;
      };
      whatsapp: {
        business_account: string;
        bsp: string;
        hsm_live: number;
        hsm_pending: number;
        free_conversations_month: number;
      };
      pending_registrations: {
        id: string;
        name: string;
        message_type: string;
        dlt_reference: string | null;
        submitted_at: string | null;
        expected_by: string | null;
        approval_status: string;
      }[];
    }>("/api/v1/admin/communications/dlt", { ensureAccessToken, method: "GET" }),

  communicationUsage: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<{
      items: CommunicationUsageItem[];
      summary: CommunicationUsageSummary;
    }>("/api/v1/admin/communications/usage", { ensureAccessToken, method: "GET" }),

  communicationConsent: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<{
      sms_optouts: number;
      whatsapp_optouts: number;
      email_unsubs: number;
      dnd_scrub_today: number;
      note: string;
    }>("/api/v1/admin/communications/consent", { ensureAccessToken, method: "GET" }),

  settlementDashboard: (ensureAccessToken: PlatformAdminEnsure, period = "today") =>
    apiAuthed<SettlementDashboard>(
      `/api/v1/admin/settlement/dashboard?period=${encodeURIComponent(period)}`,
      { ensureAccessToken, method: "GET" },
    ),

  settlementReturns: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<SettlementReturnQueue>("/api/v1/admin/settlement/returns", {
      ensureAccessToken,
      method: "GET",
    }),

  resolveSettlementReturn: (
    caseId: string,
    body: { outcome: string; amount?: number; reason?: string },
    ensureAccessToken: PlatformAdminEnsure,
  ) =>
    apiAuthed<{ message: string; item: SettlementReturnCase }>(
      `/api/v1/admin/settlement/returns/${caseId}/resolve`,
      { ensureAccessToken, method: "POST", body },
    ),

  settlementLedger: (ensureAccessToken: PlatformAdminEnsure, vendor?: string) => {
    const query = vendor ? `?vendor=${encodeURIComponent(vendor)}` : "";
    return apiAuthed<SettlementLedger>(`/api/v1/admin/settlement/ledger${query}`, {
      ensureAccessToken,
      method: "GET",
    });
  },

  settlementTds: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<SettlementTds>("/api/v1/admin/settlement/tds", {
      ensureAccessToken,
      method: "GET",
    }),

  settlementEscrow: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<SettlementEscrow>("/api/v1/admin/settlement/escrow", {
      ensureAccessToken,
      method: "GET",
    }),

  settlementFaults: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<SettlementFaults>("/api/v1/admin/settlement/faults", {
      ensureAccessToken,
      method: "GET",
    }),

  settlementFraud: (ensureAccessToken: PlatformAdminEnsure) =>
    apiAuthed<SettlementFraud>("/api/v1/admin/settlement/fraud", {
      ensureAccessToken,
      method: "GET",
    }),

  settlementFraudAction: (
    signalId: string,
    action: string,
    ensureAccessToken: PlatformAdminEnsure,
  ) =>
    apiAuthed<{ message: string; item: SettlementFraudSignal }>(
      `/api/v1/admin/settlement/fraud/${signalId}/action`,
      { ensureAccessToken, method: "POST", body: { action } },
    ),
};

export type CommunicationTemplateItem = {
  id: string;
  code: string;
  name: string;
  channel: string;
  plugin: string;
  message_type: string;
  body: string;
  approval_status: string;
  dlt_reference: string | null;
  vendors_using: number;
  messages_sent_month: number;
  variable_map: { index: number; label: string }[];
  meta: Record<string, unknown>;
  submitted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CommunicationTemplateSummary = {
  live: number;
  pending: number;
  sms: number;
  whatsapp: number;
  email: number;
  inapp: number;
};

export type CommunicationUsageItem = {
  id: string;
  occurred_at: string;
  vendor_name: string;
  channel: string;
  template_code: string;
  template_name: string;
  audience: string;
  sent: number;
  delivered: number | null;
  status: string;
};

export type CommunicationUsageSummary = {
  messages_this_month: number;
  sms_sent: number;
  whatsapp_sent: number;
  email_sent: number;
  inapp_sent: number;
  failed_or_opted_out: number;
  warning: string | null;
};

export type SettlementBatch = {
  id: string;
  batch_time: string;
  vendors: number | null;
  orders: number | null;
  gross: number | null;
  deductions: number | null;
  net: number | null;
  status: string;
  utr: string | null;
  batch_date: string;
};

export type SettlementDashboard = {
  period: string;
  zone: string;
  as_of: string;
  live: boolean;
  escrow: {
    total: number;
    settled_queue: number;
    in_window: number;
    on_hold: number;
    platform_float: number;
  };
  open_returns: number;
  in_return_window: number;
  failed_imps: number;
  batches: SettlementBatch[];
  kpis: Record<string, number | string>;
};

export type SettlementReturnCase = {
  id: string;
  order_ref: string;
  vendor_name: string;
  case_type: string;
  status: string;
  customer_claim: string;
  vendor_claim: string;
  reason_code: string;
  amount_at_stake: number;
  refund_amount: number | null;
  summary: string;
  timeline: string;
  deadline_seconds: number | null;
  chat: { kind: string; text: string }[];
  meta: Record<string, unknown>;
};

export type SettlementReturnQueue = {
  info: string;
  open_count: number;
  items: SettlementReturnCase[];
};

export type SettlementLedgerLine = {
  id: string;
  vendor_name: string;
  order_ref: string;
  order_time: string;
  items: string;
  gross: number;
  deductions: number;
  net_label: string;
  status: string;
  utr: string | null;
};

export type SettlementLedger = {
  vendor_name: string;
  vendors: string[];
  summary: {
    gross_orders: number;
    platform_commission: number;
    gst_on_commission: number;
    gateway_fee: number;
    tds: number;
    refund_adjustments: number;
    net_settled: number;
  };
  items: SettlementLedgerLine[];
};

export type SettlementTds = {
  period: string;
  kpis: {
    tds_this_month: number;
    tds_deposit_by: string;
    gst_on_commission: number;
    gst_file_by: string;
    total_commission: number;
  };
  items: {
    id: string;
    vendor_name: string;
    period: string;
    gross_paid: number;
    tds_amount: number;
    net_paid: number;
  }[];
};

export type SettlementEscrow = {
  info: string;
  kpis: {
    total_escrow: number;
    queued_for_release: number;
    in_return_window: number;
    on_hold: number;
  };
  items: {
    id: string;
    order_ref: string;
    vendor_name: string;
    delivered_at: string;
    window_closes_at: string;
    minutes_left: number | null;
    amount: number;
    status: string;
  }[];
};

export type SettlementFaults = {
  kpis: {
    faults_today: number;
    platform_absorbed: number;
    auto_resolved_pct: number;
  };
  items: {
    id: string;
    order_ref: string;
    fault_type: string;
    customer_name: string;
    refund_amount: number;
    resolved_in: string;
    vendor_impact: string;
  }[];
};

export type SettlementFraudSignal = {
  id: string;
  party_name: string;
  party_type: string;
  signal: string;
  returns_label: string;
  action_label: string;
  status: string;
};

export type SettlementFraud = {
  info: string;
  items: SettlementFraudSignal[];
};
