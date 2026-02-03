import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import React from "https://esm.sh/react@18.2.0";
import satori from "https://esm.sh/satori@0.10.13";
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.0";

// Trigram Colors (Frontend와 동일)
const TRIGRAM_PALETTE: Record<string, string> = {
    "111": "#2c3e50", // 건
    "000": "#1a1a1a", // 곤
    "100": "#fdbb2d", // 진
    "011": "#7F7FD5", // 손
    "010": "#000000", // 감
    "101": "#ff4b1f", // 리
    "001": "#485563", // 간
    "110": "#24c6dc", // 태
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Font Loading (Cache Promise)
let fontDataPromise: Promise<ArrayBuffer> | null = null;
let fontRegularDataPromise: Promise<ArrayBuffer> | null = null;

const loadFonts = () => {
    if (!fontDataPromise) {
        fontDataPromise = fetch("https://github.com/google/fonts/raw/main/ofl/notoserifkr/NotoSerifKR-Bold.otf")
            .then(res => res.arrayBuffer());
    }
    if (!fontRegularDataPromise) {
        fontRegularDataPromise = fetch("https://github.com/google/fonts/raw/main/ofl/notoserifkr/NotoSerifKR-Regular.otf")
            .then(res => res.arrayBuffer());
    }
    return Promise.all([fontDataPromise, fontRegularDataPromise]);
};

// Initialize WASM once
const initResvgWasm = async () => {
    try {
        await initWasm(fetch("https://esm.sh/@resvg/resvg-wasm@2.6.0/index_bg.wasm"));
    } catch (e) {
        // Already initialized
    }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { week, koan, userName, hexagramCode, hexagramName } = await req.json();

    // 1. Prepare Resources
    await initResvgWasm();
    const [fontBold, fontRegular] = await loadFonts();

    // 2. Logic (Gradient)
    const getDynamicGradient = (code: string) => {
        if (!code || code.length !== 6) return 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)'; 
        const lowerCode = code.substring(0, 3);
        const upperCode = code.substring(3, 6);
        const upperColor = TRIGRAM_PALETTE[upperCode] || '#2c3e50';
        const lowerColor = TRIGRAM_PALETTE[lowerCode] || '#4ca1af';
        return `linear-gradient(180deg, ${upperColor} 0%, ${lowerColor} 100%)`;
    };
    const bgGradient = getDynamicGradient(hexagramCode);

    // 3. Construct Layout (Satori / React Elements)
    // Satori CSS limitations: flexbox mainly. No mix-blend-mode.
    const element = React.createElement(
        "div",
        {
            style: {
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "100%",
                background: bgGradient,
                borderRadius: "0px", // PNG export doesn't need rounded corners on the file itself usually, but card has it.
                // However, resvg will produce a rectangular image. 
                // We can add a wrapper or just let it be square for download.
                // Let's keep 0 for full bleed or 24 if we want transparent corners (Satori supports mask).
                // For simplicity, full rectangular image is safer for cross-platform usage.
                fontFamily: '"Noto Serif KR"',
                position: "relative",
            }
        },
        [
            // Background Textures (Images)
            React.createElement("img", {
                src: "https://www.transparenttextures.com/patterns/washi.png",
                width: "320",
                height: "568",
                style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.3, objectFit: "cover" }
            }),
            React.createElement("img", {
                src: "https://www.transparenttextures.com/patterns/noise-lines.png",
                width: "320",
                height: "568",
                style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.1, objectFit: "cover" }
            }),

            // Gold Borders
            React.createElement("div", {
                style: { position: "absolute", top: "12px", left: "12px", right: "12px", bottom: "12px", border: "2px solid #eebd2b", borderRadius: "20px", opacity: 0.4 }
            }),
             React.createElement("div", {
                style: { position: "absolute", top: "16px", left: "16px", right: "16px", bottom: "16px", border: "1px solid #eebd2b", borderRadius: "16px", opacity: 0.2 }
            }),

            // Content Container
            React.createElement("div", {
                style: {
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    height: "100%",
                    padding: "32px",
                    color: "white"
                }
            }, [
                // Header
                React.createElement("div", {
                    style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }
                }, [
                     React.createElement("span", {
                        style: { fontSize: "12px", letterSpacing: "0.2em", color: "#eebd2b", borderBottom: "1px solid rgba(238, 189, 43, 0.3)", paddingBottom: "4px", fontWeight: 700 }
                    }, `WEEK 0${week}`),
                    // Vertical Text Workaround for Satori (Flex Column)
                    React.createElement("div", {
                         style: { display: "flex", flexDirection: "column", alignItems: "center", opacity: 0.9 }
                    }, [
                        React.createElement("span", { style: { color: "#eebd2b", fontSize: "15px", fontWeight: "bold", marginBottom: "-2px" } }, "話"),
                        React.createElement("span", { style: { color: "#eebd2b", fontSize: "15px", fontWeight: "bold" } }, "頭")
                    ])
                ]),

                // Main Koan
                React.createElement("div", {
                    style: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, width: "100%" }
                }, [
                    React.createElement("div", { style: { width: "1px", height: "48px", background: "linear-gradient(to bottom, transparent, #eebd2b, transparent)", opacity: 0.5, marginBottom: "24px" }}),
                    
                    React.createElement("h1", {
                        style: { 
                            fontSize: "28px", 
                            fontWeight: 700, 
                            textAlign: "center", 
                            color: "white", 
                            textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                            margin: 0,
                            lineHeight: 1.4
                        }
                    }, koan),

                    React.createElement("div", { style: { width: "1px", height: "48px", background: "linear-gradient(to bottom, transparent, #eebd2b, transparent)", opacity: 0.5, marginTop: "24px" }}),
                ]),

                // Footer
                React.createElement("div", {
                    style: { display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }
                }, [
                     React.createElement("div", {
                        style: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px", opacity: 0.9 }
                     }, [
                        React.createElement("div", { style: { width: "32px", height: "1px", background: "white", opacity: 0.4 }}),
                        React.createElement("span", { style: { fontSize: "20px", fontWeight: "bold", letterSpacing: "0.2em", color: "#eebd2b" } }, hexagramName),
                        React.createElement("div", { style: { width: "32px", height: "1px", background: "white", opacity: 0.4 }}),
                     ]),
                     React.createElement("span", {
                        style: { fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.6 }
                     }, "OPPAJEOM.COM")
                ])
            ])
        ]
    );

    // 4. Generate SVG
    const svg = await satori(element, {
        width: 320,
        height: 568,
        fonts: [
            { name: 'Noto Serif KR', data: fontBold, weight: 700, style: 'normal' },
            { name: 'Noto Serif KR', data: fontRegular, weight: 400, style: 'normal' },
        ],
    });

    // 5. Render to PNG (3x Scale for High Quality)
    const resvg = new Resvg(svg, {
        fitTo: {
            mode: 'zoom',
            value: 3
        }
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    return new Response(pngBuffer, {
      headers: { ...corsHeaders, "Content-Type": "image/png" },
    });

  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});