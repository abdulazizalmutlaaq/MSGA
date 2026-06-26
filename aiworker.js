/**
 * MSGA — وسيط الذكاء الاصطناعي (Cloudflare Worker)
 * ـــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــــ
 * الغرض: استقبال مؤشرات الأداء من صفحة المحاضر وإرجاع تحليل تنفيذي ذكي
 *        مكتوب بالعربية، دون كشف مفتاح Anthropic في صفحة الويب العامة.
 *
 * لماذا Worker؟  لأن وضع مفتاح الـ API داخل صفحة HTML عامة على GitHub Pages
 *               يعني تسريبه لأي زائر. الـ Worker يحتفظ بالمفتاح كـ "سرّ"
 *               على خوادم Cloudflare، والصفحة تنادي الـ Worker فقط.
 *
 * طريقة الإعداد كاملةً في نهاية الملف (تعليمات مرقّمة).
 */

// عدّل هذا ليطابق رابط موقعك على GitHub Pages (بدون / في النهاية)
const ALLOWED_ORIGIN = "https://abdulazizalmutlaaq.github.io";

const MODEL = "claude-opus-4-8";

function corsHeaders(origin) {
  // اسمح فقط لموقعك الرسمي
  const allow = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    // طلب التحقق المسبق من المتصفح
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "ANTHROPIC_API_KEY غير مضبوط في أسرار الـ Worker" }, 500, cors);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: "صيغة البيانات غير صحيحة" }, 400, cors);
    }

    // نبني وصفاً نصياً مختصراً للبيانات حتى يحلّلها النموذج
    const depts = (data.departments || [])
      .map((d) => `- ${d.name}: ${d.done}/${d.total} منجزة (${d.pct}%)`)
      .join("\n");
    const trend = (data.trend || [])
      .map((t) => `${t.label}: ${t.pct}%`)
      .join(" ← ");
    const c = data.counts || {};

    const prompt =
`أنت مستشار تنفيذي لشركة "مسقا للاستثمار". اكتب نشرة تنفيذية موجزة بالعربية الفصحى المهنية
لمجلس الإدارة بناءً على مؤشرات أداء محاضر الاجتماعات التالية. اجعلها 4 إلى 6 جمل،
بنبرة احترافية واثقة، تبرز الإنجاز العام، أبرز القطاعات وأضعفها، الاتجاه العام،
وتوصية تنفيذية واحدة قابلة للتنفيذ. لا تستخدم نقاطاً مرقمة، اكتب فقرات قصيرة.

التاريخ: ${data.date || ""}
عدد المحاضر: ${data.meetings || 0}
إجمالي المهام: ${data.total || 0} — المنجز: ${data.done || 0} — نسبة الإنجاز العامة: ${data.pct || 0}%
حالات المهام: قيد الإنجاز ${c.progress || 0}، بانتظار الاعتماد ${c.review || 0}، مؤجلة ${c.deferred || 0}.

أداء القطاعات:
${depts || "لا يوجد"}

اتجاه الإنجاز عبر المحاضر: ${trend || "غير متوفر"}`;

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 700,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!resp.ok) {
        const detail = await resp.text();
        return json({ error: "Anthropic API error", status: resp.status, detail }, 502, cors);
      }

      const result = await resp.json();
      const text = (result.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      return json({ text }, 200, cors);
    } catch (e) {
      return json({ error: "تعذّر الاتصال بـ Anthropic", detail: String(e) }, 502, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...cors },
  });
}

/* ══════════════════════════════════════════════════════════════════════
   طريقة الربط (مرّة واحدة فقط — حوالي ٥ دقائق):

   ① أنشئ حساباً مجانياً على Cloudflare:  https://dash.cloudflare.com/sign-up

   ② من القائمة الجانبية اختر:  Compute (Workers)  →  Create  →  Create Worker
      • سمّ الـ Worker مثلاً:  msga-ai
      • اضغط Deploy (سيُنشئ نسخة افتراضية)، ثم  Edit code

   ③ احذف الكود الافتراضي والصق كامل محتوى هذا الملف (ai-worker.js)، ثم Deploy.

   ④ أضف مفتاح Anthropic كسرّ (لا يظهر في الكود أبداً):
      Worker → Settings → Variables and Secrets → Add
      • النوع: Secret
      • الاسم:  ANTHROPIC_API_KEY
      • القيمة: مفتاحك من  https://console.anthropic.com/  (يبدأ بـ sk-ant-)
      ثم Save and Deploy.

   ⑤ عدّل السطر  ALLOWED_ORIGIN  أعلى هذا الملف ليطابق رابط موقعك تماماً
      (مثال: https://abdulazizalmutlaaq.github.io)، ثم Deploy مرة أخرى.

   ⑥ انسخ رابط الـ Worker (يظهر أعلى المحرّر، مثل:
      https://msga-ai.<اسم-حسابك>.workers.dev )
      وضعه في ملف momfirebase.html داخل السطر:
         window._AI_ENDPOINT="https://msga-ai.<اسم-حسابك>.workers.dev";

   ⑦ احفظ وارفع التعديل. الآن يعمل زر «✨ تحليل بالذكاء الاصطناعي» في اللوحة التنفيذية.

   ملاحظة أمان: المفتاح يبقى سرّاً داخل Cloudflare ولا يظهر للزوّار إطلاقاً.
   النشرة الذكية المحلية تعمل دائماً حتى بدون هذا الربط.
   ══════════════════════════════════════════════════════════════════════ */
