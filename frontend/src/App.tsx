import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowRight, Bell, CheckCircle2, CloudRain, IndianRupee,
  Leaf, LogOut, MapPin, Menu, Phone, ShieldCheck, Sprout, TrendingDown,
  TrendingUp, UserRound, Volume2, X, Activity, CalendarClock, Bot, Send, Mic, Sparkles, MessageCircle, ChevronDown
} from "lucide-react";
import { api } from "./api";

type User = { id: string; name: string; email: string; role: "farmer" | "officer"; farmerId?: string };
type Farmer = {
  id: string; name: string; village: string; district: string; state: string; crop: string;
  landAcres: number; irrigation: string; soilType: string; language: string; phone: string;
  loanDueDate: string; concern: string;
};
type Risk = { score: number; level: string; factors: { rainfall: number; market: number; loan: number }; rainfallDeviation: number; priceChange: number; loanDays: number };

const demo = {
  farmer: { email: "ramesh@demo.com", password: "demo123" },
  officer: { email: "officer@krishisaathi.demo", password: "demo123" }
};

function App() {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("ks_user"); return raw ? JSON.parse(raw) : null;
  });
  const [screen, setScreen] = useState<"home"|"onboard"|"login"|"farmer"|"officer">(
    user ? (user.role === "officer" ? "officer" : "farmer") : "home"
  );

  const login = (u: User, token: string) => {
    localStorage.setItem("ks_token", token);
    localStorage.setItem("ks_user", JSON.stringify(u));
    setUser(u);
    setScreen(u.role === "officer" ? "officer" : "farmer");
  };
  const logout = () => {
    localStorage.removeItem("ks_token"); localStorage.removeItem("ks_user");
    setUser(null); setScreen("home");
  };

  if (screen === "home") return <Home onNew={() => setScreen("onboard")} onExisting={() => setScreen("login")} onOfficer={() => setScreen("login")} />;
  if (screen === "onboard") return <Onboarding onDone={login} onBack={() => setScreen("home")} />;
  if (screen === "login") return <Login onDone={login} onBack={() => setScreen("home")} />;
  if (screen === "farmer" && user?.farmerId) return <FarmerPortal user={user} onLogout={logout} />;
  if (screen === "officer" && user?.role === "officer") return <OfficerPortal user={user} onLogout={logout} />;
  return <Home onNew={() => setScreen("onboard")} onExisting={() => setScreen("login")} onOfficer={() => setScreen("login")} />;
}

function Header({ title, subtitle, onLogout }: { title: string; subtitle?: string; onLogout: () => void }) {
  return <header className="topbar">
    <div className="brand"><div className="brand-mark"><Leaf size={20}/></div><div><strong>Krishi Saathi</strong><span>{title}</span></div></div>
    <div className="top-actions">{subtitle && <span className="desktop-only">{subtitle}</span>}<button className="icon-btn" onClick={onLogout} title="Logout"><LogOut size={18}/></button></div>
  </header>;
}

function Home({ onNew, onExisting, onOfficer }: any) {
  return <div className="home">
    <KrishiMascot />
    <div className="home-nav"><div className="brand"><div className="brand-mark"><Leaf size={20}/></div><strong>Krishi Saathi</strong></div><span>Smart Crop Advisory & Early Warning</span></div>
    <section className="hero">
      <div className="hero-copy"><div className="eyebrow"><ShieldCheck size={16}/> Built for farmers, officers & rural communities</div>
        <h1>Better farming decisions,<br/><em>before it becomes a crisis.</em></h1>
        <p>Localized weather, crop, market and distress insights in one simple place — designed for basic smartphones and regional languages.</p>
        <div className="hero-actions"><button className="primary" onClick={onNew}><Sprout size={19}/> I am a new farmer <ArrowRight size={17}/></button><button className="secondary" onClick={onExisting}><UserRound size={18}/> Existing farmer</button></div>
      </div>
      <div className="hero-card"><div className="card-label">TODAY'S DEMO ALERT</div><div className="weather-orb"><CloudRain size={32}/></div><h3>Rainfall risk detected</h3><p>Sundargarh district</p><div className="mini-metric"><span>Next 24h</span><strong>34 mm</strong></div><div className="mini-metric"><span>Distress risk</span><strong className="danger-text">78 / 100</strong></div><div className="alert-strip"><AlertTriangle size={16}/> Officer intervention recommended</div></div>
    </section>
    <section className="portal-grid">
      <PortalCard icon={<Sprout/>} title="New Farmer" text="Answer a few simple questions and get a personalized farm profile." button="Create profile" onClick={onNew}/>
      <PortalCard icon={<Activity/>} title="Existing Farmer" text="Check weather, crop advice, mandi prices and your risk score." button="Open dashboard" onClick={onExisting}/>
      <PortalCard icon={<ShieldCheck/>} title="Agriculture Officer" text="View high-risk farmers and coordinate timely intervention." button="Officer portal" onClick={onOfficer}/>
    </section>
    <footer>Prototype • Sample district data • API & ML integrations can be plugged in later</footer>
  </div>
}

function PortalCard({icon,title,text,button,onClick}:any) {
  return <div className="portal-card"><div className="portal-icon">{icon}</div><h3>{title}</h3><p>{text}</p><button className="text-btn" onClick={onClick}>{button}<ArrowRight size={16}/></button></div>
}


function KrishiMascot({ farmer, risk, weather, market }: { farmer?: Farmer | null; risk?: Risk | null; weather?: any; market?: any[] }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<{ role: "assistant" | "user"; content: string }[]>([
    { role: "assistant", content: farmer ? `Namaste ${farmer.name.split(" ")[0]}! 🌱 I’m your Krishi Saathi. Ask me about your ${farmer.crop}, weather, mandi prices or farm risk.` : "Namaste! 🌱 I’m Krishi Saathi. Ask me anything about farming, crops or weather." }
  ]);
  const [listening, setListening] = useState(false);

  const context = { farmer, risk, weather, market };
  const send = async (preset?: string) => {
    const text = (preset ?? message).trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setMessage("");
    setBusy(true);
    try {
      const r = await api.chat({ message: text, history: next.slice(-8), context });
      setMessages(prev => [...prev, { role: "assistant", content: r.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "I’m having trouble connecting right now. Please try again in a moment." }]);
    } finally { setBusy(false); }
  };

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = farmer?.language === "Hindi" ? "hi-IN" : farmer?.language === "Odia" ? "or-IN" : "en-IN";
    speechSynthesis.speak(u);
  };

  const voiceInput = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setMessage("Voice input is not supported in this browser."); return; }
    const recognition = new SR();
    recognition.lang = farmer?.language === "Hindi" ? "hi-IN" : farmer?.language === "Odia" ? "or-IN" : "en-IN";
    recognition.interimResults = false;
    setListening(true);
    recognition.onresult = (e: any) => setMessage(e.results[0][0].transcript);
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  return <>
    <button className={`mascot-fab ${open ? "is-open" : ""}`} onClick={() => setOpen(!open)} aria-label="Open Krishi Saathi AI">
      <span className="mascot-bubble">{open ? <X size={18}/> : <MessageCircle size={20}/>}</span>
      <span className="mascot-character"><span className="mascot-leaf">🌿</span><span className="mascot-face"><i/><i/><b/></span></span>
      {!open && <span className="mascot-spark"><Sparkles size={13}/></span>}
    </button>

    {open && <div className="chatbot-panel">
      <div className="chatbot-head">
        <div className="chat-mascot-mini"><span>🌱</span></div>
        <div><strong>Krishi Saathi AI</strong><small>{farmer ? "Personal farm assistant" : "Your farming assistant"}</small></div>
        <button onClick={() => setOpen(false)} aria-label="Close"><ChevronDown size={18}/></button>
      </div>
      <div className="chatbot-status"><span/> AI assistant • simple answers • multilingual</div>
      <div className="chat-messages">
        {messages.map((m, i) => <div key={i} className={`chat-msg ${m.role}`}>
          <div className="chat-avatar">{m.role === "assistant" ? "🌾" : farmer?.name?.[0] || "You"}</div>
          <div className="chat-content"><span>{m.content}</span>{m.role === "assistant" && <button className="speak-mini" onClick={() => speak(m.content)} title="Listen"><Volume2 size={14}/></button>}</div>
        </div>)}
        {busy && <div className="chat-msg assistant"><div className="chat-avatar">🌾</div><div className="typing"><i/><i/><i/></div></div>}
      </div>
      <div className="chat-suggestions">
        {(farmer ? ["What should I do today?", "Explain my risk", "Will rain affect my crop?"] : ["How can I protect my crop?", "How does risk scoring work?"]).map(x => <button key={x} onClick={() => send(x)}>{x}</button>)}
      </div>
      <div className="chat-input-row">
        <button className={`chat-icon ${listening ? "listening" : ""}`} onClick={voiceInput} title="Voice input"><Mic size={17}/></button>
        <input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>e.key === "Enter" && send()} placeholder="Ask about your farm…" aria-label="Ask Krishi Saathi" />
        <button className="chat-send" onClick={() => send()} disabled={!message.trim() || busy} aria-label="Send"><Send size={17}/></button>
      </div>
      <div className="chat-disclaimer">AI advice is a prototype. For serious crop or financial issues, contact your agriculture officer.</div>
    </div>}
  </>;
}

function Onboarding({onDone,onBack}:any) {
  const [step,setStep]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [data,setData]=useState<any>({ name:"", email:"", password:"demo123", village:"", district:"Sundargarh", state:"Odisha", crop:"Paddy", landAcres:2, irrigation:"Rainfed", soilType:"Loamy", language:"English", phone:"", loanDueDate:"2026-10-15", concern:"Weather risk" });
  const questions = [
    ["What's your name?", "name", "text", "e.g. Ramesh Kumar"],
    ["Which village do you farm in?", "village", "text", "e.g. Bisra"],
    ["Which district?", "district", "text", "e.g. Sundargarh"],
    ["What is your main crop?", "crop", "select", ""],
    ["How much land do you cultivate?", "landAcres", "number", "Acres"],
    ["What is your irrigation source?", "irrigation", "select", ""],
    ["What language should we use?", "language", "select", ""],
    ["When is your next loan due?", "loanDueDate", "date", ""],
    ["What worries you most right now?", "concern", "select", ""],
    ["Create a login email", "email", "email", "you@example.com"]
  ];
  const [q, key, type, placeholder] = questions[step];
  const options: Record<string,string[]> = { crop:["Paddy","Wheat","Maize","Cotton"], irrigation:["Rainfed","Canal","Borewell","Other"], language:["English","Hindi","Odia"], concern:["Weather risk","Crop disease","Market price","Loan repayment","Other"] };
  const next=async()=> {
    setError("");
    if (!data[key]) { setError("Please answer this question."); return; }
    if(step<questions.length-1){setStep(step+1);return;}
    setBusy(true);
    try { const r=await api.register(data); onDone(r.user,r.token); } catch(e:any){setError(e.message)} finally{setBusy(false)}
  };
  return <div className="onboarding"><KrishiMascot /><div className="simple-nav"><button className="back-btn" onClick={onBack}>← Back</button><div className="brand"><div className="brand-mark"><Leaf size={18}/></div><strong>Krishi Saathi</strong></div><span>{step+1} / {questions.length}</span></div>
    <div className="progress"><div style={{width:`${((step+1)/questions.length)*100}%`}}/></div>
    <main className="question-card"><div className="question-icon"><Sprout size={27}/></div><div className="eyebrow">YOUR FARM PROFILE</div><h1>{q}</h1><p className="muted">This helps us personalize your advisory and distress score.</p>
      {type==="select" ? <div className="option-list">{options[key].map(x=><button className={data[key]===x?"option selected":"option"} key={x} onClick={()=>setData({...data,[key]:x})}>{x}<span>{data[key]===x?"✓":""}</span></button>)}</div> :
      <input autoFocus type={type} placeholder={placeholder} value={data[key] ?? ""} onChange={e=>setData({...data,[key]:e.target.value})}/>}
      {key==="email" && <div className="hint">For the prototype, you can use any email. A password of <b>demo123</b> is used for this profile.</div>}
      {error && <div className="error">{error}</div>}
      <button className="primary full" onClick={next} disabled={busy}>{busy?"Creating profile…":step===questions.length-1?"Create My Farmer Profile":"Continue"}<ArrowRight size={18}/></button>
    </main>
  </div>
}

function Login({onDone,onBack}:any) {
  const [email,setEmail]=useState(demo.farmer.email),[password,setPassword]=useState(demo.farmer.password),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [officerMode,setOfficerMode]=useState(false);
  const submit=async()=>{setBusy(true);setError("");try{const r=await api.login(email,password);onDone(r.user,r.token)}catch(e:any){setError(e.message)}finally{setBusy(false)}};
  return <div className="login-page"><KrishiMascot /><div className="simple-nav"><button className="back-btn" onClick={onBack}>← Back</button><div className="brand"><div className="brand-mark"><Leaf size={18}/></div><strong>Krishi Saathi</strong></div></div>
    <div className="login-card"><div className="question-icon"><UserRound size={25}/></div><div className="eyebrow">{officerMode?"OFFICER ACCESS":"FARMER ACCESS"}</div><h1>Welcome back</h1><p className="muted">Sign in to continue to your {officerMode?"officer":"farmer"} dashboard.</p>
      <label>Email<input value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      {error&&<div className="error">{error}</div>}<button className="primary full" onClick={submit} disabled={busy}>{busy?"Signing in…":"Sign in"}<ArrowRight size={18}/></button>
      <div className="demo-login"><span>Demo:</span> {officerMode?`${demo.officer.email} / demo123`:`${demo.farmer.email} / demo123`}</div>
      <button className="link-btn" onClick={()=>{setOfficerMode(!officerMode);const d=!officerMode?demo.officer:demo.farmer;setEmail(d.email);setPassword(d.password)}}>{officerMode?"Use farmer login":"Officer login"}</button>
    </div>
  </div>
}

function FarmerPortal({user,onLogout}:{user:User;onLogout:()=>void}) {
  const [farmer,setFarmer]=useState<Farmer|null>(null),[risk,setRisk]=useState<Risk|null>(null),[weather,setWeather]=useState<any>(null),[market,setMarket]=useState<any[]>([]),[advisory,setAdvisory]=useState<any>(null),[tab,setTab]=useState("overview"),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{(async()=>{try{const f=await api.me();setFarmer(f.farmer);const [r,w,m,a]=await Promise.all([api.risk(f.farmer.id),api.weather(f.farmer.district),api.market(f.farmer.crop),api.advisory(f.farmer.id)]);setRisk(r.risk);setWeather(w.weather);setMarket(m.markets);setAdvisory(a.advisory)}catch(e:any){setError(e.message)}finally{setLoading(false)}})()},[]);
  if(loading)return <Loading/>;
  if(error||!farmer)return <ErrorState message={error}/>;
  const speak=()=>{if(!advisory)return;const u=new SpeechSynthesisUtterance(advisory.voiceText);u.lang=farmer.language==="Hindi"?"hi-IN":farmer.language==="Odia"?"or-IN":"en-IN";speechSynthesis.speak(u)};
  return <div className="app-shell"><Header title="Farmer Portal" subtitle={`${farmer.village}, ${farmer.district}`} onLogout={onLogout}/><KrishiMascot farmer={farmer} risk={risk} weather={weather} market={market}/>
    <div className="mobile-tabs">{[["overview","Home"],["advisory","Advice"],["market","Mandi"],["risk","Risk"]].map(([id,label])=><button className={tab===id?"active":""} onClick={()=>setTab(id)} key={id}>{label}</button>)}</div><div className="portal-layout"><aside className="sidebar"><div className="profile-mini"><div className="avatar">{farmer.name[0]}</div><div><b>{farmer.name}</b><span>{farmer.crop} • {farmer.landAcres} acres</span></div></div>{[["overview","Overview"],["advisory","Crop Advisory"],["market","Mandi Prices"],["risk","Risk Score"]].map(([id,label])=><button className={tab===id?"side-link active":"side-link"} onClick={()=>setTab(id)} key={id}>{label}</button>)}</aside>
    <main className="content">{tab==="overview"&&<><PageTitle title={`Namaste, ${farmer.name.split(" ")[0]} 👋`} subtitle="Here is what matters for your farm today."/><div className="stat-grid"><Stat icon={<CloudRain/>} label="Rainfall next 24h" value={`${weather.rainfallNext24h} mm`} note={weather.warning}/><Stat icon={<IndianRupee/>} label="Best mandi price" value={`₹${Math.max(...market.map(m=>m.price)).toLocaleString()}`} note="Compare before selling"/><Stat icon={<Activity/>} label="Distress risk" value={`${risk?.score}/100`} note={`${risk?.level} risk`} danger={risk?.level==="HIGH"}/></div><div className="two-col"><section className="panel"><PanelHead title={advisory?.title||"Today's Advisory"} action={<button className="voice-btn" onClick={speak}><Volume2 size={17}/> Listen</button>}/>{advisory?.items?.slice(0,4).map((x:string,i:number)=><div className="advice-row" key={i}><CheckCircle2 size={18}/><span>{x}</span></div>)}</section><section className="panel"><PanelHead title="Weather Alert"/><div className="weather-big"><CloudRain size={42}/><div><strong>{weather.temperature}°C</strong><span>{weather.condition}</span></div></div><div className="alert-box"><AlertTriangle size={18}/><span>{weather.warning}</span></div></section></div></>}
      {tab==="advisory"&&<><PageTitle title="Crop Advisory" subtitle="Simple actions based on your crop and local conditions."/><section className="panel">{advisory?.items.map((x:string,i:number)=><div className="advice-row large" key={i}><span className="number">{i+1}</span><span>{x}</span></div>)}<button className="primary" onClick={speak}><Volume2 size={18}/> Listen in {farmer.language}</button></section></>}
      {tab==="market"&&<><PageTitle title="Mandi Price Comparison" subtitle={`${farmer.crop} • simulated district-level market feed`}/><section className="panel"><div className="market-table">{market.map((m:any)=><div className="market-row" key={m.mandi}><div><b>{m.mandi}</b><span>{m.distance}</span></div><strong>₹{m.price.toLocaleString()}</strong><span className={m.trend.startsWith("+")?"trend up":"trend down"}>{m.trend}</span></div>)}</div><div className="hint">In production, this module can connect to live mandi/Agmarknet feeds.</div></section></>}
      {tab==="risk"&&<RiskPanel risk={risk!} farmer={farmer}/>}
    </main></div>
  </div>
}

function RiskPanel({risk,farmer}:{risk:Risk;farmer:Farmer}) {
  return <><PageTitle title="Your Distress Risk" subtitle="An explainable prototype score — not a financial or medical prediction."/><div className="risk-hero"><div className={`risk-circle ${risk.level.toLowerCase()}`}><strong>{risk.score}</strong><span>/100</span></div><div><div className={`risk-badge ${risk.level.toLowerCase()}`}>{risk.level} RISK</div><h2>{risk.score>=70?"Early intervention recommended":"Keep monitoring your farm"}</h2><p>The score combines rainfall deviation, market price movement and loan due-date proximity.</p></div></div><section className="panel"><h3>Why this score?</h3><Factor label="Rainfall stress" value={risk.factors.rainfall} detail={`${risk.rainfallDeviation}% deviation from reference`} weight="40%"/><Factor label="Market stress" value={risk.factors.market} detail={`${risk.priceChange}% price change`} weight="35%"/><Factor label="Loan proximity" value={risk.factors.loan} detail={`${Math.max(0,risk.loanDays)} days to due date`} weight="25%"/></section></>
}

function Factor({label,value,detail,weight}:{label:string;value:number;detail:string;weight:string}){return <div className="factor"><div className="factor-top"><div><b>{label}</b><span>{detail}</span></div><strong>{value}</strong></div><div className="bar"><i style={{width:`${value}%`}}/></div><small>Weight {weight}</small></div>}

function OfficerPortal({user,onLogout}:{user:User;onLogout:()=>void}) {
  const [alerts,setAlerts]=useState<any[]>([]),[selected,setSelected]=useState<any|null>(null),[filter,setFilter]=useState("ALL"),[toast,setToast]=useState("");
  const load=()=>api.alerts().then(r=>setAlerts(r.alerts)).catch(()=>{});
  useEffect(()=>{load()},[]);
  const filtered=useMemo(()=>alerts.filter(a=>filter==="ALL"||a.risk.level===filter),[alerts,filter]);
  const act=async(action:string)=>{if(!selected)return;await api.intervention({farmerId:selected.farmer.id,action,note:`Action recorded by officer for ${selected.farmer.name}`});setToast(`${action} recorded for ${selected.farmer.name}`);load();setTimeout(()=>setToast(""),2500)};
  return <div className="app-shell"><Header title="Officer Portal" subtitle="District Early-Warning Center" onLogout={onLogout}/><KrishiMascot /><main className="officer-content"><PageTitle title="Farmer Distress Alerts" subtitle="Prioritize farmers who may need timely intervention."/><div className="officer-summary"><div><span>Farmers monitored</span><strong>{alerts.length}</strong></div><div><span>High risk</span><strong className="danger-text">{alerts.filter(x=>x.risk.level==="HIGH").length}</strong></div><div><span>Medium risk</span><strong>{alerts.filter(x=>x.risk.level==="MEDIUM").length}</strong></div><div><span>Reviewed actions</span><strong>Demo</strong></div></div><div className="filter-row">{["ALL","HIGH","MEDIUM","LOW"].map(x=><button className={filter===x?"filter active":"filter"} onClick={()=>setFilter(x)} key={x}>{x}</button>)}</div><div className="alerts-layout"><section className="panel alerts-list">{filtered.map(a=><button className="alert-card" key={a.farmer.id} onClick={()=>setSelected(a)}><div className={`severity-dot ${a.risk.level.toLowerCase()}`}/><div className="alert-main"><div className="alert-title"><b>{a.farmer.name}</b><span>{a.farmer.village}, {a.farmer.district}</span></div><div className="chips"><span>{a.farmer.crop}</span><span>Rain {a.risk.rainfallDeviation}%</span><span>Price {a.risk.priceChange}%</span></div></div><div className="score"><strong>{a.risk.score}</strong><span>{a.risk.level}</span></div><ArrowRight size={17}/></button>)}</section>{selected?<section className="panel detail-panel"><button className="close-btn" onClick={()=>setSelected(null)}><X size={18}/></button><div className="detail-head"><div className="avatar large">{selected.farmer.name[0]}</div><div><h2>{selected.farmer.name}</h2><p><MapPin size={15}/> {selected.farmer.village}, {selected.farmer.district}</p></div></div><div className="detail-score"><div className={`risk-circle small ${selected.risk.level.toLowerCase()}`}><strong>{selected.risk.score}</strong><span>/100</span></div><div><b>{selected.risk.level} distress risk</b><p>Intervention priority based on 3 explainable signals.</p></div></div><Factor label="Rainfall stress" value={selected.risk.factors.rainfall} detail={`${selected.risk.rainfallDeviation}% deviation`} weight="40%"/><Factor label="Market stress" value={selected.risk.factors.market} detail={`${selected.risk.priceChange}% price movement`} weight="35%"/><Factor label="Loan proximity" value={selected.risk.factors.loan} detail={`${Math.max(0,selected.risk.loanDays)} days remaining`} weight="25%"/><div className="intervention-actions"><button className="primary" onClick={()=>act("Contact farmer")}><Phone size={17}/> Contact farmer</button><button className="secondary" onClick={()=>act("Send advisory")}><Bell size={17}/> Send advisory</button><button className="ghost-btn" onClick={()=>act("Mark reviewed")}><CheckCircle2 size={17}/> Mark reviewed</button></div></section>:<section className="empty-detail"><ShieldCheck size={35}/><h3>Select a farmer alert</h3><p>Click any alert to see the risk breakdown and intervention actions.</p></section>}</div></main>{toast&&<div className="toast"><CheckCircle2 size={18}/>{toast}</div>}</div>
}

function PageTitle({title,subtitle}:{title:string;subtitle:string}){return <div className="page-title"><div><h1>{title}</h1><p>{subtitle}</p></div><div className="live"><span/> Live demo data</div></div>}
function PanelHead({title,action}:{title:string;action?:any}){return <div className="panel-head"><h3>{title}</h3>{action}</div>}
function Stat({icon,label,value,note,danger}:{icon:any;label:string;value:string;note:string;danger?:boolean}){return <div className="stat"><div className="stat-icon">{icon}</div><span>{label}</span><strong className={danger?"danger-text":""}>{value}</strong><small>{note}</small></div>}
function Loading(){return <div className="loading"><div className="spinner"/><span>Loading your farm data…</span></div>}
function ErrorState({message}:{message:string}){return <div className="loading"><AlertTriangle/><span>{message||"Unable to load data. Is the backend running?"}</span></div>}

export default App;
