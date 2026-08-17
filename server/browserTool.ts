import { chromium } from "playwright";

export async function browseUrl(url: string): Promise<{ title: string; text: string; success: boolean; error?: string }> {
  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();
    
    // Set timeout to 15 seconds
    await page.goto(url, { timeout: 15000, waitUntil: "domcontentloaded" });
    const title = await page.title();
    
    // Extract text content from body
    const text = await page.evaluate(() => {
      return document.body ? document.body.innerText.slice(0, 3000) : "";
    });

    await browser.close();
    return {
      title,
      text: text.replace(/\s+/g, " ").trim(),
      success: true
    };
  } catch (err: any) {
    console.error("Playwright browser automation error:", err);
    return {
      title: "Navigation Failed",
      text: "",
      success: false,
      error: err.message
    };
  }
}
