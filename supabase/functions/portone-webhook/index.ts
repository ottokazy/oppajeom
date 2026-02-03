import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Portone Webhook Received:", body);

    // {
    //   "imp_uid": "imp_1234567890",
    //   "merchant_uid": "merchant_1234567890",
    //   "status": "paid"
    // }

    // 현재 단계에서는 수신 확인용 로그만 남기고 200 OK를 반환합니다.
    // 추후 서버사이드 검증이 필요할 때 이 부분을 확장할 수 있습니다.

    return new Response(JSON.stringify({ received: true }), {
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