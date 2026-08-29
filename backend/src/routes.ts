import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

import { supabase } from "./db.js";
import {
  auth,
  role,
  AuthRequest,
} from "./middleware/auth.js";

import { calculateRisk } from "./services/riskEngine.js";
import { buildAdvisory } from "./services/advisory.js";
import {
  getMarket,
  getWeather,
} from "./services/mockData.js";

const router = Router();

const secret =
  process.env.JWT_SECRET ||
  "prototype-secret";

/* =========================================================
   TYPES
========================================================= */

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: "farmer" | "officer";
  farmer_id: string | null;
};

type FarmerRow = {
  id: string;
  user_id: string;

  name: string;

  village: string;
  district: string;
  state: string;

  block?: string | null;
  pincode?: string | null;

  latitude?: number | null;
  longitude?: number | null;

  crop: string;
  other_crops?: string | null;

  land_acres: number;

  irrigation: string;
  soil_type: string;

  phone: string;
  language: string;

  sowing_date?: string | null;
  loan_due_date: string;

  concern: string;
  created_at: string;
};

type InterventionRow = {
  id: string;
  farmer_id: string;
  officer_id: string;
  action: string;
  note: string;
  status:
    | "pending"
    | "contacted"
    | "resolved";
  created_at: string;
};

/* =========================================================
   HELPERS
========================================================= */

function tokenFor(user: UserRow) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      farmerId:
        user.farmer_id ?? undefined,
    },
    secret,
    {
      expiresIn: "7d",
    }
  );
}

function normalizeFarmer(
  farmer: FarmerRow
) {
  return {
    ...farmer,

    userId:
      farmer.user_id,

    otherCrops:
      farmer.other_crops ?? "",

    landAcres:
      Number(farmer.land_acres),

    soilType:
      farmer.soil_type,

    loanDueDate:
      farmer.loan_due_date,

    sowingDate:
      farmer.sowing_date ?? null,

    createdAt:
      farmer.created_at,
  };
}

function normalizeText(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      ""
    );
}

/* =========================================================
   LOCATION COORDINATE FALLBACK
========================================================= */

async function geocodeFarmerLocation(
  farmer: FarmerRow
) {
  const existingLatitude =
    farmer.latitude !==
      null &&
    farmer.latitude !==
      undefined
      ? Number(
          farmer.latitude
        )
      : null;

  const existingLongitude =
    farmer.longitude !==
      null &&
    farmer.longitude !==
      undefined
      ? Number(
          farmer.longitude
        )
      : null;

  /*
    Prefer coordinates already stored on the farmer.
  */
  if (
    Number.isFinite(
      existingLatitude
    ) &&
    Number.isFinite(
      existingLongitude
    )
  ) {
    return {
      latitude:
        existingLatitude,

      longitude:
        existingLongitude,

      source:
        "stored",
    };
  }

  const parts = [
    farmer.village,
    farmer.block,
    farmer.district,
    farmer.state,
    farmer.pincode,
    "India",
  ].filter(
    (value) =>
      Boolean(
        String(
          value ?? ""
        ).trim()
      )
  );

  if (
    parts.length <
    3
  ) {
    return null;
  }

  const query =
    parts.join(", ");

  const url =
    "https://nominatim.openstreetmap.org/search" +
    "?format=jsonv2" +
    `&q=${encodeURIComponent(
      query
    )}` +
    "&limit=5" +
    "&addressdetails=1" +
    "&accept-language=en";

  try {
    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json",

            "User-Agent":
              "KrishiSaathi/1.0 agricultural-advisory-prototype",
          },
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `Location geocoder returned HTTP ${response.status}`
      );
    }

    const results =
      (await response.json()) as any[];

    if (
      !Array.isArray(
        results
      ) ||
      results.length ===
        0
    ) {
      return null;
    }

    const requestedState =
      normalizeText(
        farmer.state
      );

    const requestedDistrict =
      normalizeText(
        farmer.district
      );

    const requestedPincode =
      normalizeText(
        farmer.pincode
      );

    const scored =
      results
        .map(
          (item: any) => {
            const address =
              item?.address ??
              {};

            const itemState =
              normalizeText(
                address.state
              );

            const itemDistrict =
              normalizeText(
                address.state_district ??
                  address.district ??
                  address.county
              );

            const itemPincode =
              normalizeText(
                address.postcode
              );

            let score =
              0;

            if (
              requestedState &&
              itemState ===
                requestedState
            ) {
              score +=
                5;
            }

            if (
              requestedDistrict &&
              itemDistrict ===
                requestedDistrict
            ) {
              score +=
                6;
            }

            if (
              requestedPincode &&
              itemPincode ===
                requestedPincode
            ) {
              score +=
                5;
            }

            return {
              item,
              score,
            };
          }
        )
        .sort(
          (a, b) =>
            b.score -
            a.score
        );

    const best =
      scored[0]?.item;

    if (
      !best
    ) {
      return null;
    }

    const latitude =
      Number(
        best.lat
      );

    const longitude =
      Number(
        best.lon
      );

    if (
      !Number.isFinite(
        latitude
      ) ||
      !Number.isFinite(
        longitude
      )
    ) {
      return null;
    }

    return {
      latitude,
      longitude,
      source:
        "nominatim",
      displayName:
        best.display_name ??
        null,
    };
  } catch (error) {
    console.error(
      "Farmer location geocoding error:",
      error
    );

    return null;
  }
}

/* =========================================================
   RISK
========================================================= */

async function farmerRisk(
  farmer: FarmerRow
) {
  const weather =
    await getWeather(
      farmer.district,
      farmer.latitude ?? null,
      farmer.longitude ?? null
    );

  const market =
    getMarket(
      farmer.crop
    );

  const avgPrice =
    market.length > 0
      ? market.reduce(
          (sum, item) =>
            sum + item.price,
          0
        ) /
        market.length
      : 0;

  const referencePrice =
    farmer.crop === "Paddy"
      ? 2700
      : avgPrice * 1.05;

  const priceChange =
    referencePrice > 0
      ? ((avgPrice -
          referencePrice) /
          referencePrice) *
        100
      : 0;

  const loanDate =
    new Date(
      farmer.loan_due_date
    ).getTime();

  const loanDays =
    Number.isNaN(
      loanDate
    )
      ? 60
      : Math.ceil(
          (loanDate -
            Date.now()) /
            86400000
        );

  const risk =
    calculateRisk({
      rainfallDeviation:
        weather.rainfallDeviation,

      priceChange,

      loanDays,
    });

  return {
    ...risk,

    rainfallDeviation:
      Number(
        weather.rainfallDeviation.toFixed(
          1
        )
      ),

    priceChange:
      Number(
        priceChange.toFixed(
          1
        )
      ),

    loanDays,
  };
}

/* =========================================================
   HEALTH
========================================================= */

router.get(
  "/health",
  (_req, res) => {
    return res.json({
      ok: true,
      service:
        "Krishi Saathi API",
    });
  }
);

/* =========================================================
   AUTH — LOGIN
========================================================= */

router.post(
  "/auth/login",
  async (req, res) => {
    try {
      const {
        email,
        password,
      } = req.body ?? {};

      if (
        !email ||
        !password
      ) {
        return res.status(400).json({
          message:
            "Email and password are required",
        });
      }

      const {
        data: user,
        error,
      } = await supabase
        .from("users")
        .select("*")
        .ilike(
          "email",
          String(email).trim()
        )
        .maybeSingle();

      if (error) {
        console.error(
          "Login database error:",
          error
        );

        return res.status(500).json({
          message:
            "Database error",
        });
      }

      if (!user) {
        return res.status(401).json({
          message:
            "Invalid email or password",
        });
      }

      const valid =
        await bcrypt.compare(
          String(password),
          user.password_hash
        );

      if (!valid) {
        return res.status(401).json({
          message:
            "Invalid email or password",
        });
      }

      const typedUser =
        user as UserRow;

      return res.json({
        token:
          tokenFor(
            typedUser
          ),

        user: {
          id:
            typedUser.id,

          name:
            typedUser.name,

          email:
            typedUser.email,

          role:
            typedUser.role,

          farmerId:
            typedUser.farmer_id ??
            undefined,
        },
      });
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      return res.status(500).json({
        message:
          "Login failed",
      });
    }
  }
);

/* =========================================================
   AUTH — REGISTER
========================================================= */

router.post(
  "/auth/register",
  async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        ...profile
      } = req.body ?? {};

      if (
        !name ||
        !email ||
        !password
      ) {
        return res.status(400).json({
          message:
            "Name, email and password are required",
        });
      }

      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();

      const {
        data: existingUser,
        error:
          existingError,
      } = await supabase
        .from("users")
        .select("id")
        .ilike(
          "email",
          normalizedEmail
        )
        .maybeSingle();

      if (existingError) {
        console.error(
          "Registration lookup error:",
          existingError
        );

        return res.status(500).json({
          message:
            "Database error",
        });
      }

      if (existingUser) {
        return res.status(409).json({
          message:
            "An account with this email already exists",
        });
      }

      const userId =
        randomUUID();

      const farmerId =
        randomUUID();

      const passwordHash =
        await bcrypt.hash(
          String(password),
          10
        );

      const {
        error: userError,
      } = await supabase
        .from("users")
        .insert({
          id: userId,

          name:
            String(name).trim(),

          email:
            normalizedEmail,

          password_hash:
            passwordHash,

          role:
            "farmer",

          farmer_id:
            farmerId,
        });

      if (userError) {
        console.error(
          "User insert error:",
          userError
        );

        return res.status(500).json({
          message:
            "Could not create account",
        });
      }

      const parsedLatitude =
        profile.latitude !==
          undefined &&
        profile.latitude !==
          null &&
        profile.latitude !==
          ""
          ? Number(
              profile.latitude
            )
          : null;

      const parsedLongitude =
        profile.longitude !==
          undefined &&
        profile.longitude !==
          null &&
        profile.longitude !==
          ""
          ? Number(
              profile.longitude
            )
          : null;

      const safeLatitude =
        Number.isFinite(
          parsedLatitude
        )
          ? parsedLatitude
          : null;

      const safeLongitude =
        Number.isFinite(
          parsedLongitude
        )
          ? parsedLongitude
          : null;

      const defaultLoanDate =
        new Date(
          Date.now() +
            45 *
              86400000
        )
          .toISOString()
          .slice(
            0,
            10
          );

      const {
        data: farmer,
        error: farmerError,
      } = await supabase
        .from("farmers")
        .insert({
          id: farmerId,

          user_id:
            userId,

          name:
            String(name).trim(),

          village:
            String(
              profile.village ||
                ""
            ).trim(),

          district:
            String(
              profile.district ||
                ""
            ).trim(),

          state:
            String(
              profile.state ||
                "Odisha"
            ).trim(),

          block:
            profile.block
              ? String(
                  profile.block
                ).trim()
              : null,

          pincode:
            profile.pincode
              ? String(
                  profile.pincode
                ).trim()
              : null,

          latitude:
            safeLatitude,

          longitude:
            safeLongitude,

          crop:
            String(
              profile.crop ||
                "Paddy"
            ).trim(),

          /*
            Supabase column is
            other_crops.
          */
          other_crops:
            profile.othrCrops
              ? String(
                  profile.othrCrops
                ).trim()
              : null,

          land_acres:
            Number(
              profile.landAcres ||
                0
            ),

          irrigation:
            String(
              profile.irrigation ||
                "Rainfed"
            ).trim(),

          soil_type:
            String(
              profile.soilType ||
                "Loamy"
            ).trim(),

          language:
            String(
              profile.language ||
                "English"
            ).trim(),

          phone:
            String(
              profile.phone ||
                ""
            ).trim(),

          sowing_date:
            profile.sowingDate ||
            null,

          loan_due_date:
            profile.loanDueDate ||
            defaultLoanDate,

          concern:
            String(
              profile.concern ||
                "General crop advisory"
            ).trim(),

          created_at:
            new Date().toISOString(),
        })
        .select("*")
        .single();

      if (
        farmerError ||
        !farmer
      ) {
        console.error(
          "Farmer profile creation error:",
          farmerError
        );

        await supabase
          .from("users")
          .delete()
          .eq(
            "id",
            userId
          );

        return res.status(500).json({
          message:
            "Could not create farmer profile",
        });
      }

      const typedUser:
        UserRow = {
          id:
            userId,

          name:
            String(name).trim(),

          email:
            normalizedEmail,

          password_hash:
            passwordHash,

          role:
            "farmer",

          farmer_id:
            farmerId,
        };

      return res.status(201).json({
        token:
          tokenFor(
            typedUser
          ),

        user: {
          id:
            userId,

          name:
            String(name).trim(),

          email:
            normalizedEmail,

          role:
            "farmer",

          farmerId,
        },

        farmer:
          normalizeFarmer(
            farmer as FarmerRow
          ),
      });
    } catch (error) {
      console.error(
        "Registration error:",
        error
      );

      return res.status(500).json({
        message:
          "Registration failed",
      });
    }
  }
);

/* =========================================================
   LOCATION — STATES
========================================================= */

router.get(
  "/locations/states",
  async (_req, res) => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from("states")
        .select(
          "id, lgd_code, name"
        )
        .order(
          "name",
          {
            ascending:
              true,
          }
        );

      if (error) {
        console.error(
          "States lookup error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not load states",
        });
      }

      return res.json({
        states:
          data ?? [],
      });
    } catch (error) {
      console.error(
        "States route error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load states",
      });
    }
  }
);

/* =========================================================
   LOCATION — DISTRICTS
========================================================= */

router.get(
  "/locations/districts/:stateId",
  async (req, res) => {
    try {
      const stateId =
        Number(
          req.params.stateId
        );

      if (
        !Number.isInteger(
          stateId
        )
      ) {
        return res.status(400).json({
          message:
            "Valid state ID is required",
        });
      }

      const {
        data,
        error,
      } = await supabase
        .from("districts")
        .select(
          "id, lgd_code, name"
        )
        .eq(
          "state_id",
          stateId
        )
        .order(
          "name",
          {
            ascending:
              true,
          }
        );

      if (error) {
        console.error(
          "District lookup error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not load districts",
        });
      }

      return res.json({
        districts:
          data ?? [],
      });
    } catch (error) {
      console.error(
        "District route error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load districts",
      });
    }
  }
);

/* =========================================================
   LOCATION — BLOCKS
========================================================= */

router.get(
  "/locations/blocks/:districtId",
  async (req, res) => {
    try {
      const districtId =
        Number(
          req.params.districtId
        );

      if (
        !Number.isInteger(
          districtId
        )
      ) {
        return res.status(400).json({
          message:
            "Valid district ID is required",
        });
      }

      const {
        data,
        error,
      } = await supabase
        .from("blocks")
        .select(
          "id, lgd_code, name"
        )
        .eq(
          "district_id",
          districtId
        )
        .order(
          "name",
          {
            ascending:
              true,
          }
        );

      if (error) {
        console.error(
          "Block lookup error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not load blocks",
        });
      }

      return res.json({
        blocks:
          data ?? [],
      });
    } catch (error) {
      console.error(
        "Block route error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load blocks",
      });
    }
  }
);

/* =========================================================
   LOCATION — GPS REVERSE GEOCODING
========================================================= */

router.get(
  "/locations/reverse",
  async (req, res) => {
    try {
      const latitude =
        Number(
          req.query.latitude
        );

      const longitude =
        Number(
          req.query.longitude
        );

      if (
        !Number.isFinite(
          latitude
        ) ||
        !Number.isFinite(
          longitude
        )
      ) {
        return res.status(400).json({
          message:
            "Valid latitude and longitude are required",
        });
      }

      if (
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return res.status(400).json({
          message:
            "Latitude or longitude is out of range",
        });
      }

      const url =
        "https://nominatim.openstreetmap.org/reverse" +
        "?format=jsonv2" +
        `&lat=${encodeURIComponent(
          latitude
        )}` +
        `&lon=${encodeURIComponent(
          longitude
        )}` +
        "&zoom=14" +
        "&addressdetails=1" +
        "&accept-language=en";

      const response =
        await fetch(
          url,
          {
            method:
              "GET",

            headers: {
              Accept:
                "application/json",

              "User-Agent":
                "KrishiSaathi/1.0 agricultural-advisory-prototype",
            },
          }
        );

      if (!response.ok) {
        throw new Error(
          `Nominatim reverse geocoding failed: ${response.status}`
        );
      }

      const result =
        (await response.json()) as any;

      const address =
        result?.address ??
        {};

      return res.json({
        location: {
          latitude,
          longitude,

          state:
            address.state ??
            null,

          district:
            address.state_district ??
            address.district ??
            address.county ??
            null,

          /*
            NEVER treat suburb, neighbourhood,
            city_district etc. as an LGD block.
          */
          block:
            null,

          village:
            address.village ??
            address.hamlet ??
            address.town ??
            address.city ??
            address.municipality ??
            null,

          postcode:
            address.postcode ??
            null,

          displayName:
            result?.display_name ??
            null,
        },
      });
    } catch (error) {
      console.error(
        "Reverse geocoding error:",
        error
      );

      return res.status(502).json({
        message:
          "Could not determine your location",
      });
    }
  }
);

/* =========================================================
   LOCATION — MANUAL FORWARD GEOCODING
========================================================= */

router.get(
  "/locations/geocode",
  async (req, res) => {
    try {
      const state =
        String(
          req.query.state ??
            ""
        ).trim();

      const district =
        String(
          req.query.district ??
            ""
        ).trim();

      const block =
        String(
          req.query.block ??
            ""
        ).trim();

      const village =
        String(
          req.query.village ??
            ""
        ).trim();

      const pincode =
        String(
          req.query.pincode ??
            ""
        ).trim();

      if (
        !state ||
        !district
      ) {
        return res.status(400).json({
          message:
            "State and district are required",
        });
      }

      const query =
        [
          village,
          block,
          district,
          state,
          pincode,
          "India",
        ]
          .filter(Boolean)
          .join(", ");

      const url =
        "https://nominatim.openstreetmap.org/search" +
        "?format=jsonv2" +
        `&q=${encodeURIComponent(
          query
        )}` +
        "&limit=5" +
        "&addressdetails=1" +
        "&accept-language=en";

      const response =
        await fetch(
          url,
          {
            method:
              "GET",

            headers: {
              Accept:
                "application/json",

              "User-Agent":
                "KrishiSaathi/1.0 agricultural-advisory-prototype",
            },
          }
        );

      if (!response.ok) {
        throw new Error(
          `Nominatim forward geocoding failed: ${response.status}`
        );
      }

      const results =
        (await response.json()) as any[];

      if (
        !Array.isArray(
          results
        ) ||
        results.length ===
          0
      ) {
        return res.status(404).json({
          message:
            "No matching location was found",
        });
      }

      const scored =
        results
          .map(
            (item) => {
              const address =
                item?.address ??
                {};

              const itemState =
                normalizeText(
                  address.state
                );

              const itemDistrict =
                normalizeText(
                  address.state_district ??
                    address.district ??
                    address.county
                );

              const itemPincode =
                normalizeText(
                  address.postcode
                );

              let score =
                0;

              if (
                itemState ===
                normalizeText(
                  state
                )
              ) {
                score +=
                  5;
              }

              if (
                itemDistrict ===
                normalizeText(
                  district
                )
              ) {
                score +=
                  6;
              }

              if (
                pincode &&
                itemPincode ===
                  normalizeText(
                    pincode
                  )
              ) {
                score +=
                  5;
              }

              return {
                item,
                score,
              };
            }
          )
          .sort(
            (a, b) =>
              b.score -
              a.score
          );

      const best =
        scored[0]?.item;

      if (!best) {
        return res.status(404).json({
          message:
            "No matching location was found",
        });
      }

      const address =
        best.address ??
        {};

      return res.json({
        location: {
          latitude:
            Number(
              best.lat
            ),

          longitude:
            Number(
              best.lon
            ),

          state:
            address.state ??
            null,

          district:
            address.state_district ??
            address.district ??
            address.county ??
            null,

          postcode:
            address.postcode ??
            null,

          displayName:
            best.display_name ??
            null,
        },

        confidence:
          scored[0]?.score ??
          0,
      });
    } catch (error) {
      console.error(
        "Forward geocoding error:",
        error
      );

      return res.status(502).json({
        message:
          "Could not verify this location",
      });
    }
  }
);

/* =========================================================
   FARMER PROFILE
========================================================= */

router.get(
  "/farmers/me",
  auth,
  role("farmer"),
  async (
    req: AuthRequest,
    res
  ) => {
    try {
      const farmerId =
        req.user?.farmerId;

      if (!farmerId) {
        return res.status(404).json({
          message:
            "Farmer profile not found",
        });
      }

      const {
        data: farmer,
        error,
      } = await supabase
        .from("farmers")
        .select("*")
        .eq(
          "id",
          farmerId
        )
        .maybeSingle();

      if (error) {
        console.error(
          "Farmer profile error:",
          error
        );

        return res.status(500).json({
          message:
            "Database error",
        });
      }

      if (!farmer) {
        return res.status(404).json({
          message:
            "Farmer profile not found",
        });
      }

      let farmerForResponse =
        farmer as FarmerRow;

      const coordinates =
        await geocodeFarmerLocation(
          farmerForResponse
        );

      if (
        coordinates &&
        coordinates.source ===
          "nominatim"
      ) {
        const {
          data: updatedFarmer,
          error:
            updateError,
        } = await supabase
          .from("farmers")
          .update({
            latitude:
              coordinates.latitude,

            longitude:
              coordinates.longitude,
          })
          .eq(
            "id",
            farmerForResponse.id
          )
          .select("*")
          .single();

        if (
          updateError
        ) {
          console.warn(
            "Could not persist recovered farmer coordinates:",
            updateError.message
          );
        } else if (
          updatedFarmer
        ) {
          farmerForResponse =
            updatedFarmer as FarmerRow;
        }
      }

      return res.json({
        farmer:
          normalizeFarmer(
            farmerForResponse
          ),
      });
    } catch (error) {
      console.error(
        "Farmer profile route error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load farmer profile",
      });
    }
  }
);

/* =========================================================
   FARMER BY ID
========================================================= */

router.get(
  "/farmers/:id",
  auth,
  async (
    req: AuthRequest,
    res
  ) => {
    try {
      const {
        data: farmer,
        error,
      } = await supabase
        .from("farmers")
        .select("*")
        .eq(
          "id",
          req.params.id
        )
        .maybeSingle();

      if (error) {
        console.error(
          "Farmer lookup error:",
          error
        );

        return res.status(500).json({
          message:
            "Database error",
        });
      }

      if (!farmer) {
        return res.status(404).json({
          message:
            "Farmer not found",
        });
      }

      if (
        req.user?.role ===
          "farmer" &&
        req.user.farmerId !==
          farmer.id
      ) {
        return res.status(403).json({
          message:
            "Not allowed",
        });
      }

      let farmerForResponse =
        farmer as FarmerRow;

      const coordinates =
        await geocodeFarmerLocation(
          farmerForResponse
        );

      if (
        coordinates &&
        coordinates.source ===
          "nominatim"
      ) {
        const {
          data: updatedFarmer,
          error:
            updateError,
        } = await supabase
          .from("farmers")
          .update({
            latitude:
              coordinates.latitude,

            longitude:
              coordinates.longitude,
          })
          .eq(
            "id",
            farmerForResponse.id
          )
          .select("*")
          .single();

        if (
          updateError
        ) {
          console.warn(
            "Could not persist recovered farmer coordinates:",
            updateError.message
          );
        } else if (
          updatedFarmer
        ) {
          farmerForResponse =
            updatedFarmer as FarmerRow;
        }
      }

      const normalized =
        normalizeFarmer(
          farmerForResponse
        );

      return res.json({
        farmer:
          normalized,

        risk:
          await farmerRisk(
            farmerForResponse
          ),
      });
    } catch (error) {
      console.error(
        "Farmer lookup route error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load farmer",
      });
    }
  }
);

/* =========================================================
   ADVISORY
========================================================= */

router.get(
  "/advisory/:farmerId",
  auth,
  async (
    req: AuthRequest,
    res
  ) => {
    try {
      const {
        data: farmer,
        error,
      } = await supabase
        .from("farmers")
        .select("*")
        .eq(
          "id",
          req.params.farmerId
        )
        .maybeSingle();

      if (error) {
        console.error(
          "Advisory lookup error:",
          error
        );

        return res.status(500).json({
          message:
            "Database error",
        });
      }

      if (!farmer) {
        return res.status(404).json({
          message:
            "Farmer not found",
        });
      }

      if (
        req.user?.role ===
          "farmer" &&
        req.user.farmerId !==
          farmer.id
      ) {
        return res.status(403).json({
          message:
            "Not allowed",
        });
      }

      return res.json({
        advisory:
          buildAdvisory(
            normalizeFarmer(
              farmer as FarmerRow
            )
          ),
      });
    } catch (error) {
      console.error(
        "Advisory route error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load advisory",
      });
    }
  }
);

/* =========================================================
   WEATHER
========================================================= */

router.get(
  "/weather/:district",
  auth,
  async (
    req,
    res
  ) => {
    try {
      const district =
        String(
          req.params.district
        );

      const latitudeValue =
        req.query.latitude !==
          undefined
          ? Number(
              req.query.latitude
            )
          : null;

      const longitudeValue =
        req.query.longitude !==
          undefined
          ? Number(
              req.query.longitude
            )
          : null;

      const latitude =
        Number.isFinite(
          latitudeValue
        )
          ? latitudeValue
          : null;

      const longitude =
        Number.isFinite(
          longitudeValue
        )
          ? longitudeValue
          : null;

      const weather =
        await getWeather(
          district,
          latitude,
          longitude
        );

      return res.json({
        weather,
      });
    } catch (error) {
      console.error(
        "Weather route error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load weather",
      });
    }
  }
);

/* =========================================================
   MARKET
========================================================= */

router.get(
  "/market/:crop",
  auth,
  (
    req,
    res
  ) => {
    try {
      const crop =
        String(
          req.params.crop
        );

      return res.json({
        crop,
        markets:
          getMarket(
            crop
          ),
      });
    } catch (error) {
      console.error(
        "Market route error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load market data",
      });
    }
  }
);

/* =========================================================
   RISK
========================================================= */

router.get(
  "/risk/:farmerId",
  auth,
  async (
    req: AuthRequest,
    res
  ) => {
    try {
      const {
        data: farmer,
        error,
      } = await supabase
        .from("farmers")
        .select("*")
        .eq(
          "id",
          req.params.farmerId
        )
        .maybeSingle();

      if (error) {
        console.error(
          "Risk farmer lookup error:",
          error
        );

        return res.status(500).json({
          message:
            "Database error",
        });
      }

      if (!farmer) {
        return res.status(404).json({
          message:
            "Farmer not found",
        });
      }

      if (
        req.user?.role ===
          "farmer" &&
        req.user.farmerId !==
          farmer.id
      ) {
        return res.status(403).json({
          message:
            "Not allowed",
        });
      }

      return res.json({
        risk:
          await farmerRisk(
            farmer as FarmerRow
          ),
      });
    } catch (error) {
      console.error(
        "Risk route error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not calculate risk",
      });
    }
  }
);

/* =========================================================
   CHAT
========================================================= */

router.post(
  "/chat",
  async (
    req,
    res
  ) => {
    try {
      const {
        message,
        history = [],
        context = {},
      } = req.body ?? {};

      const cleanMessage =
        String(
          message || ""
        )
          .trim()
          .slice(
            0,
            1200
          );

      if (!cleanMessage) {
        return res.status(400).json({
          message:
            "Please enter a question.",
        });
      }

      const farmer =
        context?.farmer ??
        {};

      const language =
        farmer.language ||
        "English";

      const systemInstruction =
        `You are Krishi Saathi AI, a practical and friendly agricultural assistant for Indian farmers.

Answer in the farmer's preferred language when possible (${language}).

You may answer:
- farming questions
- crop questions
- weather questions
- mandi/market questions
- government-scheme questions
- loan/risk questions
- ordinary general questions

For farming questions:
1. Use the supplied farmer context when relevant.
2. Give practical, understandable steps.
3. Do not invent live weather, mandi prices, scheme eligibility or official deadlines.
4. When live information is unavailable, clearly say that it may be demo/sample information.
5. For disease/pesticide questions, avoid overconfident diagnosis and encourage local agricultural expertise before chemical use.
6. Do not claim to be a government official.
7. Do not refuse ordinary questions simply because they are unrelated to agriculture.

Farmer context:
${JSON.stringify({
  name:
    farmer.name,

  village:
    farmer.village,

  district:
    farmer.district,

  state:
    farmer.state,

  block:
    farmer.block,

  crop:
    farmer.crop,

  otherCrops:
    farmer.otherCrops,

  landAcres:
    farmer.landAcres,

  irrigation:
    farmer.irrigation,

  soilType:
    farmer.soilType,

  language:
    farmer.language,

  concern:
    farmer.concern,

  risk:
    context?.risk,

  weather:
    context?.weather,

  market:
    Array.isArray(
      context?.market
    )
      ? context.market.slice(
          0,
          6
        )
      : context?.market,
})}`;

      const fallback =
        `I can help with ${
          farmer.crop ||
          "your crop"
        }, weather, mandi prices, crop care, government schemes and farm risk. I can also answer general questions.`;

      if (
        !process.env
          .GEMINI_API_KEY
      ) {
        return res.json({
          reply:
            fallback,

          source:
            "demo",
        });
      }

      try {
        const model =
          process.env
            .GEMINI_MODEL ||
          "gemini-3.5-flash-lite";

        const recent =
          Array.isArray(
            history
          )
            ? history
                .slice(-8)
                .map(
                  (
                    item: any
                  ) => ({
                    role:
                      item.role ===
                      "assistant"
                        ? "model"
                        : "user",

                    parts: [
                      {
                        text: String(
                          item.content ||
                            ""
                        ).slice(
                          0,
                          1200
                        ),
                      },
                    ],
                  })
                )
            : [];

        recent.push({
          role:
            "user",

          parts: [
            {
              text:
                cleanMessage,
            },
          ],
        });

        const response =
          await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
              model
            )}:generateContent`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",

                "x-goog-api-key":
                  process.env
                    .GEMINI_API_KEY!,
              },

              body: JSON.stringify({
                systemInstruction:
                  {
                    parts: [
                      {
                        text:
                          systemInstruction,
                      },
                    ],
                  },

                contents:
                  recent,

                generationConfig:
                  {
                    maxOutputTokens: 700,

                    temperature:
                      0.4,
                  },
              }),
            }
          );

        const result =
          (await response.json()) as any;

        if (!response.ok) {
          throw new Error(
            result?.error
              ?.message ||
              `Gemini request failed (${response.status})`
          );
        }

        const reply =
          String(
            result
              ?.candidates?.[0]
              ?.content?.parts
              ?.map(
                (part: any) =>
                  part.text ||
                  ""
              )
              .join(
                " "
              ) ||
              ""
          ).trim();

        return res.json({
          reply:
            reply ||
            fallback,

          source:
            "gemini",
        });
      } catch (error) {
        console.error(
          "Gemini chat error:",
          error
        );

        return res.json({
          reply:
            "I'm having trouble reaching the AI service right now. " +
            fallback,

          source:
            "demo-fallback",
        });
      }
    } catch (error) {
      console.error(
        "Chat route error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not process chat request",
      });
    }
  }
);

/* =========================================================
   OFFICER ALERTS
========================================================= */

router.get(
  "/officer/alerts",
  auth,
  role("officer"),
  async (
    _req,
    res
  ) => {
    try {
      const {
        data: farmers,
        error,
      } = await supabase
        .from("farmers")
        .select("*");

      if (error) {
        console.error(
          "Officer alerts error:",
          error
        );

        return res.status(500).json({
          message:
            "Database error",
        });
      }

      const alerts =
        await Promise.all(
          (
            farmers ??
            []
          ).map(
            async (
              farmer: FarmerRow
            ) => {
              let farmerForRisk =
                farmer;

              const coordinates =
                await geocodeFarmerLocation(
                  farmer
                );

              if (
                coordinates &&
                coordinates.source ===
                  "nominatim"
              ) {
                farmerForRisk = {
                  ...farmer,
                  latitude:
                    coordinates.latitude,
                  longitude:
                    coordinates.longitude,
                };
              }

              return {
                farmer:
                  normalizeFarmer(
                    farmerForRisk
                  ),

                risk:
                  await farmerRisk(
                    farmerForRisk
                  ),
              };
            }
          )
        );

      alerts.sort(
        (a, b) =>
          b.risk.score -
          a.risk.score
      );

      return res.json({
        alerts,
      });
    } catch (error) {
      console.error(
        "Officer alerts route error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load alerts",
      });
    }
  }
);

/* =========================================================
   CREATE INTERVENTION
========================================================= */

router.post(
  "/officer/interventions",
  auth,
  role("officer"),
  async (
    req: AuthRequest,
    res
  ) => {
    try {
      const {
        farmerId,
        action,
        note,
      } = req.body ?? {};

      if (
        !farmerId ||
        !action
      ) {
        return res.status(400).json({
          message:
            "farmerId and action are required",
        });
      }

      const intervention = {
        id:
          randomUUID(),

        farmer_id:
          String(
            farmerId
          ),

        officer_id:
          req.user!.id,

        action:
          String(
            action
          ),

        note:
          String(
            note || ""
          ),

        status:
          action ===
          "Mark reviewed"
            ? "resolved"
            : "contacted",

        created_at:
          new Date().toISOString(),
      };

      const {
        data,
        error,
      } = await supabase
        .from(
          "interventions"
        )
        .insert(
          intervention
        )
        .select("*")
        .single();

      if (
        error ||
        !data
      ) {
        console.error(
          "Intervention insert error:",
          error
        );

        return res.status(500).json({
          message:
            "Could not create intervention",
        });
      }

      const row =
        data as InterventionRow;

      return res
        .status(201)
        .json({
          intervention: {
            id:
              row.id,

            farmerId:
              row.farmer_id,

            officerId:
              row.officer_id,

            action:
              row.action,

            note:
              row.note,

            status:
              row.status,

            createdAt:
              row.created_at,
          },
        });
    } catch (error) {
      console.error(
        "Intervention route error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not create intervention",
      });
    }
  }
);

/* =========================================================
   GET INTERVENTIONS
========================================================= */

router.get(
  "/officer/interventions/:farmerId",
  auth,
  role("officer"),
  async (
    req,
    res
  ) => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from(
          "interventions"
        )
        .select("*")
        .eq(
          "farmer_id",
          req.params.farmerId
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        );

      if (error) {
        console.error(
          "Intervention history error:",
          error
        );

        return res.status(500).json({
          message:
            "Database error",
        });
      }

      const interventions =
        (
          data ??
          []
        ).map(
          (
            item: InterventionRow
          ) => ({
            id:
              item.id,

            farmerId:
              item.farmer_id,

            officerId:
              item.officer_id,

            action:
              item.action,

            note:
              item.note,

            status:
              item.status,

            createdAt:
              item.created_at,
          })
        );

      return res.json({
        interventions,
      });
    } catch (error) {
      console.error(
        "Intervention history route error:",
        error
      );

      return res.status(500).json({
        message:
          "Could not load interventions",
      });
    }
  }
);

export default router;
