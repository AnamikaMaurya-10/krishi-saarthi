import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  CloudRain,
  IndianRupee,
  Leaf,
  LogOut,
  MapPin,
  Phone,
  ShieldCheck,
  Sprout,
  TrendingDown,
  TrendingUp,
  UserRound,
  Volume2,
  X,
  Activity,
  Send,
  Mic,
  Sparkles,
  MessageCircle,
  ChevronDown,
} from "lucide-react";

import { api } from "./api";

/* =========================================================
   TYPES
========================================================= */

type User = {
  id: string;
  name: string;
  email: string;
  role: "farmer" | "officer";
  farmerId?: string;
};

type Farmer = {
  id: string;
  userId?: string;
  name: string;
  village: string;
  district: string;
  state: string;
  block?: string;
  pincode?: string;
  crop: string;
  othrCrops?: string;
  landAcres: number;
  irrigation: string;
  soilType: string;
  language: string;
  phone: string;
  sowingDate?: string;
  loanDueDate: string;
  concern: string;
  latitude?: number | null;
  longitude?: number | null;
};

type Risk = {
  score: number;
  level: string;
  factors: {
    rainfall: number;
    market: number;
    loan: number;
  };
  rainfallDeviation: number;
  priceChange: number;
  loanDays: number;
};

type LocationItem = {
  id: string | number;
  lgd_code?: number;
  name: string;
};

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

type WeatherData = {
  rainfallNext24h: number;
  warning: string;
  temperature: number;
  condition: string;
};

/* =========================================================
   LOCATION API
   These endpoints need to be added to the backend routes.ts:
     GET /api/locations/states
     GET /api/locations/districts/:stateId
     GET /api/locations/blocks/:districtId

   Village is intentionally NOT database-driven for now.
========================================================= */

const BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:4000/api";

async function locationRequest<T>(
  path: string
): Promise<T> {
  const response = await fetch(
    `${BASE}${path}`
  );

  const data =
    await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Location request failed: ${response.status}`
    );
  }

  return data;
}

const locationApi = {
  states: () =>
    locationRequest<{
      states: LocationItem[];
    }>("/locations/states"),

  districts: (stateId: string) =>
    locationRequest<{
      districts: LocationItem[];
    }>(
      `/locations/districts/${encodeURIComponent(
        stateId
      )}`
    ),

  blocks: (districtId: string) =>
    locationRequest<{
      blocks: LocationItem[];
    }>(
      `/locations/blocks/${encodeURIComponent(
        districtId
      )}`
    ),
};

/* =========================================================
   DEMO
========================================================= */

const demo = {
  farmer: {
    email: "ramesh@demo.com",
    password: "demo123",
  },

  officer: {
    email: "officer@krishisaathi.demo",
    password: "demo123",
  },
};

/* =========================================================
   APP
========================================================= */

function App() {
  const [user, setUser] =
    useState<User | null>(() => {
      try {
        const raw =
          localStorage.getItem(
            "ks_user"
          );

        return raw
          ? JSON.parse(raw)
          : null;
      } catch {
        return null;
      }
    });

  const [screen, setScreen] =
    useState<
      | "home"
      | "onboard"
      | "login"
      | "farmer"
      | "officer"
    >(
      user
        ? user.role === "officer"
          ? "officer"
          : "farmer"
        : "home"
    );

  const login = (
    loggedUser: User,
    token: string
  ) => {
    localStorage.setItem(
      "ks_token",
      token
    );

    localStorage.setItem(
      "ks_user",
      JSON.stringify(loggedUser)
    );

    setUser(loggedUser);

    setScreen(
      loggedUser.role === "officer"
        ? "officer"
        : "farmer"
    );
  };

  const logout = () => {
    localStorage.removeItem(
      "ks_token"
    );

    localStorage.removeItem(
      "ks_user"
    );

    setUser(null);
    setScreen("home");
  };

  if (screen === "home") {
    return (
      <Home
        onNew={() =>
          setScreen("onboard")
        }
        onExisting={() =>
          setScreen("login")
        }
        onOfficer={() =>
          setScreen("login")
        }
      />
    );
  }

  if (screen === "onboard") {
    return (
      <Onboarding
        onDone={login}
        onBack={() =>
          setScreen("home")
        }
      />
    );
  }

  if (screen === "login") {
    return (
      <Login
        onDone={login}
        onBack={() =>
          setScreen("home")
        }
      />
    );
  }

  if (
    screen === "farmer" &&
    user?.farmerId
  ) {
    return (
      <FarmerPortal
        user={user}
        onLogout={logout}
      />
    );
  }

  if (
    screen === "officer" &&
    user?.role === "officer"
  ) {
    return (
      <OfficerPortal
        user={user}
        onLogout={logout}
      />
    );
  }

  return (
    <Home
      onNew={() =>
        setScreen("onboard")
      }
      onExisting={() =>
        setScreen("login")
      }
      onOfficer={() =>
        setScreen("login")
      }
    />
  );
}

/* =========================================================
   HEADER
========================================================= */

function Header({
  title,
  subtitle,
  onLogout,
}: {
  title: string;
  subtitle?: string;
  onLogout: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <Leaf size={20} />
        </div>

        <div>
          <strong>
            Krishi Saathi
          </strong>

          <span>{title}</span>
        </div>
      </div>

      <div className="top-actions">
        {subtitle && (
          <span className="desktop-only">
            {subtitle}
          </span>
        )}

        <button
          className="icon-btn"
          onClick={onLogout}
          title="Logout"
          type="button"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

/* =========================================================
   HOME
========================================================= */

function Home({
  onNew,
  onExisting,
  onOfficer,
}: {
  onNew: () => void;
  onExisting: () => void;
  onOfficer: () => void;
}) {
  return (
    <div className="home">
      <KrishiMascot />

      <div className="home-nav">
        <div className="brand">
          <div className="brand-mark">
            <Leaf size={20} />
          </div>

          <strong>
            Krishi Saathi
          </strong>
        </div>

        <span>
          Smart Crop Advisory &
          Early Warning
        </span>
      </div>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <ShieldCheck size={16} />
            Built for farmers, officers &
            rural communities
          </div>

          <h1>
            Better farming decisions,
            <br />
            <em>
              before it becomes a crisis.
            </em>
          </h1>

          <p>
            Localized weather, crop,
            market and distress insights
            in one simple place — designed
            for basic smartphones and
            regional languages.
          </p>

          <div className="hero-actions">
            <button
              className="primary"
              onClick={onNew}
              type="button"
            >
              <Sprout size={19} />
              I am a new farmer
              <ArrowRight size={17} />
            </button>

            <button
              className="secondary"
              onClick={onExisting}
              type="button"
            >
              <UserRound size={18} />
              Existing farmer
            </button>
          </div>
        </div>

        <div className="hero-card">
          <div className="card-label">
            TODAY&apos;S DEMO ALERT
          </div>

          <div className="weather-orb">
            <CloudRain size={32} />
          </div>

          <h3>
            Rainfall risk detected
          </h3>

          <p>
            Sundargarh district
          </p>

          <div className="mini-metric">
            <span>Next 24h</span>
            <strong>
              34 mm
            </strong>
          </div>

          <div className="mini-metric">
            <span>
              Distress risk
            </span>

            <strong className="danger-text">
              78 / 100
            </strong>
          </div>

          <div className="alert-strip">
            <AlertTriangle size={16} />
            Officer intervention
            recommended
          </div>
        </div>
      </section>

      <section className="portal-grid">
        <PortalCard
          icon={<Sprout />}
          title="New Farmer"
          text="Answer a few simple questions and get a personalized farm profile."
          button="Create profile"
          onClick={onNew}
        />

        <PortalCard
          icon={<Activity />}
          title="Existing Farmer"
          text="Check weather, crop advice, mandi prices and your risk score."
          button="Open dashboard"
          onClick={onExisting}
        />

        <PortalCard
          icon={<ShieldCheck />}
          title="Agriculture Officer"
          text="View high-risk farmers and coordinate timely intervention."
          button="Officer portal"
          onClick={onOfficer}
        />
      </section>

      <footer>
        Prototype • Sample district data •
        API & ML integrations
      </footer>
    </div>
  );
}

/* =========================================================
   PORTAL CARD
========================================================= */

function PortalCard({
  icon,
  title,
  text,
  button,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  button: string;
  onClick: () => void;
}) {
  return (
    <div className="portal-card">
      <div className="portal-icon">
        {icon}
      </div>

      <h3>{title}</h3>

      <p>{text}</p>

      <button
        className="text-btn"
        onClick={onClick}
        type="button"
      >
        {button}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

/* =========================================================
   CHATBOT
========================================================= */

function KrishiMascot({
  farmer,
  risk,
  weather,
  market,
}: {
  farmer?: Farmer | null;
  risk?: Risk | null;
  weather?: any;
  market?: any[];
}) {
  const [open, setOpen] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [listening, setListening] =
    useState(false);

  const [messages, setMessages] =
    useState<ChatMessage[]>([
      {
        role: "assistant",
        content: farmer
          ? `Namaste ${
              farmer.name.split(" ")[0]
            }! 🌱 I’m your Krishi Saathi. Ask me anything about your ${farmer.crop}, weather, mandi prices, crop care, government schemes or farm risk.`
          : "Namaste! 🌱 I’m Krishi Saathi. Ask me anything about farming, crops, weather or government schemes.",
      },
    ]);

  const send = async (
    preset?: string
  ) => {
    const text = (
      preset !== undefined
        ? preset
        : message
    ).trim();

    if (!text || busy) {
      return;
    }

    const nextMessages = [
      ...messages,
      {
        role: "user" as const,
        content: text,
      },
    ];

    setMessages(nextMessages);
    setMessage("");
    setBusy(true);

    try {
      const response =
        await api.chat({
          message: text,
          history:
            nextMessages.slice(-8),
          context: {
            farmer,
            risk,
            weather,
            market,
          },
        });

      setMessages(
        (previous) => [
          ...previous,
          {
            role: "assistant",
            content:
              response?.reply ||
              "I couldn't generate an answer right now.",
          },
        ]
      );
    } catch (error) {
      console.error(
        "Chat error:",
        error
      );

      setMessages(
        (previous) => [
          ...previous,
          {
            role: "assistant",
            content:
              "I’m having trouble connecting right now. Please try again in a moment.",
          },
        ]
      );
    } finally {
      setBusy(false);
    }
  };

  const speak = (
    text: string
  ) => {
    if (
      !("speechSynthesis" in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(
        text
      );

    utterance.lang =
      farmer?.language === "Hindi"
        ? "hi-IN"
        : farmer?.language === "Odia"
        ? "or-IN"
        : "en-IN";

    window.speechSynthesis.speak(
      utterance
    );
  };

  const voiceInput = () => {
    const SpeechRecognition =
      (window as any)
        .SpeechRecognition ||
      (window as any)
        .webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage(
        "Voice input is not supported in this browser."
      );
      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.lang =
      farmer?.language === "Hindi"
        ? "hi-IN"
        : farmer?.language === "Odia"
        ? "or-IN"
        : "en-IN";

    recognition.interimResults =
      false;

    recognition.continuous =
      false;

    setListening(true);

    recognition.onresult = (
      event: any
    ) => {
      const transcript =
        event?.results?.[0]?.[0]
          ?.transcript || "";

      setMessage(transcript);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    try {
      recognition.start();
    } catch {
      setListening(false);
    }
  };

  return (
    <>
      <button
        className={`mascot-fab ${
          open ? "is-open" : ""
        }`}
        onClick={() =>
          setOpen(
            (previous) => !previous
          )
        }
        aria-label="Open Krishi Saathi AI"
        type="button"
      >
        <span className="mascot-bubble">
          {open ? (
            <X size={18} />
          ) : (
            <MessageCircle
              size={20}
            />
          )}
        </span>

        <span className="mascot-character">
          <span className="mascot-leaf">
            🌿
          </span>

          <span className="mascot-face">
            <i />
            <i />
            <b />
          </span>
        </span>

        {!open && (
          <span className="mascot-spark">
            <Sparkles size={13} />
          </span>
        )}
      </button>

      {open && (
        <div className="chatbot-panel">
          <div className="chatbot-head">
            <div className="chat-mascot-mini">
              <span>🌱</span>
            </div>

            <div>
              <strong>
                Krishi Saathi AI
              </strong>

              <small>
                {farmer
                  ? "Personal farm assistant"
                  : "Your farming assistant"}
              </small>
            </div>

            <button
              onClick={() =>
                setOpen(false)
              }
              aria-label="Close chatbot"
              type="button"
            >
              <ChevronDown size={18} />
            </button>
          </div>

          <div className="chatbot-status">
            <span />
            AI assistant • simple
            answers • multilingual
          </div>

          <div className="chat-messages">
            {messages.map(
              (item, index) => (
                <div
                  key={index}
                  className={`chat-msg ${item.role}`}
                >
                  <div className="chat-avatar">
                    {item.role ===
                    "assistant"
                      ? "🌾"
                      : farmer
                          ?.name?.[0] ||
                        "You"}
                  </div>

                  <div className="chat-content">
                    <span>
                      {item.content}
                    </span>

                    {item.role ===
                      "assistant" && (
                      <button
                        className="speak-mini"
                        onClick={() =>
                          speak(
                            item.content
                          )
                        }
                        title="Listen"
                        type="button"
                      >
                        <Volume2
                          size={14}
                        />
                      </button>
                    )}
                  </div>
                </div>
              )
            )}

            {busy && (
              <div className="chat-msg assistant">
                <div className="chat-avatar">
                  🌾
                </div>

                <div className="typing">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            )}
          </div>

          <div className="chat-suggestions">
            {(farmer
              ? [
                  "What should I do today?",
                  "Explain my risk",
                  "Will rain affect my crop?",
                ]
              : [
                  "How can I protect my crop?",
                  "How does risk scoring work?",
                  "Government schemes for farmers",
                ]
            ).map(
              (item) => (
                <button
                  key={item}
                  onClick={() =>
                    send(item)
                  }
                  disabled={busy}
                  type="button"
                >
                  {item}
                </button>
              )
            )}
          </div>

          <div className="chat-input-row">
            <button
              className={`chat-icon ${
                listening
                  ? "listening"
                  : ""
              }`}
              onClick={
                voiceInput
              }
              title="Voice input"
              type="button"
            >
              <Mic size={17} />
            </button>

            <input
              value={message}
              onChange={(event) =>
                setMessage(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  send();
                }
              }}
              placeholder="Ask about your farm…"
              aria-label="Ask Krishi Saathi"
              disabled={busy}
            />

            <button
              className="chat-send"
              onClick={() =>
                send()
              }
              disabled={
                !message.trim() ||
                busy
              }
              aria-label="Send"
              type="button"
            >
              <Send size={17} />
            </button>
          </div>

          <div className="chat-disclaimer">
            AI advice is a prototype.
            For serious crop or financial
            issues, contact your agriculture
            officer.
          </div>
        </div>
      )}
    </>
  );
}

/* =========================================================
   ONBOARDING
========================================================= */

function Onboarding({
  onDone,
  onBack
}: {
  onDone: (
    user: User,
    token: string
  ) => void;
  onBack: () => void;
}) {
  const [step, setStep] =
    useState(0);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  /* =======================================================
     LOCATION FLOW
  ======================================================= */

  const [locationStage, setLocationStage] =
    useState<
      "choose" |
      "detecting" |
      "review" |
      "manual" |
      "completed"
    >("choose");

  const [locationMessage, setLocationMessage] =
    useState("");

  const [detectedLocation, setDetectedLocation] =
    useState<any>(null);

  /* =======================================================
     LGD DATA
  ======================================================= */

  const [states, setStates] =
    useState<any[]>([]);

  const [districts, setDistricts] =
    useState<any[]>([]);

  const [blocks, setBlocks] =
    useState<any[]>([]);

  const [loadingStates, setLoadingStates] =
    useState(true);

  const [loadingDistricts, setLoadingDistricts] =
    useState(false);

  const [loadingBlocks, setLoadingBlocks] =
    useState(false);

  /* =======================================================
     FARMER DATA
  ======================================================= */

  const [data, setData] =
    useState<any>({
      name: "",
      email: "",
      password: "demo123",

      state: "",
      stateId: "",

      district: "",
      districtId: "",

      block: "",
      blockId: "",

      village: "",
      pincode: "",

      phone: "",

      crop: "Paddy",
      othrCrops: "",

      landAcres: 2,

      irrigation: "Rainfed",
      soilType: "Loamy",

      sowingDate: "",

      language: "English",

      loanDueDate: "",

      concern: "Weather risk",

      latitude: null,
      longitude: null
    });

  /* =======================================================
     PROFILE QUESTIONS
  ======================================================= */

  const questions: Array<{
    question: string;
    key: string;
    type: string;
    placeholder: string;
    optional?: boolean;
  }> = [
    {
      question: "What's your name?",
      key: "name",
      type: "text",
      placeholder: "e.g. Ramesh Kumar"
    },

    {
      question: "What is your phone number?",
      key: "phone",
      type: "phone",
      placeholder: "10-digit mobile number"
    },

    {
      question: "What is your main crop?",
      key: "crop",
      type: "select",
      placeholder: ""
    },

    {
      question: "Do you grow any other crops?",
      key: "othrCrops",
      type: "text",
      placeholder: "e.g. Maize, vegetables",
      optional: true
    },

    {
      question: "How much land do you cultivate?",
      key: "landAcres",
      type: "number",
      placeholder: "Acres"
    },

    {
      question: "What is your irrigation source?",
      key: "irrigation",
      type: "select",
      placeholder: ""
    },

    {
      question: "What type of soil do you have?",
      key: "soilType",
      type: "select",
      placeholder: ""
    },

    {
      question: "When did you sow your main crop?",
      key: "sowingDate",
      type: "date",
      placeholder: "",
      optional: true
    },

    {
      question: "What language should we use?",
      key: "language",
      type: "select",
      placeholder: ""
    },

    {
      question: "When is your next loan due?",
      key: "loanDueDate",
      type: "date",
      placeholder: "",
      optional: true
    },

    {
      question: "What worries you most right now?",
      key: "concern",
      type: "select",
      placeholder: ""
    },

    {
      question: "Create a login email",
      key: "email",
      type: "email",
      placeholder: "you@example.com"
    }
  ];

  const current =
    questions[step];

  /* =======================================================
     NORMAL OPTIONS
  ======================================================= */

  const options: Record<
    string,
    string[]
  > = {
    crop: [
      "Paddy",
      "Wheat",
      "Maize",
      "Cotton",
      "Vegetables",
      "Pulses",
      "Groundnut",
      "Sugarcane",
      "Other"
    ],

    irrigation: [
      "Rainfed",
      "Canal",
      "Borewell",
      "Tube well",
      "Drip irrigation",
      "Sprinkler",
      "Other"
    ],

    soilType: [
      "Alluvial",
      "Black soil",
      "Red soil",
      "Laterite",
      "Loamy",
      "Sandy",
      "Clayey",
      "Other"
    ],

    language: [
      "English",
      "Hindi",
      "Odia"
    ],

    concern: [
      "Weather risk",
      "Crop disease",
      "Market price",
      "Loan repayment",
      "Irrigation",
      "Pest attack",
      "Government scheme",
      "Other"
    ]
  };

  /* =======================================================
     LOAD STATES FROM LGD
  ======================================================= */

  useEffect(() => {
    let alive = true;

    const loadStates =
      async () => {
        try {
          setLoadingStates(true);

          const result =
            await api.locations.states();

          if (!alive) return;

          setStates(
            result?.states || []
          );
        } catch (err) {
          console.error(
            "Failed to load states:",
            err
          );

          if (alive) {
            setError(
              "Could not load state list. You can still try again."
            );
          }
        } finally {
          if (alive) {
            setLoadingStates(
              false
            );
          }
        }
      };

    loadStates();

    return () => {
      alive = false;
    };
  }, []);

  /* =======================================================
     NORMALIZE LOCATION NAMES
  ======================================================= */

  const normalizeLocationName =
    (value: unknown) =>
      String(value || "")
        .toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          ""
        );

  /* =======================================================
     LOAD DISTRICTS
  ======================================================= */

  const loadDistricts =
    async (
      stateId: string | number
    ) => {
      if (!stateId) {
        setDistricts([]);
        return;
      }

      try {
        setLoadingDistricts(
          true
        );

        const result =
          await api.locations.districts(
            stateId
          );

        setDistricts(
          result?.districts || []
        );
      } catch (err) {
        console.error(
          "Failed to load districts:",
          err
        );

        setDistricts([]);

        throw err;
      } finally {
        setLoadingDistricts(
          false
        );
      }
    };

  /* =======================================================
     LOAD BLOCKS
  ======================================================= */

  const loadBlocks =
    async (
      districtId: string | number
    ) => {
      if (!districtId) {
        setBlocks([]);
        return;
      }

      try {
        setLoadingBlocks(
          true
        );

        const result =
          await api.locations.blocks(
            districtId
          );

        setBlocks(
          result?.blocks || []
        );
      } catch (err) {
        console.error(
          "Failed to load blocks:",
          err
        );

        setBlocks([]);

        throw err;
      } finally {
        setLoadingBlocks(
          false
        );
      }
    };

  /* =======================================================
     SET STATE MANUALLY
  ======================================================= */

  const selectState =
    async (
      stateId: string
    ) => {
      const selected =
        states.find(
          (item) =>
            String(item.id) ===
            String(stateId)
        );

      setError("");

      setData(
        (previous: any) => ({
          ...previous,

          stateId:
            selected?.id
              ? String(
                  selected.id
                )
              : "",

          state:
            selected?.name || "",

          district: "",
          districtId: "",

          block: "",
          blockId: ""
        })
      );

      setDistricts([]);
      setBlocks([]);

      if (selected?.id) {
        try {
          await loadDistricts(
            selected.id
          );
        } catch {
          setError(
            "Could not load districts for this state."
          );
        }
      }
    };

  /* =======================================================
     SET DISTRICT MANUALLY
  ======================================================= */

  const selectDistrict =
    async (
      districtId: string
    ) => {
      const selected =
        districts.find(
          (item) =>
            String(item.id) ===
            String(districtId)
        );

      setError("");

      setData(
        (previous: any) => ({
          ...previous,

          districtId:
            selected?.id
              ? String(
                  selected.id
                )
              : "",

          district:
            selected?.name || "",

          block: "",
          blockId: ""
        })
      );

      setBlocks([]);

      if (selected?.id) {
        try {
          await loadBlocks(
            selected.id
          );
        } catch {
          setError(
            "Could not load blocks for this district."
          );
        }
      }
    };

  /* =======================================================
     SET BLOCK MANUALLY
  ======================================================= */

  const selectBlock =
    (
      blockId: string
    ) => {
      const selected =
        blocks.find(
          (item) =>
            String(item.id) ===
            String(blockId)
        );

      setError("");

      setData(
        (previous: any) => ({
          ...previous,

          blockId:
            selected?.id
              ? String(
                  selected.id
                )
              : "",

          block:
            selected?.name || ""
        })
      );
    };

  /* =======================================================
     DETECT LOCATION
  ======================================================= */

  const detectCurrentLocation =
    () => {
      setError("");
      setLocationMessage("");
      setLocationStage(
        "detecting"
      );

      if (
        !navigator.geolocation
      ) {
        setLocationStage(
          "manual"
        );

        setError(
          "Location is not supported by this browser. Please enter your location manually."
        );

        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const latitude =
              Number(
                position.coords.latitude.toFixed(
                  6
                )
              );

            const longitude =
              Number(
                position.coords.longitude.toFixed(
                  6
                )
              );

            setData(
              (previous: any) => ({
                ...previous,

                latitude,
                longitude
              })
            );

            const result =
              await api.locations.reverse(
                latitude,
                longitude
              );

            const location =
              result?.location;

            if (!location) {
              throw new Error(
                "No location returned"
              );
            }

            setDetectedLocation(
              location
            );

            /*
              Start with GPS-derived
              administrative information.
            */

            let detectedState =
              null;

            let detectedDistrict =
              null;

            let detectedBlock =
              null;

            /*
              ---------------------------------------------
              MATCH STATE AGAINST LGD
              ---------------------------------------------
            */

            const normalizedDetectedState =
              normalizeLocationName(
                location.state
              );

            detectedState =
              states.find(
                (item) =>
                  normalizeLocationName(
                    item.name
                  ) ===
                    normalizedDetectedState
              ) ||
              states.find(
                (item) => {
                  const a =
                    normalizeLocationName(
                      item.name
                    );

                  const b =
                    normalizedDetectedState;

                  return (
                    b &&
                    (a.includes(b) ||
                      b.includes(a))
                  );
                }
              ) ||
              null;

            /*
              ---------------------------------------------
              LOAD + MATCH DISTRICT
              ---------------------------------------------
            */

            let matchedDistricts:
              any[] = [];

            if (
              detectedState?.id
            ) {
              const districtResult =
                await api.locations.districts(
                  detectedState.id
                );

              matchedDistricts =
                districtResult?.districts ||
                [];

              setDistricts(
                matchedDistricts
              );

              const normalizedDetectedDistrict =
                normalizeLocationName(
                  location.district
                );

              detectedDistrict =
                matchedDistricts.find(
                  (item) =>
                    normalizeLocationName(
                      item.name
                    ) ===
                    normalizedDetectedDistrict
                ) ||
                matchedDistricts.find(
                  (item) => {
                    const a =
                      normalizeLocationName(
                        item.name
                      );

                    const b =
                      normalizedDetectedDistrict;

                    return (
                      b &&
                      (a.includes(b) ||
                        b.includes(a))
                    );
                  }
                ) ||
                null;
            }

            /*
              ---------------------------------------------
              LOAD + MATCH BLOCK
              ---------------------------------------------
            */

            let matchedBlocks:
              any[] = [];

            if (
              detectedDistrict?.id
            ) {
              const blockResult =
                await api.locations.blocks(
                  detectedDistrict.id
                );

              matchedBlocks =
                blockResult?.blocks ||
                [];

              setBlocks(
                matchedBlocks
              );

              const normalizedDetectedBlock =
                normalizeLocationName(
                  location.block
                );

              detectedBlock =
                matchedBlocks.find(
                  (item) =>
                    normalizeLocationName(
                      item.name
                    ) ===
                    normalizedDetectedBlock
                ) ||
                matchedBlocks.find(
                  (item) => {
                    const a =
                      normalizeLocationName(
                        item.name
                      );

                    const b =
                      normalizedDetectedBlock;

                    return (
                      b &&
                      (a.includes(b) ||
                        b.includes(a))
                    );
                  }
                ) ||
                null;
            }

            /*
              ---------------------------------------------
              APPLY SAFE MATCHES
              ---------------------------------------------
            */

            setData(
              (previous: any) => ({
                ...previous,

                stateId:
                  detectedState?.id
                    ? String(
                        detectedState.id
                      )
                    : "",

                state:
                  detectedState?.name ||
                  location.state ||
                  previous.state,

                districtId:
                  detectedDistrict?.id
                    ? String(
                        detectedDistrict.id
                      )
                    : "",

                district:
                  detectedDistrict?.name ||
                  location.district ||
                  previous.district,

                blockId:
                  detectedBlock?.id
                    ? String(
                        detectedBlock.id
                      )
                    : "",

                block:
                  detectedBlock?.name ||
                  location.block ||
                  previous.block,

                village:
                  location.village ||
                  previous.village,

                pincode:
                  location.postcode ||
                  previous.pincode,

                latitude,
                longitude
              })
            );

            setLocationMessage(
              detectedState &&
              detectedDistrict
                ? "Location detected successfully. Please review the details before continuing."
                : "GPS location detected, but some administrative details could not be matched. Please review or enter them manually."
            );

            setLocationStage(
              "review"
            );
          } catch (err) {
            console.error(
              "Location detection error:",
              err
            );

            setLocationStage(
              "manual"
            );

            setLocationMessage(
              ""
            );

            setError(
              "We detected your GPS location, but could not determine the administrative details automatically. Please enter them manually."
            );
          }
        },

        () => {
          setLocationStage(
            "manual"
          );

          setError(
            "Location permission was not granted. Please enter your location manually."
          );
        },

        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 300000
        }
      );
    };

  /* =======================================================
     SWITCH TO MANUAL
  ======================================================= */

  const enterManualLocation =
    () => {
      setError("");
      setLocationMessage("");

      setLocationStage(
        "manual"
      );
    };

  /* =======================================================
     CONFIRM DETECTED LOCATION
  ======================================================= */

  const confirmDetectedLocation =
    () => {
      setError("");

      /*
        If state/district weren't matched
        from the LGD tables, don't silently
        accept them as authoritative.
      */

      if (!data.stateId) {
        setError(
          "Please select your state before continuing."
        );

        setLocationStage(
          "manual"
        );

        return;
      }

      if (!data.districtId) {
        setError(
          "Please select your district before continuing."
        );

        setLocationStage(
          "manual"
        );

        return;
      }

      /*
        Block is intentionally allowed
        to remain blank because we decided
        block should be sufficient as a
        lower administrative level and some
        reverse geocoders may not reliably
        provide the exact LGD block.
      */

      setLocationStage(
        "review"
      );

      setStep(0);
    };

  /* =======================================================
     UPDATE NORMAL FORM DATA
  ======================================================= */

  const update =
    (
      key: string,
      value: any
    ) => {
      setData(
        (previous: any) => ({
          ...previous,
          [key]: value
        })
      );

      setError("");
    };

  /* =======================================================
     VALIDATION
  ======================================================= */

  const validate = () => {
    const key =
      current.key;

    const value =
      data[key];

    if (
      !current.optional &&
      (
        value ===
          undefined ||
        value === null ||
        String(value).trim() ===
          ""
      )
    ) {
      return "Please answer this question.";
    }

    if (
      key === "phone" &&
      value
    ) {
      if (
        !/^[6-9]\d{9}$/.test(
          String(value)
        )
      ) {
        return "Please enter a valid 10-digit Indian mobile number.";
      }
    }

    if (
      key === "landAcres"
    ) {
      const acres =
        Number(value);

      if (
        Number.isNaN(
          acres
        ) ||
        acres <= 0
      ) {
        return "Please enter a valid land area.";
      }
    }

    if (
      key === "email" &&
      value
    ) {
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          String(value)
        )
      ) {
        return "Please enter a valid email address.";
      }
    }

    return "";
  };

  /* =======================================================
     NEXT QUESTION
  ======================================================= */

  const next =
    async () => {
      setError("");

      const validationError =
        validate();

      if (validationError) {
        setError(
          validationError
        );

        return;
      }

      if (
        step <
        questions.length - 1
      ) {
        setStep(
          (
            previous
          ) =>
            previous + 1
        );

        return;
      }

      /*
        FINAL REGISTRATION
      */

      setBusy(true);

      try {
        const payload = {
          name:
            String(
              data.name
            ).trim(),

          email:
            String(
              data.email
            )
              .trim()
              .toLowerCase(),

          password:
            "demo123",

          state:
            String(
              data.state ||
                ""
            ).trim(),

          district:
            String(
              data.district ||
                ""
            ).trim(),

          block:
            String(
              data.block ||
                ""
            ).trim(),

          village:
            String(
              data.village ||
                ""
            ).trim(),

          pincode:
            String(
              data.pincode ||
                ""
            ).trim(),

          phone:
            String(
              data.phone ||
                ""
            ).trim(),

          crop:
            String(
              data.crop ||
                ""
            ).trim(),

          othrCrops:
            String(
              data.othrCrops ||
                ""
            ).trim(),

          landAcres:
            Number(
              data.landAcres
            ),

          irrigation:
            String(
              data.irrigation ||
                ""
            ).trim(),

          soilType:
            String(
              data.soilType ||
                ""
            ).trim(),

          sowingDate:
            data.sowingDate ||
            null,

          language:
            String(
              data.language ||
                "English"
            ).trim(),

          loanDueDate:
            data.loanDueDate ||
            null,

          concern:
            String(
              data.concern ||
                ""
            ).trim(),

          latitude:
            data.latitude ??
            null,

          longitude:
            data.longitude ??
            null
        };

        const response =
          await api.register(
            payload
          );

        onDone(
          response.user,
          response.token
        );
      } catch (err: any) {
        console.error(
          "Registration error:",
          err
        );

        setError(
          err?.message ||
            "Could not create your profile."
        );
      } finally {
        setBusy(false);
      }
    };

  /* =======================================================
     PREVIOUS
  ======================================================= */

  const previous =
    () => {
      setError("");

      if (step > 0) {
        setStep(
          (
            previous
          ) =>
            previous - 1
        );

        return;
      }

      /*
        At the first normal question,
        go back to location choice.
      */

      setLocationStage(
        "choose"
      );
    };

  /* =======================================================
     LOCATION SCREEN
  ======================================================= */

  if (
    locationStage ===
      "choose" ||
    locationStage ===
      "detecting" ||
    locationStage ===
      "manual" ||
    locationStage ===
      "review"
  ) {
    /*
      Show the location screen only
      until the farmer confirms it.
    */

    if (
      (
        locationStage ===
          "choose" ||
        locationStage ===
          "detecting"
      ) &&
      step === 0
    ) {
      return (
        <div className="onboarding">
          <KrishiMascot />

          <div className="simple-nav">
            <button
              className="back-btn"
              onClick={onBack}
              type="button"
            >
              ← Back
            </button>

            <div className="brand">
              <div className="brand-mark">
                <Leaf size={18} />
              </div>

              <strong>
                Krishi Saathi
              </strong>
            </div>

            <span>
              Farm location
            </span>
          </div>

          <div className="progress">
            <div
              style={{
                width:
                  "6%"
              }}
            />
          </div>

          <main className="question-card location-choice-card">
            <div className="question-icon">
              <MapPin
                size={27}
              />
            </div>

            <div className="eyebrow">
              FARM LOCATION
            </div>

            <h1>
              Where is your farm?
            </h1>

            <p className="muted">
              Use your current location
              to fill your State,
              District, Block, Village
              and Pincode automatically.
            </p>

            {locationStage ===
            "detecting" ? (
              <>
                <div className="location-loading">
                  <MapPin
                    size={22}
                  />

                  <span>
                    Detecting your
                    location…
                  </span>
                </div>

                <div className="hint">
                  Please allow location
                  access when your browser
                  asks for permission.
                </div>
              </>
            ) : (
              <>
                <button
                  className="primary full"
                  onClick={
                    detectCurrentLocation
                  }
                  type="button"
                  disabled={
                    loadingStates
                  }
                >
                  <MapPin size={18} />

                  Use my current location

                  <ArrowRight
                    size={18}
                  />
                </button>

                <button
                  className="secondary full"
                  onClick={
                    enterManualLocation
                  }
                  type="button"
                >
                  Enter location manually
                </button>

                <div className="hint">
                  Location permission is
                  optional. You can always
                  enter your location
                  yourself.
                </div>
              </>
            )}

            {error && (
              <div className="error">
                {error}
              </div>
            )}
          </main>
        </div>
      );
    }

    /*
      -------------------------------------------------------
      REVIEW / COMPLETE DETECTED LOCATION
      -------------------------------------------------------
    */

    if (
      locationStage ===
      "review"
    ) {
      const locationComplete =
        Boolean(
          data.stateId &&
          data.districtId &&
          data.blockId &&
          String(
            data.village || ""
          ).trim()
        );

      return (
        <div className="onboarding">
          <KrishiMascot />

          <div className="simple-nav">
            <button
              className="back-btn"
              onClick={() =>
                setLocationStage(
                  "choose"
                )
              }
              type="button"
            >
              ← Back
            </button>

            <div className="brand">
              <div className="brand-mark">
                <Leaf size={18} />
              </div>

              <strong>
                Krishi Saathi
              </strong>
            </div>

            <span>
              Location detected
            </span>
          </div>

          <div className="progress">
            <div
              style={{
                width:
                  "6%"
              }}
            />
          </div>

          <main className="question-card location-review-card">
            <div className="question-icon">
              <MapPin
                size={27}
              />
            </div>

            <div className="eyebrow">
              LOCATION DETECTED
            </div>

            <h1>
              Check your farm location
            </h1>

            <p className="muted">
              We filled what we could from
              your GPS location. Please complete
              anything that was not detected.
            </p>

            <div className="location-field">
              <label>
                State
              </label>

              <select
                value={
                  data.stateId
                }
                onChange={(event) =>
                  selectState(
                    event.target.value
                  )
                }
                disabled={
                  loadingStates
                }
              >
                <option value="">
                  {loadingStates
                    ? "Loading states..."
                    : "Select your state"}
                </option>

                {states.map(
                  (state) => (
                    <option
                      key={
                        state.id
                      }
                      value={
                        state.id
                      }
                    >
                      {
                        state.name
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="location-field">
              <label>
                District
              </label>

              <select
                value={
                  data.districtId
                }
                onChange={(event) =>
                  selectDistrict(
                    event.target.value
                  )
                }
                disabled={
                  !data.stateId ||
                  loadingDistricts
                }
              >
                <option value="">
                  {!data.stateId
                    ? "Select state first"
                    : loadingDistricts
                    ? "Loading districts..."
                    : "Select your district"}
                </option>

                {districts.map(
                  (district) => (
                    <option
                      key={
                        district.id
                      }
                      value={
                        district.id
                      }
                    >
                      {
                        district.name
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="location-field">
              <label>
                Block
              </label>

              <select
                value={
                  data.blockId
                }
                onChange={(event) =>
                  selectBlock(
                    event.target.value
                  )
                }
                disabled={
                  !data.districtId ||
                  loadingBlocks
                }
              >
                <option value="">
                  {!data.districtId
                    ? "Select district first"
                    : loadingBlocks
                    ? "Loading blocks..."
                    : "Select your block"}
                </option>

                {blocks.map(
                  (block) => (
                    <option
                      key={
                        block.id
                      }
                      value={
                        block.id
                      }
                    >
                      {
                        block.name
                      }
                    </option>
                  )
                )}
              </select>

              {!data.blockId && (
                <small className="field-help">
                  Your GPS location did not identify
                  an exact LGD block. Please select
                  your block from the list.
                </small>
              )}
            </div>

            <div className="location-field">
              <label>
                Village
              </label>

              <input
                type="text"
                value={
                  data.village || ""
                }
                placeholder="Enter your village"
                onChange={(event) =>
                  update(
                    "village",
                    event.target.value
                  )
                }
              />

              {!String(
                data.village || ""
              ).trim() && (
                <small className="field-help">
                  GPS could not reliably identify
                  your exact village. Please enter it.
                </small>
              )}
            </div>

            <div className="location-field">
              <label>
                Pincode
              </label>

              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={
                  data.pincode || ""
                }
                placeholder="6-digit pincode"
                onChange={(event) =>
                  update(
                    "pincode",
                    event.target.value
                      .replace(
                        /\D/g,
                        ""
                      )
                      .slice(
                        0,
                        6
                      )
                  )
                }
              />
            </div>

            {data.latitude !==
              null &&
              data.latitude !==
                undefined &&
              data.longitude !==
                null &&
              data.longitude !==
                undefined && (
                <div className="location-coordinates">
                  📍{" "}
                  {Number(
                    data.latitude
                  ).toFixed(6)}
                  ,{" "}
                  {Number(
                    data.longitude
                  ).toFixed(6)}
                </div>
              )}

            {locationMessage && (
              <div className="hint">
                {locationMessage}
              </div>
            )}

            {error && (
              <div className="error">
                {error}
              </div>
            )}

            <button
              className="primary full"
              type="button"
              onClick={() => {
                setError("");

                if (!data.stateId) {
                  setError(
                    "Please select your state."
                  );
                  return;
                }

                if (!data.districtId) {
                  setError(
                    "Please select your district."
                  );
                  return;
                }

                if (!data.blockId) {
                  setError(
                    "Please select your block."
                  );
                  return;
                }

                if (
                  !String(
                    data.village || ""
                  ).trim()
                ) {
                  setError(
                    "Please enter your village."
                  );
                  return;
                }

                if (
                  data.pincode &&
                  !/^\d{6}$/.test(
                    String(
                      data.pincode
                    )
                  )
                ) {
                  setError(
                    "Please enter a valid 6-digit pincode."
                  );
                  return;
                }

                setLocationStage(
                  "completed"
                );

                setStep(0);
              }}
            >
              {locationComplete
                ? "Confirm location"
                : "Complete location"}

              <ArrowRight
                size={18}
              />
            </button>

            <button
              className="secondary full"
              type="button"
              onClick={() =>
                setLocationStage(
                  "manual"
                )
              }
            >
              Enter location manually
            </button>
          </main>
        </div>
      );
    }

    /*
      -------------------------------------------------------
      MANUAL LOCATION
      -------------------------------------------------------
    */

    if (
      locationStage ===
      "manual"
    ) {
      return (
        <div className="onboarding">
          <KrishiMascot />

          <div className="simple-nav">
            <button
              className="back-btn"
              onClick={() =>
                setLocationStage(
                  "choose"
                )
              }
              type="button"
            >
              ← Back
            </button>

            <div className="brand">
              <div className="brand-mark">
                <Leaf size={18} />
              </div>

              <strong>
                Krishi Saathi
              </strong>
            </div>

            <span>
              Farm location
            </span>
          </div>

          <div className="progress">
            <div
              style={{
                width:
                  "6%"
              }}
            />
          </div>

          <main className="question-card location-manual-card">
            <div className="question-icon">
              <MapPin
                size={27}
              />
            </div>

            <div className="eyebrow">
              ENTER MANUALLY
            </div>

            <h1>
              Tell us where you farm
            </h1>

            <p className="muted">
              Choose the administrative
              location from the LGD database.
            </p>

            {/* STATE */}

            <label>
              State

              <select
                value={
                  data.stateId
                }
                onChange={(
                  event
                ) =>
                  selectState(
                    event.target.value
                  )
                }
                disabled={
                  loadingStates
                }
              >
                <option value="">
                  {loadingStates
                    ? "Loading states..."
                    : "Select your state"}
                </option>

                {states.map(
                  (state) => (
                    <option
                      key={
                        state.id
                      }
                      value={
                        state.id
                      }
                    >
                      {
                        state.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            {/* DISTRICT */}

            <label>
              District

              <select
                value={
                  data.districtId
                }
                onChange={(
                  event
                ) =>
                  selectDistrict(
                    event.target.value
                  )
                }
                disabled={
                  !data.stateId ||
                  loadingDistricts
                }
              >
                <option value="">
                  {!data.stateId
                    ? "Select state first"
                    : loadingDistricts
                    ? "Loading districts..."
                    : "Select your district"}
                </option>

                {districts.map(
                  (
                    district
                  ) => (
                    <option
                      key={
                        district.id
                      }
                      value={
                        district.id
                      }
                    >
                      {
                        district.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            {/* BLOCK */}

            <label>
              Block

              <select
                value={
                  data.blockId
                }
                onChange={(
                  event
                ) =>
                  selectBlock(
                    event.target.value
                  )
                }
                disabled={
                  !data.districtId ||
                  loadingBlocks
                }
              >
                <option value="">
                  {!data.districtId
                    ? "Select district first"
                    : loadingBlocks
                    ? "Loading blocks..."
                    : "Select your block"}
                </option>

                {blocks.map(
                  (block) => (
                    <option
                      key={
                        block.id
                      }
                      value={
                        block.id
                      }
                    >
                      {
                        block.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            {/* VILLAGE */}

            <label>
              Village

              <input
                type="text"
                value={
                  data.village
                }
                placeholder="e.g. Nevada"
                onChange={(event) =>
                  update(
                    "village",
                    event.target.value
                  )
                }
              />
            </label>

            {/* PINCODE */}

            <label>
              Pincode

              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={
                  data.pincode
                }
                placeholder="6-digit pincode"
                onChange={(event) =>
                  update(
                    "pincode",
                    event.target.value
                      .replace(
                        /\D/g,
                        ""
                      )
                      .slice(
                        0,
                        6
                      )
                  )
                }
              />
            </label>

            {error && (
              <div className="error">
                {error}
              </div>
            )}

            <button
              className="primary full"
              type="button"
              onClick={() => {
                setError("");

                if (
                  !data.stateId
                ) {
                  setError(
                    "Please select your state."
                  );
                  return;
                }

                if (
                  !data.districtId
                ) {
                  setError(
                    "Please select your district."
                  );
                  return;
                }

                if (
                  !data.village.trim()
                ) {
                  setError(
                    "Please enter your village."
                  );
                  return;
                }

                if (
                  data.pincode &&
                  !/^\d{6}$/.test(
                    data.pincode
                  )
                ) {
                  setError(
                    "Please enter a valid 6-digit pincode."
                  );
                  return;
                }

                setStep(0);

                setLocationStage(
                  "completed"
                );
              }}
            >
              Continue

              <ArrowRight
                size={18}
              />
            </button>
          </main>
        </div>
      );
    }
  }

  /* =======================================================
     NORMAL FARMER QUESTIONS
  ======================================================= */

  const progress =
    ((step + 1) /
      questions.length) *
    100;

  return (
    <div className="onboarding">
      <KrishiMascot />

      <div className="simple-nav">
        <button
          className="back-btn"
          onClick={previous}
          type="button"
        >
          ← Back
        </button>

        <div className="brand">
          <div className="brand-mark">
            <Leaf size={18} />
          </div>

          <strong>
            Krishi Saathi
          </strong>
        </div>

        <span>
          {step + 1} /{" "}
          {questions.length}
        </span>
      </div>

      <div className="progress">
        <div
          style={{
            width:
              `${progress}%`
          }}
        />
      </div>

      <main className="question-card">
        <div className="question-icon">
          <Sprout
            size={27}
          />
        </div>

        <div className="eyebrow">
          YOUR FARM PROFILE
        </div>

        <h1>
          {current.question}
        </h1>

        <p className="muted">
          This helps us personalize
          your advisory and distress
          score.
        </p>

        {/* NORMAL SELECT */}

        {current.type ===
          "select" && (
          <div className="option-list">
            {(
              options[
                current.key
              ] || []
            ).map(
              (option) => (
                <button
                  type="button"
                  className={
                    data[
                      current.key
                    ] ===
                    option
                      ? "option selected"
                      : "option"
                  }
                  key={
                    option
                  }
                  onClick={() =>
                    update(
                      current.key,
                      option
                    )
                  }
                >
                  {option}

                  <span>
                    {data[
                      current.key
                    ] ===
                    option
                      ? "✓"
                      : ""}
                  </span>
                </button>
              )
            )}
          </div>
        )}

        {/* TEXT / NUMBER / DATE / EMAIL / PHONE */}

        {current.type !==
          "select" && (
          <input
            autoFocus
            type={
              current.type ===
              "phone"
                ? "text"
                : current.type
            }
            inputMode={
              current.type ===
                "phone" ||
              current.type ===
                "number"
                ? "numeric"
                : current.type ===
                  "email"
                ? "email"
                : undefined
            }
            maxLength={
              current.type ===
              "phone"
                ? 10
                : undefined
            }
            min={
              current.type ===
              "number"
                ? 0.1
                : undefined
            }
            step={
              current.type ===
              "number"
                ? 0.1
                : undefined
            }
            placeholder={
              current.placeholder
            }
            value={
              data[
                current.key
              ] ?? ""
            }
            onChange={(
              event
            ) => {
              let value =
                event.target
                  .value;

              if (
                current.type ===
                "phone"
              ) {
                value =
                  value
                    .replace(
                      /\D/g,
                      ""
                    )
                    .slice(
                      0,
                      10
                    );
              }

              update(
                current.key,
                value
              );
            }}
          />
        )}

        {current.optional && (
          <div className="hint">
            This field is optional.
            You can skip it if you
            don't have the information
            right now.
          </div>
        )}

        {current.key ===
          "email" && (
          <div className="hint">
            For the prototype, your
            login password will be{" "}
            <b>demo123</b>.
          </div>
        )}

        {current.key ===
          "phone" && (
          <div className="hint">
            Your phone number can help
            an agriculture officer
            contact you during a
            high-risk situation.
          </div>
        )}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <button
          className="primary full"
          onClick={next}
          disabled={busy}
          type="button"
        >
          {busy
            ? "Creating profile…"
            : step ===
                questions.length -
                  1
              ? "Create My Farmer Profile"
              : "Continue"}

          <ArrowRight
            size={18}
          />
        </button>
      </main>
    </div>
  );
}
/* =========================================================
   LOGIN
========================================================= */

function Login({
  onDone,
  onBack,
}: {
  onDone: (
    user: User,
    token: string
  ) => void;

  onBack: () => void;
}) {
  const [email, setEmail] =
    useState(
      demo.farmer.email
    );

  const [password, setPassword] =
    useState(
      demo.farmer.password
    );

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [officerMode, setOfficerMode] =
    useState(false);

  const submit = async () => {
    if (
      !email.trim() ||
      !password.trim()
    ) {
      setError(
        "Please enter email and password."
      );

      return;
    }

    setBusy(true);
    setError("");

    try {
      const response =
        await api.login(
          email.trim(),
          password
        );

      onDone(
        response.user,
        response.token
      );
    } catch (e: any) {
      console.error(
        "Login error:",
        e
      );

      setError(
        e?.message ||
          "Login failed."
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleMode =
    () => {
      const nextMode =
        !officerMode;

      setOfficerMode(
        nextMode
      );

      const credentials =
        nextMode
          ? demo.officer
          : demo.farmer;

      setEmail(
        credentials.email
      );

      setPassword(
        credentials.password
      );

      setError("");
    };

  return (
    <div className="login-page">
      <KrishiMascot />

      <div className="simple-nav">
        <button
          className="back-btn"
          onClick={onBack}
          type="button"
        >
          ← Back
        </button>

        <div className="brand">
          <div className="brand-mark">
            <Leaf size={18} />
          </div>

          <strong>
            Krishi Saathi
          </strong>
        </div>
      </div>

      <div className="login-card">
        <div className="question-icon">
          <UserRound size={25} />
        </div>

        <div className="eyebrow">
          {officerMode
            ? "OFFICER ACCESS"
            : "FARMER ACCESS"}
        </div>

        <h1>
          Welcome back
        </h1>

        <p className="muted">
          Sign in to continue to your{" "}
          {officerMode
            ? "officer"
            : "farmer"}{" "}
          dashboard.
        </p>

        <label>
          Email

          <input
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value
              )
            }
          />
        </label>

        <label>
          Password

          <input
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value
              )
            }
            onKeyDown={(event) => {
              if (
                event.key ===
                "Enter"
              ) {
                submit();
              }
            }}
          />
        </label>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <button
          className="primary full"
          onClick={submit}
          disabled={busy}
          type="button"
        >
          {busy
            ? "Signing in..."
            : "Sign in"}

          <ArrowRight size={18} />
        </button>

        <div className="demo-login">
          <span>Demo:</span>{" "}
          {officerMode
            ? `${demo.officer.email} / demo123`
            : `${demo.farmer.email} / demo123`}
        </div>

        <button
          className="link-btn"
          onClick={
            toggleMode
          }
          type="button"
        >
          {officerMode
            ? "Use farmer login"
            : "Officer login"}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   FARMER PORTAL
========================================================= */

function FarmerPortal({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const [farmer, setFarmer] =
    useState<Farmer | null>(
      null
    );

  const [risk, setRisk] =
    useState<Risk | null>(
      null
    );

  const [weather, setWeather] =
    useState<WeatherData | null>(
      null
    );

  const [market, setMarket] =
    useState<any[]>([]);

  const [advisory, setAdvisory] =
    useState<any>(null);

  const [tab, setTab] =
    useState<
      | "overview"
      | "advisory"
      | "market"
      | "risk"
    >("overview");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let alive = true;

    const load =
      async () => {
        try {
          const profile =
            await api.me();

          if (!alive) return;

          setFarmer(
            profile.farmer
          );

          const [
            riskResult,
            weatherResult,
            marketResult,
            advisoryResult,
          ] =
            await Promise.all([
              api.risk(
                profile.farmer.id
              ),
              api.weather(
                profile.farmer.district,
                profile.farmer.latitude,
                profile.farmer.longitude
              ),
              api.market(
                profile.farmer.crop
              ),
              api.advisory(
                profile.farmer.id
              ),
            ]);

          if (!alive) return;

          setRisk(
            riskResult.risk
          );

          setWeather(
            weatherResult.weather
          );

          setMarket(
            marketResult.markets ||
              []
          );

          setAdvisory(
            advisoryResult.advisory
          );
        } catch (e: any) {
          console.error(
            "Farmer portal error:",
            e
          );

          if (alive) {
            setError(
              e?.message ||
                "Could not load farmer data."
            );
          }
        } finally {
          if (alive) {
            setLoading(false);
          }
        }
      };

    load();

    return () => {
      alive = false;
    };
  }, [user.farmerId]);

  if (loading) {
    return <Loading />;
  }

  if (
    error ||
    !farmer
  ) {
    return (
      <ErrorState
        message={error}
      />
    );
  }

  const speakAdvisory =
    () => {
      if (
        !advisory?.voiceText ||
        !("speechSynthesis" in
          window)
      ) {
        return;
      }

      window.speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(
          advisory.voiceText
        );

      utterance.lang =
        farmer.language ===
        "Hindi"
          ? "hi-IN"
          : farmer.language ===
            "Odia"
          ? "or-IN"
          : "en-IN";

      window.speechSynthesis.speak(
        utterance
      );
    };

  const prices =
    market
      .map((item) =>
        Number(item.price)
      )
      .filter(
        (value) =>
          Number.isFinite(value)
      );

  const bestPrice =
    prices.length
      ? Math.max(...prices)
      : 0;

  return (
    <div className="app-shell">
      <Header
        title="Farmer Portal"
        subtitle={`${farmer.village}, ${farmer.district}`}
        onLogout={onLogout}
      />

      <KrishiMascot
        farmer={farmer}
        risk={risk}
        weather={weather}
        market={market}
      />

      <div className="mobile-tabs">
        {[
          ["overview", "Home"],
          ["advisory", "Advice"],
          ["market", "Mandi"],
          ["risk", "Risk"],
        ].map(
          ([id, label]) => (
            <button
              key={id}
              className={
                tab === id
                  ? "active"
                  : ""
              }
              onClick={() =>
                setTab(
                  id as any
                )
              }
              type="button"
            >
              {label}
            </button>
          )
        )}
      </div>

      <div className="portal-layout">
        <aside className="sidebar">
          <div className="profile-mini">
            <div className="avatar">
              {farmer.name?.[0] ||
                "F"}
            </div>

            <div>
              <b>
                {farmer.name}
              </b>

              <span>
                {farmer.crop} •{" "}
                {farmer.landAcres}{" "}
                acres
              </span>
            </div>
          </div>

          {[
            [
              "overview",
              "Overview",
            ],
            [
              "advisory",
              "Crop Advisory",
            ],
            [
              "market",
              "Mandi Prices",
            ],
            [
              "risk",
              "Risk Score",
            ],
          ].map(
            ([id, label]) => (
              <button
                key={id}
                className={
                  tab === id
                    ? "side-link active"
                    : "side-link"
                }
                onClick={() =>
                  setTab(
                    id as any
                  )
                }
                type="button"
              >
                {label}
              </button>
            )
          )}
        </aside>

        <main className="content">
          {tab ===
            "overview" && (
            <>
              <PageTitle
                title={`Namaste, ${farmer.name.split(" ")[0]} 👋`}
                subtitle="Here is what matters for your farm today."
              />

              <div className="stat-grid">
                <Stat
                  icon={<CloudRain />}
                  label="Rainfall next 24h"
                  value={`${weather?.rainfallNext24h ?? 0} mm`}
                  note={
                    weather?.warning ||
                    "Weather information"
                  }
                />

                <Stat
                  icon={
                    <IndianRupee />
                  }
                  label="Best mandi price"
                  value={
                    bestPrice
                      ? `₹${bestPrice.toLocaleString()}`
                      : "₹--"
                  }
                  note="Compare before selling"
                />

                <Stat
                  icon={
                    <Activity />
                  }
                  label="Distress risk"
                  value={`${risk?.score ?? 0}/100`}
                  note={`${risk?.level || "UNKNOWN"} risk`}
                  danger={
                    risk?.level ===
                    "HIGH"
                  }
                />
              </div>

              <div className="two-col">
                <section className="panel">
                  <PanelHead
                    title={
                      advisory?.title ||
                      "Today's Crop Advisory"
                    }
                    action={
                      <button
                        className="voice-btn"
                        onClick={
                          speakAdvisory
                        }
                        type="button"
                      >
                        <Volume2
                          size={17}
                        />
                        Listen
                      </button>
                    }
                  />

                  {advisory?.items
                    ?.slice(0, 4)
                    .map(
                      (
                        item: string,
                        index: number
                      ) => (
                        <div
                          className="advice-row"
                          key={index}
                        >
                          <CheckCircle2
                            size={18}
                          />

                          <span>
                            {item}
                          </span>
                        </div>
                      )
                    )}
                </section>

                <section className="panel">
                  <PanelHead
                    title="Weather Alert"
                  />

                  <div className="weather-big">
                    <CloudRain
                      size={42}
                    />

                    <div>
                      <strong>
                        {weather?.temperature ??
                          "--"}
                        °C
                      </strong>

                      <span>
                        {weather?.condition ||
                          "Unavailable"}
                      </span>
                    </div>
                  </div>

                  <div className="alert-box">
                    <AlertTriangle
                      size={18}
                    />

                    <span>
                      {weather?.warning ||
                        "No weather warning available."}
                    </span>
                  </div>
                </section>
              </div>
            </>
          )}

          {tab ===
            "advisory" && (
            <>
              <PageTitle
                title="Crop Advisory"
                subtitle="Simple actions based on your crop and local conditions."
              />

              <section className="panel">
                {advisory?.items?.map(
                  (
                    item: string,
                    index: number
                  ) => (
                    <div
                      className="advice-row large"
                      key={index}
                    >
                      <span className="number">
                        {index + 1}
                      </span>

                      <span>
                        {item}
                      </span>
                    </div>
                  )
                )}

                <button
                  className="primary"
                  onClick={
                    speakAdvisory
                  }
                  type="button"
                >
                  <Volume2 size={18} />
                  Listen in{" "}
                  {farmer.language}
                </button>
              </section>
            </>
          )}

          {tab ===
            "market" && (
            <>
              <PageTitle
                title="Mandi Price Comparison"
                subtitle={`${farmer.crop} • simulated district-level market feed`}
              />

              <section className="panel">
                <div className="market-table">
                  {market.map(
                    (
                      item: any
                    ) => (
                      <div
                        className="market-row"
                        key={
                          item.mandi
                        }
                      >
                        <div>
                          <b>
                            {
                              item.mandi
                            }
                          </b>

                          <span>
                            {
                              item.distance
                            }
                          </span>
                        </div>

                        <strong>
                          ₹
                          {Number(
                            item.price ||
                              0
                          ).toLocaleString()}
                        </strong>

                        <span
                          className={
                            String(
                              item.trend ||
                                ""
                            ).startsWith(
                              "+"
                            )
                              ? "trend up"
                              : "trend down"
                          }
                        >
                          {String(
                            item.trend ||
                              ""
                          ).startsWith(
                            "+"
                          ) ? (
                            <TrendingUp
                              size={14}
                            />
                          ) : (
                            <TrendingDown
                              size={14}
                            />
                          )}

                          {
                            item.trend
                          }
                        </span>
                      </div>
                    )
                  )}
                </div>

                <div className="hint">
                  In production, this
                  module can connect to
                  live mandi/Agmarknet
                  feeds.
                </div>
              </section>
            </>
          )}

          {tab ===
            "risk" &&
            risk && (
              <RiskPanel
                risk={risk}
                farmer={farmer}
              />
            )}
        </main>
      </div>
    </div>
  );
}

/* =========================================================
   RISK
========================================================= */

function RiskPanel({
  risk,
  farmer,
}: {
  risk: Risk;
  farmer: Farmer;
}) {
  return (
    <>
      <PageTitle
        title="Your Distress Risk"
        subtitle="An explainable prototype score — not a financial or medical prediction."
      />

      <div className="risk-hero">
        <div
          className={`risk-circle ${risk.level.toLowerCase()}`}
        >
          <strong>
            {risk.score}
          </strong>

          <span>
            /100
          </span>
        </div>

        <div>
          <div
            className={`risk-badge ${risk.level.toLowerCase()}`}
          >
            {risk.level} RISK
          </div>

          <h2>
            {risk.score >= 70
              ? "Early intervention recommended"
              : "Keep monitoring your farm"}
          </h2>

          <p>
            The score combines
            rainfall deviation, market
            price movement and loan
            due-date proximity for{" "}
            {farmer.name}.
          </p>
        </div>
      </div>

      <section className="panel">
        <h3>
          Why this score?
        </h3>

        <Factor
          label="Rainfall stress"
          value={
            risk.factors.rainfall
          }
          detail={`${risk.rainfallDeviation}% deviation from reference`}
          weight="40%"
        />

        <Factor
          label="Market stress"
          value={
            risk.factors.market
          }
          detail={`${risk.priceChange}% price change`}
          weight="35%"
        />

        <Factor
          label="Loan proximity"
          value={
            risk.factors.loan
          }
          detail={`${Math.max(
            0,
            risk.loanDays
          )} days to due date`}
          weight="25%"
        />
      </section>
    </>
  );
}

/* =========================================================
   FACTOR
========================================================= */

function Factor({
  label,
  value,
  detail,
  weight,
}: {
  label: string;
  value: number;
  detail: string;
  weight: string;
}) {
  const safeValue =
    Math.max(
      0,
      Math.min(
        100,
        Number(value) || 0
      )
    );

  return (
    <div className="factor">
      <div className="factor-top">
        <div>
          <b>{label}</b>
          <span>{detail}</span>
        </div>

        <strong>
          {Math.round(
            safeValue
          )}
        </strong>
      </div>

      <div className="bar">
        <i
          style={{
            width: `${safeValue}%`,
          }}
        />
      </div>

      <small>
        Weight {weight}
      </small>
    </div>
  );
}

/* =========================================================
   OFFICER PORTAL
========================================================= */

function OfficerPortal({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const [alerts, setAlerts] =
    useState<any[]>([]);

  const [selected, setSelected] =
    useState<any | null>(
      null
    );

  const [filter, setFilter] =
    useState("ALL");

  const [toast, setToast] =
    useState("");

  useEffect(() => {
    const load =
      async () => {
        try {
          const response =
            await api.alerts();

          setAlerts(
            response.alerts ||
              []
          );
        } catch (error) {
          console.error(
            "Officer alerts error:",
            error
          );
        }
      };

    load();
  }, []);

  const filtered =
    useMemo(
      () =>
        alerts.filter(
          (item) =>
            filter === "ALL" ||
            item.risk?.level ===
              filter
        ),
      [alerts, filter]
    );

  const act = async (
    action: string
  ) => {
    if (!selected) {
      return;
    }

    try {
      await api.intervention({
        farmerId:
          selected.farmer.id,
        action,
        note: `Action recorded by officer for ${selected.farmer.name}`,
      });

      setToast(
        `${action} recorded for ${selected.farmer.name}`
      );

      window.setTimeout(
        () => setToast(""),
        2500
      );
    } catch (error) {
      console.error(
        "Intervention error:",
        error
      );

      setToast(
        "Could not record the action."
      );

      window.setTimeout(
        () => setToast(""),
        2500
      );
    }
  };

  return (
    <div className="app-shell">
      <Header
        title="Officer Portal"
        subtitle="District Early-Warning Center"
        onLogout={onLogout}
      />

      <KrishiMascot />

      <main className="officer-content">
        <PageTitle
          title="Farmer Distress Alerts"
          subtitle="Prioritize farmers who may need timely intervention."
        />

        <div className="officer-summary">
          <div>
            <span>
              Farmers monitored
            </span>

            <strong>
              {alerts.length}
            </strong>
          </div>

          <div>
            <span>
              High risk
            </span>

            <strong className="danger-text">
              {
                alerts.filter(
                  (item) =>
                    item.risk?.level ===
                    "HIGH"
                ).length
              }
            </strong>
          </div>

          <div>
            <span>
              Medium risk
            </span>

            <strong>
              {
                alerts.filter(
                  (item) =>
                    item.risk?.level ===
                    "MEDIUM"
                ).length
              }
            </strong>
          </div>

          <div>
            <span>
              Officer
            </span>

            <strong>
              {user.name}
            </strong>
          </div>
        </div>

        <div className="filter-row">
          {[
            "ALL",
            "HIGH",
            "MEDIUM",
            "LOW",
          ].map(
            (item) => (
              <button
                key={item}
                className={
                  filter === item
                    ? "filter active"
                    : "filter"
                }
                onClick={() =>
                  setFilter(item)
                }
                type="button"
              >
                {item}
              </button>
            )
          )}
        </div>

        <div className="alerts-layout">
          <section className="panel alerts-list">
            {filtered.map(
              (item) => (
                <button
                  key={
                    item.farmer.id
                  }
                  className="alert-card"
                  onClick={() =>
                    setSelected(
                      item
                    )
                  }
                  type="button"
                >
                  <div
                    className={`severity-dot ${String(
                      item.risk.level
                    ).toLowerCase()}`}
                  />

                  <div className="alert-main">
                    <div className="alert-title">
                      <b>
                        {
                          item
                            .farmer
                            .name
                        }
                      </b>

                      <span>
                        {
                          item
                            .farmer
                            .village
                        }
                        ,{" "}
                        {
                          item
                            .farmer
                            .district
                        }
                      </span>
                    </div>

                    <div className="chips">
                      <span>
                        {
                          item
                            .farmer
                            .crop
                        }
                      </span>

                      <span>
                        Rain{" "}
                        {
                          item.risk
                            .rainfallDeviation
                        }
                        %
                      </span>

                      <span>
                        Price{" "}
                        {
                          item.risk
                            .priceChange
                        }
                        %
                      </span>
                    </div>
                  </div>

                  <div className="score">
                    <strong>
                      {
                        item.risk
                          .score
                      }
                    </strong>

                    <span>
                      {
                        item.risk
                          .level
                      }
                    </span>
                  </div>

                  <ArrowRight
                    size={17}
                  />
                </button>
              )
            )}

            {filtered.length ===
              0 && (
              <div className="empty-detail">
                <ShieldCheck
                  size={35}
                />

                <h3>
                  No alerts found
                </h3>

                <p>
                  No farmers match the
                  selected filter.
                </p>
              </div>
            )}
          </section>

          {selected ? (
            <section className="panel detail-panel">
              <button
                className="close-btn"
                onClick={() =>
                  setSelected(
                    null
                  )
                }
                type="button"
              >
                <X size={18} />
              </button>

              <div className="detail-head">
                <div className="avatar large">
                  {
                    selected
                      .farmer
                      .name?.[0]
                  }
                </div>

                <div>
                  <h2>
                    {
                      selected
                        .farmer
                        .name
                    }
                  </h2>

                  <p>
                    <MapPin
                      size={15}
                    />

                    {
                      selected
                        .farmer
                        .village
                    }
                    ,{" "}
                    {
                      selected
                        .farmer
                        .district
                    }
                  </p>
                </div>
              </div>

              <div className="detail-score">
                <div
                  className={`risk-circle small ${String(
                    selected.risk
                      .level
                  ).toLowerCase()}`}
                >
                  <strong>
                    {
                      selected
                        .risk
                        .score
                    }
                  </strong>

                  <span>
                    /100
                  </span>
                </div>

                <div>
                  <b>
                    {
                      selected
                        .risk
                        .level
                    }{" "}
                    distress risk
                  </b>

                  <p>
                    Intervention priority
                    based on explainable
                    signals.
                  </p>
                </div>
              </div>

              <Factor
                label="Rainfall stress"
                value={
                  selected.risk
                    .factors
                    .rainfall
                }
                detail={`${selected.risk.rainfallDeviation}% deviation`}
                weight="40%"
              />

              <Factor
                label="Market stress"
                value={
                  selected.risk
                    .factors
                    .market
                }
                detail={`${selected.risk.priceChange}% price movement`}
                weight="35%"
              />

              <Factor
                label="Loan proximity"
                value={
                  selected.risk
                    .factors
                    .loan
                }
                detail={`${Math.max(
                  0,
                  selected.risk
                    .loanDays
                )} days remaining`}
                weight="25%"
              />

              <div className="intervention-actions">
                <button
                  className="primary"
                  onClick={() =>
                    act(
                      "Contact farmer"
                    )
                  }
                  type="button"
                >
                  <Phone size={17} />
                  Contact farmer
                </button>

                <button
                  className="secondary"
                  onClick={() =>
                    act(
                      "Send advisory"
                    )
                  }
                  type="button"
                >
                  <Bell size={17} />
                  Send advisory
                </button>

                <button
                  className="ghost-btn"
                  onClick={() =>
                    act(
                      "Mark reviewed"
                    )
                  }
                  type="button"
                >
                  <CheckCircle2
                    size={17}
                  />
                  Mark reviewed
                </button>
              </div>
            </section>
          ) : (
            <section className="empty-detail">
              <ShieldCheck
                size={35}
              />

              <h3>
                Select a farmer alert
              </h3>

              <p>
                Click an alert to see
                the risk breakdown and
                intervention actions.
              </p>
            </section>
          )}
        </div>
      </main>

      {toast && (
        <div className="toast">
          <CheckCircle2
            size={18}
          />

          {toast}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   SMALL UI COMPONENTS
========================================================= */

function PageTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="live">
        <span />
        Live demo data
      </div>
    </div>
  );
}

function PanelHead({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel-head">
      <h3>{title}</h3>
      {action}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  note,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  danger?: boolean;
}) {
  return (
    <div className="stat">
      <div className="stat-icon">
        {icon}
      </div>

      <span>{label}</span>

      <strong
        className={
          danger
            ? "danger-text"
            : ""
        }
      >
        {value}
      </strong>

      <small>{note}</small>
    </div>
  );
}

function Loading() {
  return (
    <div className="loading">
      <div className="spinner" />

      <span>
        Loading your farm data...
      </span>
    </div>
  );
}

function ErrorState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="loading">
      <AlertTriangle />

      <span>
        {message ||
          "Unable to load data. Is the backend running?"}
      </span>
    </div>
  );
}

export default App;