// Follow this setup guide to deploy: https://supabase.com/docs/guides/functions/deploy
// Need to set Secrets in Supabase Dashboard: SOLAPI_API_KEY, SOLAPI_API_SECRET, PF_ID

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { HmacSha256 } from "https://deno.land/std@0.168.0/hash/sha256.ts";

// Fix for "Cannot find name 'Deno'" in environments where Deno types are not globally available
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, name, week } = await req.json();

    const apiKey = Deno.env.get('SOLAPI_API_KEY');
    const apiSecret = Deno.env.get('SOLAPI_API_SECRET');
    const pfId = Deno.env.get('PF_ID'); // Kakao Channel PF ID

    if (!apiKey || !apiSecret || !pfId) {
      throw new Error("Missing Solapi Configuration");
    }

    // Solapi Auth Header Generation
    const date = new Date().toISOString();
    const salt = crypto.randomUUID().replace(/-/g, "");
    const signature = new HmacSha256(apiSecret).update(date + salt).toString();
    const authorization = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

    // Notification Template (Must be pre-approved in Solapi)
    // Template ID: WEEKLY_CARE_V1 (Example)
    const text = `${name}님, ${week}주차 화두가 도착했습니다.\n지난 한 주, 마음은 좀 어떠셨나요?\n\n도반(The Sage)이 당신의 감정에 맞춘 새로운 지혜를 준비했습니다.\n지금 바로 확인해보세요.`;

    // [UX Update] Direct Link to Login Mode
    // 링크 뒤에 ?mode=login 파라미터를 추가하여, 클릭 시 바로 입력창이 뜨도록 합니다.
    const directLink = "https://www.oppajeom.com?mode=login";

    const body = {
      messages: [
        {
          to: phone,
          from: "01000000000", // 발신번호 (솔라피에 등록된 번호여야 함)
          kakaoOptions: {
            pfId: pfId,
            templateId: "WEEKLY_CARE_V1", // 솔라피에 등록한 템플릿 ID
            variables: {
              "#{name}": name,
              "#{week}": String(week)
            },
            buttons: [
                {
                    buttonType: "WL", // Web Link
                    buttonName: "화두 확인하기",
                    linkMo: directLink,
                    linkPc: directLink
                }
            ]
          }
        }
      ]
    };

    const response = await fetch("https://api.solapi.com/messages/v4/send", {
      method: "POST",
      headers: {
        "Authorization": authorization,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const result = await response.json();

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});