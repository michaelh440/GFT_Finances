// src/routes/corp/website_sync/validate/+server.js
// API endpoint that validates a single domain via fetch + AI classification
import { json } from '@sveltejs/kit';
import { requirePermission } from '$lib/guards';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

/**
 * Strip HTML to a plain text snippet.
 * @param {string} html
 * @param {number} [maxLen=1500]
 */
function htmlToSnippet(html, maxLen = 1500) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/**
 * Try multiple URL variations to reach a domain.
 * @param {string} domain
 * @returns {Promise<{ status: string, snippet: string }>}
 */
async function fetchDomain(domain) {
  const urlsToTry = [
    `https://www.${domain}`,
    `https://${domain}`,
    `http://www.${domain}`,
    `http://${domain}`,
  ];

  for (const url of urlsToTry) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const resp = await fetch(url, {
        headers: FETCH_HEADERS,
        redirect: /** @type {RequestRedirect} */ ('follow'),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const html = await resp.text();
      return {
        status: `HTTP ${resp.status} via ${url}`,
        snippet: htmlToSnippet(html) || '(empty page)',
      };
    } catch {
      continue;
    }
  }

  return { status: 'UNREACHABLE', snippet: `Could not connect to ${domain} on any URL variant` };
}

/** Domains that are never a company's own website */
const SEARCH_BLOCKED_HOSTS = [
  'wikipedia.org', 'facebook.com', 'linkedin.com', 'twitter.com', 'x.com',
  'yelp.com', 'bbb.org', 'glassdoor.com', 'indeed.com', 'crunchbase.com',
  'bloomberg.com', 'youtube.com', 'instagram.com', 'tiktok.com',
  'reddit.com', 'pinterest.com', 'amazon.com', 'google.com',
  'duckduckgo.com', 'bing.com',
];

/**
 * Search DuckDuckGo for a company's website.
 * Returns the best-guess domain or null.
 * @param {string} companyName
 * @returns {Promise<string | null>}
 */
async function searchCompanyDomain(companyName) {
  const query = encodeURIComponent(`${companyName} company official website`);
  const url = `https://html.duckduckgo.com/html/?q=${query}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const html = await resp.text();

    // DuckDuckGo HTML results encode target URLs in the uddg= parameter
    const uddgRegex = /uddg=([^&"]+)/g;
    let match;
    while ((match = uddgRegex.exec(html)) !== null) {
      try {
        const decoded = decodeURIComponent(match[1]);
        const hostname = new URL(decoded).hostname.replace(/^www\./, '');
        if (!SEARCH_BLOCKED_HOSTS.some(b => hostname.includes(b))) {
          return hostname;
        }
      } catch { /* skip bad URLs */ }
    }
  } catch (err) {
    console.error(`Search failed for "${companyName}":`, err instanceof Error ? err.message : err);
  }

  return null;
}

export async function POST({ request, locals }) {
  requirePermission(locals.user, 'corp', 'manager');

  const body = await request.json();
  let domain = body.domain || '';
  const companyName = body.companyName || '';
  let discoveredDomain = '';

  // If no email domain provided, search the web using the company name
  if (!domain && companyName) {
    const found = await searchCompanyDomain(companyName);
    if (found) {
      domain = found;
      discoveredDomain = found;
      console.log(`Search for "${companyName}" → discovered domain: ${found}`);
    } else {
      console.log(`Search for "${companyName}" → no domain found`);
      return json({
        domain: '',
        discoveredDomain: '',
        verdict: 'invalid',
        reason: 'No website found via search',
        summary: '',
        industry: '',
        company_size: '',
        checked: false,
      });
    }
  }

  if (!domain) return json({ error: 'No domain or company name provided' }, { status: 400 });

  // Step 1: Fetch the website
  const fetched = await fetchDomain(domain);
  console.log(`Validate ${domain}: ${fetched.status}`);

  // If unreachable, skip AI call
  if (fetched.status === 'UNREACHABLE') {
    return json({
      domain,
      discoveredDomain,
      verdict: 'invalid',
      reason: 'Could not connect to website',
      checked: false,
    });
  }

  // Step 2: Classify with AI
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({
      domain,
      discoveredDomain,
      verdict: 'unknown',
      reason: 'No ANTHROPIC_API_KEY configured',
      checked: true,
    });
  }

  try {
    const client = new Anthropic({ apiKey, timeout: 30000 });

    const aiResponse = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Classify this website and describe the company.

DOMAIN: ${domain}
${companyName ? `COMPANY NAME: ${companyName}\n` : ''}FETCH STATUS: ${fetched.status}
PAGE CONTENT:
${fetched.snippet}

Respond with ONLY valid JSON, no other text:
{"verdict": "real|temporary|invalid", "reason": "brief 10-word explanation", "summary": "1-2 sentence description of what the company does", "industry": "industry category e.g. Technology, Healthcare, Finance, Manufacturing, Real Estate, Education, Retail, Construction, Legal, Consulting, Energy, Entertainment, Food & Beverage, Transportation, Nonprofit, etc.", "company_size": "estimated size: 1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5000+"}`
      }],
    });

    const text = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return json({
        domain,
        discoveredDomain,
        verdict: parsed.verdict,
        reason: parsed.reason,
        summary: parsed.summary || '',
        industry: parsed.industry || '',
        company_size: parsed.company_size || '',
        checked: parsed.verdict === 'real',
      });
    }
  } catch (err) {
    console.error(`AI error for ${domain}:`, err instanceof Error ? err.message : err);
  }

  return json({
    domain,
    discoveredDomain,
    verdict: 'unknown',
    reason: 'AI classification failed',
    checked: true,
  });
}
