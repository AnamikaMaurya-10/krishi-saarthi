const BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:4000/api";

/* =========================================================
   TYPES
========================================================= */

export type LocationItem = {
  id: string | number;
  lgd_code?: number;
  name: string;
};

export type ManualLocation = {
  state: string;
  district: string;
  block: string;
  village: string;
  pincode?: string;
};

export type ChatPayload = {
  message: string;
  history?: Array<{
    role: "assistant" | "user";
    content: string;
  }>;
  context?: any;
};

/* =========================================================
   COMMON REQUEST HELPER
========================================================= */

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    localStorage.getItem("ks_token");

  const headers =
    new Headers(options.headers);

  /*
    Only set JSON content type when we are
    actually sending a request body.
  */
  if (options.body) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `${BASE}${path}`,
      {
        ...options,
        headers,
      }
    );
  } catch (error) {
    console.error(
      "API network error:",
      error
    );

    throw new Error(
      "Failed to connect to the Krishi Saathi backend. Please make sure the backend is running."
    );
  }

  const data =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed (${response.status})`
    );
  }

  return data as T;
}

/* =========================================================
   API
========================================================= */

export const api = {
  /* -------------------------------------------------------
     AUTH
  ------------------------------------------------------- */

  login: (
    email: string,
    password: string
  ) =>
    request<any>(
      "/auth/login",
      {
        method: "POST",

        body: JSON.stringify({
          email,
          password,
        }),
      }
    ),

  register: (
    payload: any
  ) =>
    request<any>(
      "/auth/register",
      {
        method: "POST",

        body: JSON.stringify(
          payload
        ),
      }
    ),

  /* -------------------------------------------------------
     FARMER
  ------------------------------------------------------- */

  me: () =>
    request<any>(
      "/farmers/me"
    ),

  farmer: (
    id: string
  ) =>
    request<any>(
      `/farmers/${encodeURIComponent(
        id
      )}`
    ),

  advisory: (
    id: string
  ) =>
    request<any>(
      `/advisory/${encodeURIComponent(
        id
      )}`
    ),

  /* -------------------------------------------------------
     WEATHER
  ------------------------------------------------------- */

  weather: (
    district: string,
    latitude?: number | null,
    longitude?: number | null
  ) => {
    const params =
      new URLSearchParams();

    if (
      latitude !==
        null &&
      latitude !==
        undefined &&
      Number.isFinite(
        latitude
      )
    ) {
      params.set(
        "latitude",
        String(latitude)
      );
    }

    if (
      longitude !==
        null &&
      longitude !==
        undefined &&
      Number.isFinite(
        longitude
      )
    ) {
      params.set(
        "longitude",
        String(longitude)
      );
    }

    const query =
      params.toString();

    return request<any>(
      `/weather/${encodeURIComponent(
        district
      )}${
        query
          ? `?${query}`
          : ""
      }`
    );
  },

  /* -------------------------------------------------------
     MARKET
  ------------------------------------------------------- */

  market: (
    crop: string
  ) =>
    request<any>(
      `/market/${encodeURIComponent(
        crop
      )}`
    ),

  /* -------------------------------------------------------
     RISK
  ------------------------------------------------------- */

  risk: (
    id: string
  ) =>
    request<any>(
      `/risk/${encodeURIComponent(
        id
      )}`
    ),

  /* -------------------------------------------------------
     LOCATION
  ------------------------------------------------------- */

  locations: {
    /*
      GET /api/locations/states
    */
    states: () =>
      request<{
        states: LocationItem[];
      }>(
        "/locations/states"
      ),

    /*
      GET /api/locations/districts/:stateId
    */
    districts: (
      stateId:
        | string
        | number
    ) =>
      request<{
        districts: LocationItem[];
      }>(
        `/locations/districts/${encodeURIComponent(
          String(stateId)
        )}`
      ),

    /*
      GET /api/locations/blocks/:districtId
    */
    blocks: (
      districtId:
        | string
        | number
    ) =>
      request<{
        blocks: LocationItem[];
      }>(
        `/locations/blocks/${encodeURIComponent(
          String(districtId)
        )}`
      ),

    /*
      GET /api/locations/reverse
    */
    reverse: (
      latitude: number,
      longitude: number
    ) => {
      const params =
        new URLSearchParams({
          latitude:
            String(latitude),

          longitude:
            String(longitude),
        });

      return request<any>(
        `/locations/reverse?${params.toString()}`
      );
    },

    /*
      GET /api/locations/geocode

      IMPORTANT:
      The backend route is GET, not POST.
      Query parameters are used so this
      matches backend/src/routes.ts exactly.
    */
    geocode: (
      location: ManualLocation
    ) => {
      const params =
        new URLSearchParams({
          state:
            String(
              location.state ||
                ""
            ),

          district:
            String(
              location.district ||
                ""
            ),

          block:
            String(
              location.block ||
                ""
            ),

          village:
            String(
              location.village ||
                ""
            ),

          pincode:
            String(
              location.pincode ||
                ""
            ),
        });

      return request<any>(
        `/locations/geocode?${params.toString()}`
      );
    },
  },

  /*
    Compatibility alias used by some
    existing App.tsx versions.
  */
  reverseLocation: (
    latitude: number,
    longitude: number
  ) => {
    const params =
      new URLSearchParams({
        latitude:
          String(latitude),

        longitude:
          String(longitude),
      });

    return request<any>(
      `/locations/reverse?${params.toString()}`
    );
  },

  /* -------------------------------------------------------
     OFFICER
  ------------------------------------------------------- */

  alerts: () =>
    request<any>(
      "/officer/alerts"
    ),

  intervention: (
    payload: {
      farmerId: string;
      action: string;
      note?: string;
    }
  ) =>
    request<any>(
      "/officer/interventions",
      {
        method: "POST",

        body: JSON.stringify(
          payload
        ),
      }
    ),

  interventions: (
    farmerId: string
  ) =>
    request<any>(
      `/officer/interventions/${encodeURIComponent(
        farmerId
      )}`
    ),

  /* -------------------------------------------------------
     CHAT
  ------------------------------------------------------- */

  chat: (
    payload: ChatPayload
  ) =>
    request<any>(
      "/chat",
      {
        method: "POST",

        body: JSON.stringify(
          payload
        ),
      }
    ),
};
