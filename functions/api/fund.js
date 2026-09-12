export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = (url.searchParams.get("code") || "")
    .replace(/\D/g, "")
    .slice(0, 6);

  if (code.length !== 6) {
    return Response.json(
      { ok: false, error: "请输入 6 位基金代码" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://fundf10.eastmoney.com/jjfl_${code}.html`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; FundFeeLens/1.0)",
        },
      }
    );

    if (!response.ok) throw new Error("upstream unavailable");

    const html = await response.text();
    if (!html || /页面不存在|基金代码错误|访问受限/i.test(html)) {
      throw new Error("fund not found");
    }

    const rate = (labels) => {
      for (const label of labels) {
        const match = new RegExp(
          label + "[^\\d%]{0,120}(\\d+(?:\\.\\d+)?\\s*%)",
          "i"
        ).exec(html);
        if (match) return match[1].replace(/\s/g, "");
      }
      return "—";
    };

    const name = (
      /<title>\s*([^<|：:]+?)(?:基金费率|基金档案|_)?\s*[|_]/i.exec(html)
        ?. [1] || `基金 ${code}`
    ).trim();

    return Response.json({
      ok: true,
      fund: {
        code,
        name,
        buy: rate(["申购费率", "申购费用"]),
        redeem: rate(["赎回费率"]),
        service: rate(["销售服务费率", "销售服务费"]),
        source: "天天基金公开数据",
      },
    });
  } catch {
    return Response.json(
      { ok: false, error: "天天基金暂时无法访问，请稍后再试" },
      { status: 502 }
    );
  }
}
