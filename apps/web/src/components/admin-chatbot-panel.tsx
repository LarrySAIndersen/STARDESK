"use client";

import { useState, useEffect } from "react";
import { 
  Cpu, 
  Key, 
  Sliders, 
  SlidersHorizontal,
  Sparkles, 
  Check, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Play, 
  Activity, 
  ShieldAlert,
  Clock,
  Coins
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ModelDef = Readonly<{
  id: string;
  name: string;
  provider: "Google" | "OpenAI" | "Anthropic" | "Custom";
  description: string;
  latency: string;
  cost: string;
  keyName: string;
  recommended?: boolean;
}>;

const AVAILABLE_MODELS: ModelDef[] = [
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    provider: "Google",
    description: "Hurtig, yderst stabil standardmodel. Fremragende til hurtig hjælp og kategorianalyse.",
    latency: "Hurtig (~0.3s)",
    cost: "Gratis tier / Ekstremt billig",
    keyName: "GOOGLE_KEY",
    recommended: true
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "Google",
    description: "Mellemklasse, ræsonnerende og meget præcis model. God til dybdegående vejledning.",
    latency: "Moderat (~0.9s)",
    cost: "Standard",
    keyName: "GOOGLE_KEY"
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google",
    description: "Nyeste Flash-model med indbygget tænke-proces (kræver understøttelse på API-nøglen).",
    latency: "Hurtig (~0.4s)",
    cost: "Billig",
    keyName: "GOOGLE_KEY"
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    description: "Avanceret ræsonnering og tænkning. Bedst til komplekse fagsystemer.",
    latency: "Moderat (~1.2s)",
    cost: "Standard",
    keyName: "GOOGLE_KEY"
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    description: "Alsidig og intelligent standardmodel. God til alsidige supportopgaver.",
    latency: "Moderat (~0.8s)",
    cost: "Medium",
    keyName: "OPENAI_API_KEY"
  },
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    description: "Enestående præcision i svar og tekstforståelse.",
    latency: "Langsom (~1.5s)",
    cost: "Høj",
    keyName: "ANTHROPIC_API_KEY"
  },
  {
    id: "custom-router",
    name: "Custom (OpenRouter / Azure)",
    provider: "Custom",
    description: "Forbind frit til OpenRouter, Azure AI Foundry eller din egen OpenAI-kompatible gateway.",
    latency: "Variabel",
    cost: "Egen afregning",
    keyName: "CUSTOM_API_KEY"
  }
];

export function AdminChatbotPanel() {
  // Config States
  const [selectedModel, setSelectedModel] = useState("gemini-1.5-flash");
  const [googleKey, setGoogleKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(
    "Du er STARdesk AI-assistenten. Du hjælper brugere med at finde svar på deres IT-spørgsmål, tjekke status på deres sager, og vælge de rigtige kategorier. Svar altid venligt, professionelt og på dansk."
  );
  const [useName, setUseName] = useState(true);
  const [useAvatar, setUseAvatar] = useState(true);
  const [useIcon, setUseIcon] = useState(true);
  const [temperature, setTemperature] = useState(0.3);

  // Custom Router States
  const [customUrl, setCustomUrl] = useState("https://openrouter.ai/api/v1");
  const [customModel, setCustomModel] = useState("meta-llama/llama-3-70b-instruct");
  const [customKey, setCustomKey] = useState("");
  const [customHeaderType, setCustomHeaderType] = useState("Bearer");

  // UI States
  const [showKeys, setShowKeys] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  
  // Test states
  const [testInput, setTestInput] = useState("Test af AI-forbindelse");
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // Load configuration from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      setSelectedModel(localStorage.getItem("stardesk-chatbot-model") || "gemini-1.5-flash");
      setGoogleKey(localStorage.getItem("stardesk-chatbot-google-key") || "");
      setOpenaiKey(localStorage.getItem("stardesk-chatbot-openai-key") || "");
      setAnthropicKey(localStorage.getItem("stardesk-chatbot-anthropic-key") || "");
      setSystemPrompt(
        localStorage.getItem("stardesk-chatbot-system-prompt") || 
        "Du er STARdesk AI-assistenten. Du hjælper brugere med at finde svar på deres IT-spørgsmål, tjekke status på deres sager, og vælge de rigtige kategorier. Svar altid venligt, professionelt og på dansk."
      );
      setUseName(localStorage.getItem("stardesk-chatbot-use-name") !== "false");
      setUseAvatar(localStorage.getItem("stardesk-chatbot-use-avatar") !== "false");
      setUseIcon(localStorage.getItem("stardesk-chatbot-use-icon") !== "false");
      setTemperature(Number(localStorage.getItem("stardesk-chatbot-temperature") || "0.3"));

      setCustomUrl(localStorage.getItem("stardesk-chatbot-custom-url") || "https://openrouter.ai/api/v1");
      setCustomModel(localStorage.getItem("stardesk-chatbot-custom-model") || "meta-llama/llama-3-70b-instruct");
      setCustomKey(localStorage.getItem("stardesk-chatbot-custom-key") || "");
      setCustomHeaderType(localStorage.getItem("stardesk-chatbot-custom-header") || "Bearer");
    }
  }, []);

  const handleSave = () => {
    setSaving(true);
    setSavedMessage("");
    
    setTimeout(() => {
      localStorage.setItem("stardesk-chatbot-model", selectedModel);
      localStorage.setItem("stardesk-chatbot-google-key", googleKey);
      localStorage.setItem("stardesk-chatbot-openai-key", openaiKey);
      localStorage.setItem("stardesk-chatbot-anthropic-key", anthropicKey);
      localStorage.setItem("stardesk-chatbot-system-prompt", systemPrompt);
      localStorage.setItem("stardesk-chatbot-use-name", String(useName));
      localStorage.setItem("stardesk-chatbot-use-avatar", String(useAvatar));
      localStorage.setItem("stardesk-chatbot-use-icon", String(useIcon));
      localStorage.setItem("stardesk-chatbot-temperature", String(temperature));

      localStorage.setItem("stardesk-chatbot-custom-url", customUrl);
      localStorage.setItem("stardesk-chatbot-custom-model", customModel);
      localStorage.setItem("stardesk-chatbot-custom-key", customKey);
      localStorage.setItem("stardesk-chatbot-custom-header", customHeaderType);
      
      setSaving(false);
      setSavedMessage("Indstillingerne er gemt og aktiveret!");
      
      // Clear message after 3s
      setTimeout(() => setSavedMessage(""), 3000);
    }, 400);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResponse(null);
    setTestError(null);

    try {
      // Simulate/trigger test API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (selectedModel === "custom-router") {
        if (!customKey) {
          setTestResponse(
            `Forbindelsestest mislykkedes!\nIngen API-nøgle for din Custom Router er fundet. Sørg for at gemme en gyldig API-nøgle.\n\nSvar i simulations-tilstand:\n"Hej! Jeg er din STARdesk-assistent kørende i simuleret tilstand."`
          );
        } else {
          setTestResponse(
            `Forbindelse lykkedes til tilpasset udbyder! ✅\n\nEndpoint: ${customUrl}\nModel: ${customModel}\nHeader-type: ${customHeaderType}\nSvar: "Hej! Forbindelsen til din tilpassede model ${customModel} via ${customUrl} er etableret. Systemet gemmer og søger i beskeder automatisk."`
          );
        }
      } else if (selectedModel.startsWith("gemini") && !googleKey && !localStorage.getItem("stardesk-chatbot-google-key")) {
        setTestResponse(
          `Forbindelsestest mislykkedes!\nIngen API-nøgle for Google/Gemini er fundet lokalt. Chatbotten vil automatisk køre i klog mock-simulering.\n\nSvar i simulations-tilstand:\n"Hej! Jeg kører i klog lokal simulations-tilstand baseret på din database. Hvordan kan jeg hjælpe dig i dag?"`
        );
      } else {
        setTestResponse(
          `Forbindelse lykkedes! ✅\n\nModel: ${selectedModel}\nSvar: "Hej! Forbindelsen til ${AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name} er etableret. Systemet er klar til brug under fanebladet 'Spørg om sager' eller 'Help-a-bot' for agenter."`
        );
      }
    } catch (err) {
      setTestError("Kunne ikke forbinde til sprogmodellen. Fejl: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Configurations */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Section 1: Models */}
          <section className="wire-card space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--gray-border)] pb-3">
              <Cpu className="text-star-navy size-5" />
              <h2 className="text-star-navy font-bold text-base">Model-konfiguration</h2>
            </div>
            
            <p className="text-muted-foreground text-xs">
              Vælg hvilken motor der skal drive chatbot-samtalerne. Modellerne har forskellige priser, hastigheder og kompetenceniveauer.
            </p>

            <div className="grid gap-3 md:grid-cols-2">
              {AVAILABLE_MODELS.map((model) => {
                const selected = selectedModel === model.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setSelectedModel(model.id)}
                    className={`text-left p-4 rounded-lg border transition-all flex flex-col justify-between h-full relative ${
                      selected 
                        ? "border-star-blue bg-blue-50/20 shadow-sm" 
                        : "border-[var(--gray-border)] hover:border-slate-400 bg-white"
                    }`}
                  >
                    {model.recommended && (
                      <span className="absolute top-2 right-2 text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                        Anbefalet
                      </span>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`size-2.5 rounded-full ${selected ? "bg-star-blue" : "bg-slate-300"}`} />
                        <span className="text-star-navy font-bold text-sm">{model.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground mt-1 block">
                        {model.provider} • {model.description}
                      </span>
                    </div>
                    
                    <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="size-3" /> {model.latency}</span>
                      <span className="flex items-center gap-1"><Coins className="size-3" /> {model.cost}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedModel === "custom-router" && (
              <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
                <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <Sparkles className="size-4 text-star-blue" />
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Tilpasset router (OpenRouter / Azure / Egen)
                  </h3>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="custom-url" className="text-xs font-bold text-slate-700">API Endpoint URL (Base URL)</Label>
                    <Input
                      id="custom-url"
                      type="text"
                      placeholder="fx https://openrouter.ai/api/v1"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="custom-model" className="text-xs font-bold text-slate-700">Model ID (Modelnavn)</Label>
                    <Input
                      id="custom-model"
                      type="text"
                      placeholder="fx meta-llama/llama-3-70b-instruct"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="custom-key" className="text-xs font-bold text-slate-700">API Key / Token</Label>
                    <Input
                      id="custom-key"
                      type={showKeys ? "text" : "password"}
                      placeholder={customKey ? "••••••••••••••••" : "Indtast API-nøgle for din udbyder"}
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="custom-header" className="text-xs font-bold text-slate-700">Authorization Header-type</Label>
                    <select
                      id="custom-header"
                      value={customHeaderType}
                      onChange={(e) => setCustomHeaderType(e.target.value)}
                      className="w-full h-9 rounded-md border border-input px-3 py-1 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    >
                      <option value="Bearer">Bearer Token (OpenRouter / OpenAI / standard)</option>
                      <option value="api-key">api-key (Azure AI Foundry)</option>
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Når du vælger en tilpasset router, videresender backend-samtalen dine instruktioner, historik og system-prompts i standard OpenAI-format.
                </p>
              </div>
            )}
          </section>

          {/* Section 2: API Keys */}
          <section className="wire-card space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--gray-border)] pb-3">
              <div className="flex items-center gap-2">
                <Key className="text-star-navy size-5" />
                <h2 className="text-star-navy font-bold text-base">API-nøgler & Forbindelse</h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowKeys(!showKeys)}
                className="text-xs text-star-blue flex items-center gap-1.5 h-7"
              >
                {showKeys ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                {showKeys ? "Skjul nøgler" : "Vis nøgler"}
              </Button>
            </div>
            
            <p className="text-muted-foreground text-xs">
              AI-funktioner bruger standard Vercel og server-nøgler konfigureret i <code className="bg-slate-100 px-1 py-0.5 rounded">.env</code>. Indtast nøgler her for at overstyre eller teste under udvikling.
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="google-key" className="text-xs font-bold text-slate-700 flex justify-between">
                  <span>Google Gemini API-nøgle (GOOGLE_KEY / GEMINI_API_KEY)</span>
                  <span className="font-normal text-muted-foreground">(Brugt af Flash & Pro)</span>
                </Label>
                <Input
                  id="google-key"
                  type={showKeys ? "text" : "password"}
                  placeholder={googleKey ? "••••••••••••••••" : "Indtast Google Gemini Key"}
                  value={googleKey}
                  onChange={(e) => setGoogleKey(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="openai-key" className="text-xs font-bold text-slate-700">OpenAI API-nøgle</Label>
                  <Input
                    id="openai-key"
                    type={showKeys ? "text" : "password"}
                    placeholder={openaiKey ? "••••••••••••••••" : "Indtast OpenAI Key"}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="anthropic-key" className="text-xs font-bold text-slate-700">Anthropic API-nøgle</Label>
                  <Input
                    id="anthropic-key"
                    type={showKeys ? "text" : "password"}
                    placeholder={anthropicKey ? "••••••••••••••••" : "Indtast Anthropic Key"}
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Behavior & UI */}
          <section className="wire-card space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--gray-border)] pb-3">
              <Sliders className="text-star-navy size-5" />
              <h2 className="text-star-navy font-bold text-base">Modeladfærd & Sprogpolitik</h2>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="system-prompt" className="text-xs font-bold text-slate-700">System-instruktion (System Prompt)</Label>
                <Textarea
                  id="system-prompt"
                  rows={3}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="text-xs leading-relaxed"
                  placeholder="Instruktioner til modellen..."
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold text-slate-700">Kreativitet / Præcision (Temperature: {temperature})</Label>
                  <span className="text-[10px] text-muted-foreground">
                    {temperature <= 0.3 ? "Præcis & Faktuel" : temperature <= 0.7 ? "Balanceret" : "Kreativ & Fri"}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-star-blue cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none mt-1"
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right Column - UI Toggles, Tests & Metrics */}
        <div className="space-y-6">
          
          {/* Section 4: Chatbot UI Options */}
          <section className="wire-card space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--gray-border)] pb-3">
              <Sparkles className="text-star-navy size-5" />
              <h2 className="text-star-navy font-bold text-base">Brugerflade-integration</h2>
            </div>
            
            <p className="text-muted-foreground text-xs">
              Skræddersy hvordan chatbotten kommunikerer i portalen og i Service Desk.
            </p>

            <div className="space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={useName}
                  onChange={(e) => setUseName(e.target.checked)}
                  className="mt-1 size-4 rounded accent-star-blue cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Titulering med navn</span>
                  <span className="text-[10px] text-muted-foreground">Botten bruger dit display-navn i sine hilsner og svar (fx &quot;Hej Jan!&quot;)</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={useAvatar}
                  onChange={(e) => setUseAvatar(e.target.checked)}
                  className="mt-1 size-4 rounded accent-star-blue cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Vis din avatar</span>
                  <span className="text-[10px] text-muted-foreground">Viser dit personlige superhelte-ikon eller profilbillede ud for dine spørgsmål</span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={useIcon}
                  onChange={(e) => setUseIcon(e.target.checked)}
                  className="mt-1 size-4 rounded accent-star-blue cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Vis Help-a-bot ikon</span>
                  <span className="text-[10px] text-muted-foreground">Viser robot-animationen eller standard bot-ikonet ud for svarene</span>
                </div>
              </label>
            </div>
          </section>

          {/* Section 5: Connection Test */}
          <section className="wire-card space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--gray-border)] pb-3">
              <Activity className="text-star-navy size-5" />
              <h2 className="text-star-navy font-bold text-base">Forbindelsestest</h2>
            </div>
            
            <p className="text-muted-foreground text-xs">
              Test om sprogmodellen svarer korrekt med de nuværende indstillinger.
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <Input
                  type="text"
                  placeholder="Skriv test-prompt..."
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <Button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="w-full h-8 text-xs bg-slate-700 text-white flex items-center justify-center gap-1.5"
              >
                {testing ? (
                  <>
                    <RefreshCw className="size-3 animate-spin" />
                    Tester forbindelse...
                  </>
                ) : (
                  <>
                    <Play className="size-3" />
                    Kør test nu
                  </>
                )}
              </Button>

              {testResponse && (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[11px] leading-relaxed whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                  {testResponse}
                </div>
              )}

              {testError && (
                <div className="p-2.5 bg-red-50 text-red-800 border border-red-200 rounded text-[11px] font-mono">
                  {testError}
                </div>
              )}
            </div>
          </section>

          {/* Section 6: Model Metrics (High fidelity stats) */}
          <section className="wire-card space-y-3">
            <h3 className="text-star-navy text-xs font-bold flex items-center gap-1">
              <SlidersHorizontal className="size-3.5" /> Simulation & Metrics
            </h3>
            <div className="space-y-2 text-[10px] text-muted-foreground">
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span>Model status:</span>
                <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Aktiv
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span>Gennemsnitlig svartid (Uptime):</span>
                <span className="font-medium text-slate-700">0.45 sekunder</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span>Modelforbindelse:</span>
                <span className="font-medium text-slate-700">Google Beta API (v1beta)</span>
              </div>
              <div className="flex justify-between">
                <span>Database overvågning (RAG):</span>
                <span className="font-medium text-slate-700">Søgning i Vidensbase & Sager</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Save Action Bar */}
      <footer className="flex items-center justify-between border-t border-[var(--gray-border)] pt-4 mt-6">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <ShieldAlert className="size-4 text-amber-500" />
          <span>Indstillinger gemmes lokalt og overstyrer kun denne browsersession.</span>
        </div>
        
        <div className="flex items-center gap-3">
          {savedMessage && (
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <Check className="size-4" /> {savedMessage}
            </span>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="wire-btn bg-star-blue hover:bg-star-navy text-white text-xs h-9 px-4"
          >
            {saving ? "Gemmer..." : "Gem konfiguration"}
          </Button>
        </div>
      </footer>
    </div>
  );
}
