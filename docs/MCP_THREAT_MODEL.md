# MCP server threat model

Scope: the public, read-only MCP endpoint at `/mcp` (`src/pages/mcp.ts`, `src/lib/mcp-guard.ts`, `src/lib/mcp-tools.ts`). It serves four tools over stateless Streamable HTTP and requires no authentication.

## Assets

| Asset                           | Why it matters                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| Gemini quota                    | Free tier (100 RPM / 1K RPD embeddings) is shared with the chatbot; exhausting it breaks chat       |
| Upstash quota                   | Redis (rate limits, telemetry, kill switch) and Vector (retrieval) share a free-tier command budget |
| System prompt and canary        | The chatbot's prompt and its leak canary must never be readable through a tool                      |
| Contact channel (email, Resend) | Must not be reachable or abusable through MCP                                                       |

## Trust boundaries

1. **Internet to `/mcp`:** anything can send a request; the guards in `mcp-guard.ts` run before the SDK sees it.
2. **Endpoint to Upstash and Gemini:** only `search_facts` crosses this, and only on a cache miss, behind its own limiters.
3. **Tool output to the client's model:** returned text is rendered into someone else's LLM context. Everything returned is author-written (case-study MDX, curated facts, an allowlisted profile).

## Threats and mitigations

| STRIDE                 | Threat                                | Mitigation                                                                                                     |
| ---------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Tampering              | Tool poisoning / rug pull             | Tool names and descriptions are static strings in version-controlled source; no dynamic or remote registration |
| Tampering              | Prompt injection via returned content | Content is author-written only; no third-party or user-generated text is stored or returned                    |
| Information disclosure | Data exfiltration                     | No secrets, email, phone or form data reachable; `get_profile` picks fields from an explicit allowlist         |
| Spoofing               | DNS rebinding from a browser          | `Origin` allowlist (403 on mismatch); no CORS headers, so browsers cannot read cross-origin responses          |
| Denial of service      | Quota exhaustion                      | Per-IP limit on every request, per-IP and daily limits on `search_facts`, 10-minute fact cache, kill switch    |
| Denial of service      | Oversized input                       | 16 KB body cap, Zod caps (query 1 to 200 chars, slug 1 to 100 chars), project body capped at 20,000 chars      |
| Elevation of privilege | State or writes through the server    | Every tool is read-only; there are no sessions, no write tools and no tool that calls the chat model           |
| Tampering              | Supply chain (SDK or transitive deps) | SDK pinned to an exact version; CodeQL and OpenSSF Scorecard run in CI; Renovate proposes upgrades for review  |

## Out of scope

- **Authentication.** The data is public on the site already.
- **The system prompt.** It is never exposed through MCP, and no tool invokes the chat LLM.

## Residual risks

- **Shared quota.** A distributed caller can still spend the daily `search_facts` budget (300/day) and the cache only helps for repeated queries. Impact is degraded `search_facts` for the day, not chat, since the budget is a fraction of the embedding quota; the kill switch is the manual backstop.
- **Limiters fail open.** A Redis outage disables rate limiting and the kill switch read so the endpoint stays up; the cache and the Gemini quota itself remain the floor.
- **Per-IP keying.** Limits key on the platform-derived client address, so callers behind a shared NAT share a budget, and a botnet gets one budget per address.
- **Origin check is browser-only.** Non-browser clients send no `Origin` and are allowed by design; they are bounded by the limiters instead.
- **Upstream compromise.** A compromised dependency or a malicious edit to the author-written content could reach clients' models; review and the pinned SDK are the controls.
